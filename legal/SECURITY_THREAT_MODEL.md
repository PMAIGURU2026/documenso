# Security Threat Model
## Verification Portal — Issue #1764
## Owner: Gamaliel (Security & Cryptographic Validation)

---

## Overview
This document identifies potential security threats to the Verification Portal and 
outlines mitigation strategies for each. This threat model is based on OWASP and 
cryptographic best practices.

---

## 1. Threat: PDF Bomb / Denial of Service (DoS)

### Attack Description
An attacker uploads a maliciously crafted PDF designed to consume excessive CPU/memory 
during parsing, causing the server to crash or become unresponsive.

**Examples:**
- **Zip Bomb concept applied to PDFs**: PDF with highly compressed content that expands to gigabytes
- **Recursive object references**: PDF objects that reference themselves infinitely, causing parser loops
- **Exploits in libpdf/core**: Vulnerability in the parsing library itself

### Risk Level: **HIGH**

### Mitigation Strategies

#### 1. File Size Limit (Middleware Layer)
```typescript
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB absolute maximum

app.use((req, res, next) => {
  if (req.get('content-length') && parseInt(req.get('content-length')) > MAX_FILE_SIZE) {
    return res.status(413).json({ error: 'File too large' });
  }
  next();
});
```

#### 2. Parser Timeout
```typescript
async function verifyPdfSignature(filePath: string, timeoutMs = 10000): Promise<Result> {
  return Promise.race([
    performVerification(filePath),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Verification timeout')), timeoutMs)
    ),
  ]);
}
```

#### 3. Sandboxed Parsing
Consider parsing PDFs in a separate worker process or container with resource limits:
```typescript
const { Worker } = require('worker_threads');

function verifyInSandbox(filePath: string): Promise<Result> {
  return new Promise((resolve, reject) => {
    const worker = new Worker('./pdf-parser-worker.js');
    const timeout = setTimeout(() => {
      worker.terminate(); // Kill stuck parser
      reject(new Error('Parser timeout'));
    }, 10000);

    worker.on('message', (result) => {
      clearTimeout(timeout);
      resolve(result);
    });

    worker.on('error', reject);
    worker.postMessage({ filePath });
  });
}
```

#### 4. Resource Monitoring
```typescript
import os from 'os';

function getSystemResources() {
  const cpuUsage = process.cpuUsage();
  const memUsage = process.memoryUsage();
  
  return {
    cpuPercent: (cpuUsage.user + cpuUsage.system) / 1e6 / os.cpus().length,
    memPercent: (memUsage.heapUsed / memUsage.heapTotal) * 100,
  };
}

// Reject new verification requests if system is overloaded
app.post('/verify', (req, res, next) => {
  const resources = getSystemResources();
  if (resources.cpuPercent > 80 || resources.memPercent > 85) {
    return res.status(503).json({ error: 'Service temporarily unavailable' });
  }
  next();
});
```

### Testing
- [ ] Upload 50 MB file → rejected at middleware
- [ ] Upload valid PDF that takes 15 seconds to parse → times out at 10 seconds
- [ ] Upload malformed PDF → rejected without crash
- [ ] Verify system remains responsive under load

---

## 2. Threat: libpdf/core Vulnerability Exploitation

### Attack Description
The parsing library itself contains a zero-day or unpatched vulnerability that allows:
- Memory corruption (buffer overflow)
- Code execution (arbitrary command execution)
- Information disclosure (memory leak)

### Risk Level: **HIGH**

### Mitigation Strategies

#### 1. Dependency Audit & Pinning
```json
{
  "dependencies": {
    "libpdf/core": "2.4.1"
  }
}
```
- Never use wildcard versions (`*` or `^2.4.x`)
- Pin exact version (2.4.1, not ^2.4.0)
- Require manual review for dependency updates

#### 2. Automated Vulnerability Scanning
```bash
# Add to CI/CD pipeline
npm audit --audit-level=high
npx snyk test --severity-threshold=high
```

#### 3. Software Composition Analysis (SCA)
Enable GitHub Advanced Security (GHAS) or Dependabot:
```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "daily"
    allow:
      - dependency-type: "all"
```

#### 4. Vendor Assessment
Before using libpdf/core in production:
- [ ] Verify it is actively maintained (commits within last 6 months)
- [ ] Check for known CVEs: https://nvd.nist.gov/
- [ ] Review security policy and responsible disclosure process
- [ ] Assess maintainer expertise and responsiveness

#### 5. Fallback Parser
Consider maintaining an alternative parser library as a fallback:
```typescript
import pdfparse from 'pdf-parse'; // Primary
import pdfjs from 'pdfjs-dist'; // Fallback

async function verifyPdfSignature(buffer: Buffer): Promise<Result> {
  try {
    return await parsePdfWithLibpdfCore(buffer);
  } catch (error) {
    console.warn('[PARSER-FALLBACK]', error.message);
    return await parsePdfWithPdfJs(buffer);
  }
}
```

### Testing
- [ ] Run `npm audit` in CI pipeline (fail on high/critical)
- [ ] Run Snyk scan weekly
- [ ] Review security advisories monthly
- [ ] Test fallback parser on 10% of requests

---

## 3. Threat: Memory Disclosure / Buffer Overflow

### Attack Description
If buffer zeroing is not implemented correctly, sensitive PDF content could be recovered 
through:
- Memory dumps (if server is compromised)
- Memory page swap (disk swap of RAM to disk)
- Spectre/Meltdown side-channel attacks

### Risk Level: **CRITICAL**

### Mitigation Strategies

#### 1. Explicit Buffer Zeroing (Code-Level)
```typescript
async function verifyPdfSignature(filePath: string): Promise<VerificationResult> {
  let fileBuffer: Buffer | null = null;
  
  try {
    fileBuffer = fs.readFileSync(filePath);
    // ... perform verification ...
  } finally {
    // MUST execute, even on error
    if (fileBuffer) {
      fileBuffer.fill(0); // Overwrite all bytes with zeros
      fileBuffer = null;
    }
  }
}
```

#### 2. Memory Leak Detection
Use memory profiling tools to verify buffers are actually being freed:
```bash
# Use clinic.js for memory profiling
npm install -g clinic
clinic doctor -- node server.js

# Or use Node's built-in heap snapshots
node --inspect server.js
# Then open Chrome DevTools, take heap snapshot, verify buffers freed
```

#### 3. Disable Swap (Optional, High-Security Environments)
```bash
# Linux: Disable swap for the application process
# This prevents sensitive data from being written to disk
mlockall(); // Lock memory pages in RAM (requires elevated privileges)
```

#### 4. No In-Memory Caching of PDFs
```typescript
// INCORRECT: Caches file data
const pdfCache = new Map<string, Buffer>();

function verifyPdf(filePath: string) {
  if (!pdfCache.has(filePath)) {
    pdfCache.set(filePath, fs.readFileSync(filePath)); // ❌ Data stays in memory
  }
  return performVerification(pdfCache.get(filePath));
}

// CORRECT: Always read from disk, never cache
function verifyPdf(filePath: string) {
  const buffer = fs.readFileSync(filePath);
  try {
    return performVerification(buffer);
  } finally {
    buffer.fill(0);
  }
}
```

### Testing
- [ ] Analyze memory dumps: no unencrypted PDF content visible
- [ ] Run heap profiler: buffer freed after request completes
- [ ] Verify buf.fill(0) is called in finally block (code review)
- [ ] Test with confidential PDFs, verify not recoverable post-request

---

## 4. Threat: Certificate Forgery / Self-Signed Certificate Acceptance

### Attack Description
An attacker creates a self-signed certificate and signs a malicious PDF with it. 
If the portal doesn't distinguish between self-signed and properly issued certificates, 
users may trust the forgery.

### Risk Level: **MEDIUM-HIGH**

### Mitigation Strategies

#### 1. Trusted CA Bundle Validation
```typescript
const TRUSTED_CAS = [
  // AATL (Adobe Approved Trust List)
  fs.readFileSync('./certs/aatl.pem', 'utf-8'),
  // Mozilla CA Bundle
  fs.readFileSync('./certs/mozilla.pem', 'utf-8'),
];

function validateCertificateIssuer(cert: X509Certificate): 'TRUSTED' | 'UNKNOWN' | 'SELF_SIGNED' {
  if (isTrustedCa(cert.issuer)) {
    return 'TRUSTED';
  }
  if (isSelfSigned(cert)) {
    return 'SELF_SIGNED';
  }
  return 'UNKNOWN';
}
```

#### 2. Clear UI Distinction
The portal MUST visually distinguish between:
- ✓ **Green**: Valid signature from trusted CA
- 🔗 **Amber-Trusted**: Valid signature from known provider (Adobe, DocuSign)
- ⚠️ **Amber-Unknown**: Valid signature from unknown CA
- ❌ **Red**: Invalid signature OR self-signed

```jsx
const resultUI = {
  'GREEN': (
    <div className="result-state success">
      <Icon name="check" />
      <h2>Valid Signature — Trusted Authority</h2>
      <p>This signature was issued by a recognized Certificate Authority.</p>
    </div>
  ),
  'AMBER_UNKNOWN': (
    <div className="result-state warning">
      <Icon name="alert-triangle" />
      <h2>Valid Signature — Unknown Issuer</h2>
      <p>⚠️ The signing authority is not recognized. Treat with caution.</p>
    </div>
  ),
};
```

#### 3. Self-Signed Detection Logic
```typescript
function isSelfSigned(cert: X509Certificate): boolean {
  // Subject and Issuer must be identical
  return cert.subject.equals(cert.issuer) &&
         // Certificate must verify with its own public key
         cert.verify(cert.publicKey) &&
         // Must be a leaf certificate (not a CA certificate)
         !cert.hasExtension('basicConstraints');
}
```

### Testing
- [ ] Create self-signed certificate, verify portal shows Amber-Unknown (not Green)
- [ ] Create certificate from untrusted CA, verify Amber-Unknown
- [ ] Create certificate from trusted CA, verify Green
- [ ] Verify disclaimer text differs per state

---

## 5. Threat: Log Injection / IP Address Leakage

### Attack Description
If original IP addresses are logged, they could be:
- Recovered from log files
- Exposed in log aggregation system (Datadog, ELK, etc.)
- Breached in a data leak

### Risk Level: **MEDIUM-HIGH** (GDPR Violation)

### Mitigation Strategies

#### 1. IP Hashing Middleware
```typescript
import xxHash64 from 'xxhash64';

app.use((req, res, next) => {
  const originalIp = req.ip || 'unknown';
  const hashedIp = xxHash64(originalIp).toString(16);
  req.locals = { anonymizedIp: hashedIp };
  next();
});

// Use only hashedIp in logging, never originalIp
logger.info({ anonymizedIp: req.locals.anonymizedIp });
```

#### 2. Log Transport Security
Ensure logs are transmitted securely:
```typescript
const logger = winston.createLogger({
  transports: [
    new winston.transports.File({
      filename: 'logs/verification.log',
      tls: true, // Use TLS for log transport
    }),
  ],
});
```

#### 3. Log Access Control
```bash
# Restrict log file permissions
chmod 600 logs/verification.log # Only owner can read
# Or encrypt log file at rest
```

#### 4. Log Retention Enforcement
Automated deletion of logs older than 72 hours:
```typescript
cron.schedule('0 * * * *', async () => { // Every hour
  const logsDir = './logs';
  const now = Date.now();
  const seventyTwoHours = 72 * 60 * 60 * 1000;
  
  fs.readdirSync(logsDir).forEach(file => {
    const filePath = path.join(logsDir, file);
    const stats = fs.statSync(filePath);
    
    if (now - stats.mtimeMs > seventyTwoHours) {
      fs.unlinkSync(filePath);
      console.log(`[LOG-CLEANUP] Deleted: ${file}`);
    }
  });
});
```

### Testing
- [ ] Inspect logs: no original IP addresses visible
- [ ] Verify hashed IPs are consistent (same IP → same hash)
- [ ] Verify hash cannot be reversed
- [ ] Verify logs are deleted after 72 hours

---

## 6. Threat: OCSP/CRL Timeout (Revocation Check Bypassed)

### Attack Description
If OCSP/CRL checks time out, the portal might:
- Default to "Verified" (assuming not revoked)
- Silently fail to check revocation status
- Create a window where revoked certificates are accepted

### Risk Level: **MEDIUM**

### Mitigation Strategies

#### 1. Explicit Timeout Handling
```typescript
async function checkRevocationStatus(cert: X509Certificate): Promise<RevocationStatus> {
  try {
    const ocspStatus = await checkOcspStatus(cert, 3000); // 3 second timeout
    
    if (ocspStatus === 'revoked') {
      return 'REVOKED';
    }
    if (ocspStatus === 'good') {
      return 'VALID';
    }
    
    // If OCSP times out, try CRL
    const crlStatus = await checkCrlStatus(cert, 5000);
    if (crlStatus === 'revoked') {
      return 'REVOKED';
    }
    if (crlStatus === 'good') {
      return 'VALID';
    }
  } catch (error) {
    // Timeout or error
    return 'UNKNOWN'; // Never default to VALID
  }
  
  return 'UNKNOWN'; // Conservative: treat unknown as "could be revoked"
}
```

#### 2. OCSP Stapling Support
PDF signatures can include an OCSP response "stapled" to them (pre-checked):
```typescript
function extractStapledOcspResponse(pdfSignature: Buffer): OcspResponse | null {
  // If PDF contains a stapled OCSP response, use it instead of live check
  // Reduces latency and dependency on responder availability
  const sig = parseCmsSignature(pdfSignature);
  return sig.getCounterSignature()?.getOcspResponse() || null;
}
```

#### 3. Monitoring & Alerting
```typescript
logger.warn('[REVOCATION-UNKNOWN]', {
  certificateSerialNumber: cert.serialNumber,
  reason: 'OCSP timeout + CRL unavailable',
  timestamp: new Date(),
});

// Alert ops team if this happens frequently
if (revocationUnknownCount > 10) {
  alertOpsTeam('High rate of unknown revocation checks');
}
```

### Testing
- [ ] Simulate OCSP timeout: verify falls back to CRL
- [ ] Simulate CRL timeout: verify result is "UNKNOWN" (not defaulted to valid)
- [ ] Verify monitoring alerts on repeated timeouts
- [ ] Test with stapled OCSP responses

---

## 7. Threat: File Path Traversal / Arbitrary File Read

### Attack Description
If file paths are constructed from user input without validation, an attacker might:
- Upload a file with path like `../../../etc/passwd`
- Read arbitrary files from the server
- Overwrite critical files

### Risk Level: **MEDIUM**

### Mitigation Strategies

#### 1. Sanitize File Names
```typescript
import path from 'path';

function sanitizeFileName(filename: string): string {
  // Remove path traversal attempts
  const sanitized = path.basename(filename); // Extracts just the filename
  
  // Only allow alphanumeric, dash, underscore, dot
  return sanitized.replace(/[^a-zA-Z0-9._-]/g, '_');
}

// Usage
const originalName = req.file.originalname; // Could be: "../../etc/passwd"
const safe = sanitizeFileName(originalName); // Results in: "etc_passwd"
```

#### 2. Use Temporary Directory
```typescript
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

const uploadPath = path.join(os.tmpdir(), `verification_${uuidv4()}.pdf`);
// Results in: /tmp/verification_a1b2c3d4-e5f6-g7h8-i9j0.pdf
// Cannot escape /tmp/ directory
```

#### 3. Validate File Permissions
```typescript
// Ensure uploaded file is world-readable but not writable
fs.chmodSync(uploadPath, 0o644); // rw-r--r--
```

### Testing
- [ ] Attempt upload with `../../../etc/passwd` → rejected
- [ ] Attempt upload with path separators → sanitized
- [ ] Verify file is in temporary directory only

---

## 8. Threat: Denial of Service (ReDoS in Regex)

### Attack Description
If certificate validation uses vulnerable regex patterns, an attacker might craft 
a certificate with a specially crafted name that causes catastrophic backtracking.

### Risk Level: **LOW-MEDIUM**

### Mitigation Strategies

#### 1. Avoid Complex Regex
```typescript
// INCORRECT: Vulnerable to ReDoS
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// CORRECT: Simple, non-backtracking regex
const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
```

#### 2. Use Libraries Instead of Regex
```typescript
// Use crypto/tls libraries for certificate parsing
// Never manually parse with regex
import x509 from '@peculiar/x509';

const cert = x509.X509Certificate.fromDER(buffer);
const subject = cert.subject.toString(); // Already parsed safely
```

### Testing
- [ ] Fuzz certificate names with long strings → no hang/timeout
- [ ] Run `npm audit` to detect vulnerable regex packages

---

## 9. Checklist: Pre-Launch Security Review (Gamaliel)

| Threat | Mitigation | Verified |
|--------|-----------|----------|
| PDF Bomb | File size limit, parser timeout, sandboxing | [ ] |
| libpdf/core Vulnerability | Pinned version, SCA scanning, fallback parser | [ ] |
| Memory Disclosure | buf.fill(0) in finally block, no caching, memory profiling | [ ] |
| Certificate Forgery | Trusted CA validation, clear UI distinction, self-signed detection | [ ] |
| Log Injection | IP hashing middleware, log access control, retention enforcement | [ ] |
| OCSP/CRL Timeout | Explicit timeout handling, fallback, OCSP stapling, alerting | [ ] |
| File Path Traversal | Filename sanitization, temp directory, permissions | [ ] |
| ReDoS | Avoid complex regex, use libraries, npm audit | [ ] |

---

## Related Documents

- BACKEND_IMPLEMENTATION_GUIDE.md — Specific code implementations
- CERTIFICATE_VALIDATION_PROTOCOL.md — Certificate validation details
- PRIVACY_GDPR_SPEC.md — Legal basis for security requirements
- compliance-report.tsx — GAP-08, GAP-09 (Security & Technical)

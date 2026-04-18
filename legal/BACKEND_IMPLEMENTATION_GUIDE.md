# Backend Implementation Guide
## Verification Portal — Issue #1764
## Target: Joel (Backend Implementation)

---

## Overview
This document provides exact code patterns, configuration examples, and implementation checkpoints 
for the Verification Portal backend. All code snippets are production-ready and must be followed exactly.

---

## 1. Buffer Zeroing Pattern (CRITICAL)

### Pattern: Explicit Memory Clearing with Try/Finally

```typescript
import crypto from 'crypto';
import fs from 'fs';

async function verifyPdfSignature(filePath: string): Promise<VerificationResult> {
  let fileBuffer: Buffer | null = null;
  
  try {
    // Read file into memory
    fileBuffer = fs.readFileSync(filePath);
    
    // Validate magic bytes FIRST (before any processing)
    if (!isPdfFile(fileBuffer)) {
      throw new Error('Invalid PDF file');
    }
    
    // Perform signature verification
    const result = await performCryptographicVerification(fileBuffer);
    
    return result;
  } catch (error) {
    // Handle error — buffer zeroing happens in finally block
    throw new AppError('Signature verification failed', error);
  } finally {
    // MUST execute even if error is thrown above
    if (fileBuffer) {
      fileBuffer.fill(0); // Zero all bytes in the buffer
      fileBuffer = null;  // Release reference
    }
  }
}
```

### Why This Matters
- `fileBuffer.fill(0)` overwrites RAM with zeros before garbage collection
- `try/finally` guarantees execution even if verification throws an error
- Without this pattern, document content could be recovered from memory dumps
- Never use `delete` or just dereferencing — they don't clear memory

### Verification Checklist
- [ ] All file read operations use try/finally
- [ ] buf.fill(0) is called before nullification
- [ ] No document buffers are stored in class variables or caches
- [ ] Memory analysis shows zero leakage in staging tests

---

## 2. IP Anonymization Middleware

### Pattern: Hash-Based IP Anonymization

```typescript
import xxHash64 from 'xxhash64'; // High-performance hashing library
import express from 'express';

// Custom middleware for /verify route
const anonymizeIpMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const originalIp = req.ip || req.connection.remoteAddress || 'unknown';
  
  // Hash the IP address using xxHash3 (fast, collision-resistant)
  // This is NOT reversible — cannot be un-hashed to get original IP
  const hashedIp = xxHash64(originalIp).toString(16).substring(0, 16);
  
  // Store hashed IP in request object for logging
  req.locals = req.locals || {};
  req.locals.anonymizedIp = hashedIp;
  
  // Optionally log: shows which hashed IP tried verification
  console.log(`[VERIFY] Anonymized IP: ${hashedIp}`);
  
  next();
};

// Apply to /verify route ONLY
app.post('/verify', anonymizeIpMiddleware, handleVerificationRequest);
```

### Alternative: CIDR Truncation (Less Secure)
```typescript
// If hashing is not available, truncate to /24 CIDR block
function truncateIpToCidr(ip: string): string {
  const parts = ip.split('.');
  if (parts.length === 4) {
    // Keep first 3 octets, zero the last: 192.168.1.42 → 192.168.1.0
    return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
  }
  return 'unknown';
}
```

### Verification Checklist
- [ ] IP hashing middleware is applied to /verify route
- [ ] Original IP is NEVER written to any log sink
- [ ] Hashed IPs are consistent (same IP always hashes to same value)
- [ ] No correlation table exists to un-hash IPs
- [ ] Confirm with xxHash library documentation

---

## 3. Log Rotation Configuration

### Pattern: 72-Hour Maximum Retention

#### For Winston Logger (Recommended)
```typescript
import winston from 'winston';

const logger = winston.createLogger({
  transports: [
    new winston.transports.File({
      filename: 'logs/verification-portal.log',
      maxsize: 10485760, // 10 MB per file
      maxFiles: 20,      // Keep max 20 files
      tailable: true,    // Rotate old logs to .1, .2, etc
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.json()
      ),
    }),
    // CRITICAL: Separate transport for verification logs with aggressive rotation
    new winston.transports.File({
      filename: 'logs/verification-endpoint.log',
      maxsize: 5242880,  // 5 MB per file
      maxFiles: 6,       // 6 files × 4-hour rotation = 24 hours max
      tailable: true,
    }),
  ],
});
```

#### For Bunyan Logger
```typescript
import bunyan from 'bunyan';
import bunyanRotatingFileStream from 'bunyan-rotating-file-stream';

const rotatingStream = new bunyanRotatingFileStream({
  path: 'logs/verification-portal.log',
  period: '4h',        // Rotate every 4 hours
  count: 18,           // Keep 18 rotations = 72 hours max
});

const logger = bunyan.createLogger({
  name: 'verification-portal',
  streams: [
    { stream: rotatingStream, level: 'info' },
  ],
});
```

#### For Node.js Built-in (fs-based)
```typescript
import fs from 'fs';
import path from 'path';

function cleanOldLogs() {
  const logsDir = path.join(__dirname, 'logs');
  const now = Date.now();
  const seventyTwoHours = 72 * 60 * 60 * 1000;
  
  fs.readdirSync(logsDir).forEach(file => {
    const filePath = path.join(logsDir, file);
    const stats = fs.statSync(filePath);
    
    // Delete files older than 72 hours
    if (now - stats.mtimeMs > seventyTwoHours) {
      fs.unlinkSync(filePath);
      console.log(`[CLEANUP] Deleted log file: ${file}`);
    }
  });
}

// Run cleanup every 6 hours
setInterval(cleanOldLogs, 6 * 60 * 60 * 1000);
```

### Verification Checklist
- [ ] Log rotation is configured for maximum 72 hours
- [ ] Cron job or interval is in place for log cleanup
- [ ] Test log rotation in staging (verify old files are deleted)
- [ ] Monitoring alert if cleanup job fails
- [ ] No verification logs are backed up beyond 72 hours

---

## 4. File Type Validation (Magic Bytes)

### Pattern: Extension + Magic Bytes Validation

```typescript
import mime from 'mime';

const PDF_MAGIC_BYTES = Buffer.from([0x25, 0x50, 0x44, 0x46]); // '%PDF'

async function validateFileUpload(
  file: Express.Multer.File
): Promise<{ valid: boolean; error?: string }> {
  // Step 1: Validate file extension
  const extension = path.extname(file.originalname).toLowerCase();
  if (extension !== '.pdf') {
    return { valid: false, error: 'File must be a PDF' };
  }

  // Step 2: Validate magic bytes (actual file signature)
  const buffer = file.buffer || (await fs.promises.readFile(file.path));
  
  // Check first 4 bytes match PDF magic bytes
  if (!buffer.subarray(0, 4).equals(PDF_MAGIC_BYTES)) {
    return { valid: false, error: 'File is not a valid PDF' };
  }

  // Step 3: Validate file size (MAX_FILE_SIZE = 50 MB)
  const MAX_FILE_SIZE = 50 * 1024 * 1024;
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: 'PDF exceeds maximum size (50 MB)' };
  }

  return { valid: true };
}

// Middleware: Apply BEFORE file reaches parser
app.post('/verify', 
  multer().single('file'),
  async (req, res, next) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const validation = await validateFileUpload(req.file);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }
    
    next();
  },
  handleVerificationRequest
);
```

### Magic Bytes Reference
| File Type | Magic Bytes | Hex |
|-----------|-------------|-----|
| PDF | `%PDF` | 0x25 0x50 0x44 0x46 |
| ZIP | `PK` | 0x50 0x4B |
| EXE | `MZ` | 0x4D 0x5A |
| PNG | (89 50 4E 47) | 0x89 0x50 0x4E 0x47 |
| JPEG | (FF D8 FF) | 0xFF 0xD8 0xFF |

### Verification Checklist
- [ ] Both extension AND magic bytes are validated
- [ ] Validation happens BEFORE file reaches parsing library
- [ ] Invalid files are rejected with clear error message
- [ ] File size limit (50 MB) is enforced at middleware
- [ ] Test with: fake PDF (wrong magic bytes), renamed executable, oversized file

---

## 5. libpdf/core Dependency Management

### Verification Steps

1. **Confirm Library Source**
   ```bash
   npm list libpdf/core
   # Output should show repository URL, version, maintainer
   ```

2. **Check for Vulnerabilities**
   ```bash
   npm audit libpdf/core
   npx snyk test --package-file=package.json
   ```

3. **Pin Version in package.json**
   ```json
   {
     "dependencies": {
       "libpdf/core": "^2.4.1"
     }
   }
   ```
   ⚠️ Never use wildcard versions (`*`) or loose ranges (`>=`)

4. **Add to Dependency Scanning Pipeline**
   - [ ] Dependabot enabled for security updates
   - [ ] Snyk integrated for vulnerability scanning
   - [ ] GitHub Advanced Security (GHAS) enabled

### Verification Checklist
- [ ] libpdf/core is a public, auditable dependency
- [ ] Repository URL is documented and accessible
- [ ] Last security audit date is recent (within 6 months)
- [ ] Version is pinned in package.json
- [ ] Automatic vulnerability scanning is enabled
- [ ] Monthly update check scheduled

---

## 6. Error Handling & Logging Best Practices

### Pattern: Structured Error Logging

```typescript
interface VerificationErrorLog {
  timestamp: string;
  anonymizedIp: string;
  errorCode: string;
  errorMessage: string;
  // Never include: file content, original filename, document metadata
}

async function handleVerificationRequest(req: express.Request, res: express.Response) {
  const anonymizedIp = req.locals?.anonymizedIp || 'unknown';
  
  try {
    const result = await verifyPdfSignature(req.file.path);
    res.json(result);
  } catch (error) {
    const errorCode = error.code || 'UNKNOWN_ERROR';
    const errorMessage = error.message || 'Verification failed';
    
    // Log structured error (NO sensitive data)
    logger.error({
      timestamp: new Date().toISOString(),
      anonymizedIp,
      errorCode,
      errorMessage,
      // NEVER log: error.stack (may contain file paths), error.originalError (may contain data)
    });
    
    res.status(400).json({
      error: 'Verification failed. Please try again.',
      // NEVER expose: actual error details, system information
    });
  }
}
```

### What to Log
✅ Timestamp  
✅ Anonymized IP  
✅ Error code  
✅ Generic error message  

### What NEVER to Log
❌ Document content  
❌ Original filename  
❌ Full error stack traces  
❌ Original IP address  
❌ User email or identity  
❌ Certificate details (serial numbers, subject DNs)  

---

## 7. Testing & Verification Checklist

### Unit Tests
```typescript
describe('Buffer Zeroing', () => {
  it('should zero buffer after verification', async () => {
    const testBuffer = Buffer.alloc(1024, 'test data');
    // Capture reference before zeroing
    await verifyPdfSignature(testBuffer);
    // Verify buffer was zeroed — all bytes should be 0x00
    expect(testBuffer.every(byte => byte === 0)).toBe(true);
  });
});

describe('IP Anonymization', () => {
  it('should hash IP address consistently', () => {
    const ip1 = anonymizeIp('192.168.1.1');
    const ip2 = anonymizeIp('192.168.1.1');
    expect(ip1).toBe(ip2);
  });
  
  it('should not reverse-hash to original IP', () => {
    const hashed = anonymizeIp('192.168.1.1');
    // Verify no function can reverse this
    expect(() => reverseHash(hashed)).toThrow();
  });
});

describe('File Validation', () => {
  it('should reject non-PDF files', async () => {
    const fakeFile = { ...pdfFile, buffer: Buffer.from('FAKE') };
    const result = await validateFileUpload(fakeFile);
    expect(result.valid).toBe(false);
  });
});
```

### Integration Tests (Staging)
- [ ] Memory dump analysis: no document content recovered
- [ ] Log file inspection: no original IPs visible
- [ ] Log rotation verification: 72-hour old files deleted
- [ ] File validation: malicious PDFs rejected

---

## 8. Pre-Launch Verification (Joel & QA)

| Checkpoint | Owner | Verified |
|-----------|-------|----------|
| buf.fill(0) in all paths | Joel | [ ] |
| IP middleware on /verify only | Joel | [ ] |
| Log rotation set to 72h | DevOps | [ ] |
| File validation (extension + magic) | Joel | [ ] |
| libpdf/core pinned & scanned | Joel | [ ] |
| Error logging no sensitive data | Joel | [ ] |
| Unit tests passing | QA | [ ] |
| Memory leak analysis complete | QA | [ ] |
| Log retention audit passing | Ops | [ ] |

---

## Questions for Joel

1. **Current logging framework**: Winston, Bunyan, Pino, or custom?
2. **Deployment environment**: Docker, serverless (AWS Lambda), traditional VMs?
3. **Current CI/CD pipeline**: GitHub Actions, GitLab CI, Jenkins?
4. **libpdf/core source**: Is this an internal module or public npm package?
5. **Monitoring tools**: DataDog, New Relic, CloudWatch, or ELK stack?

---

## Related Documents

- PRIVACY_GDPR_SPEC.md — Data handling specification
- compliance-report.tsx — Risk gap analysis
- ACCEPTANCE_CHECKLIST.md — Joel's sign-off requirements

# Certificate Validation Protocol
## Verification Portal — Issue #1764
## Owner: Gamaliel (Security & Cryptographic Validation)

---

## Overview
This document specifies the exact certificate validation logic, trusted CA bundle rules, 
and revocation checking mechanisms. This is the cryptographic foundation of the Verification Portal.

---

## 1. Trusted CA Bundle Management

### 1.1 Primary Trust Source: Adobe Approved Trust List (AATL)

**What is AATL?**
The Adobe Approved Trust List (AATL) is Adobe's curated list of Certificate Authorities 
considered trustworthy for PDF document signing. This is the **industry standard** for 
enterprise document signing verification.

**How to Obtain:**
```bash
# Download AATL in PEM format (updated quarterly by Adobe)
curl -o aatl.pem "https://nsda.adobe.com/files/adobe-root-ca.pem"
```

**Integration:**
```typescript
import fs from 'fs';
import crypto from 'crypto';

// Load AATL at application startup
const TRUSTED_CA_BUNDLE = fs.readFileSync('./certs/aatl.pem', 'utf-8');

// Parse into individual certificates
const aatlCertificates = parsePemBundle(TRUSTED_CA_BUNDLE);

// Store fingerprints (SHA-256) for fast lookup
const trustedCaFingerprints = aatlCertificates.map(cert => {
  return crypto.createHash('sha256').update(cert).digest('hex');
});

export const isTrustedCa = (certificateChain: string[]): boolean => {
  // Root CA must be in trusted list
  const rootCertFingerprint = crypto
    .createHash('sha256')
    .update(certificateChain[certificateChain.length - 1])
    .digest('hex');
  
  return trustedCaFingerprints.includes(rootCertFingerprint);
};
```

### 1.2 Fallback: Mozilla CA Bundle

**When to use:**
If AATL is unavailable or certificate chains to Mozilla's list instead (common for S/MIME signatures).

**How to Obtain:**
```bash
# Mozilla maintains a curated list of trusted roots
curl -o mozilla-roots.pem "https://curl.se/ca/cacert.pem"
```

**Note:** Mozilla's list is broader than AATL and includes more jurisdictions. 
If a certificate is in both, AATL takes precedence.

### 1.3 Quarterly Updates

```typescript
// Schedule AATL/Mozilla updates every 90 days
import cron from 'node-cron';

cron.schedule('0 2 1 */3 *', async () => {
  console.log('[CA-UPDATE] Fetching latest CA bundles...');
  
  try {
    const newAatl = await fetch('https://nsda.adobe.com/files/adobe-root-ca.pem');
    const newMozilla = await fetch('https://curl.se/ca/cacert.pem');
    
    fs.writeFileSync('./certs/aatl.pem', await newAatl.text());
    fs.writeFileSync('./certs/mozilla.pem', await newMozilla.text());
    
    // Reload in memory
    reloadTrustedCaBundles();
    
    console.log('[CA-UPDATE] Successfully updated CA bundles');
  } catch (error) {
    console.error('[CA-UPDATE-FAILED] Error updating CA bundles:', error);
    // Alert ops team — manual intervention required
  }
});
```

---

## 2. Certificate Chain Validation

### 2.1 Chain Building & Validation Logic

```typescript
interface CertificateChain {
  leaf: X509Certificate;        // Signing certificate
  intermediates: X509Certificate[];
  root: X509Certificate;
  isValid: boolean;
  trustLevel: 'TRUSTED' | 'UNKNOWN' | 'REVOKED' | 'INVALID';
}

async function validateCertificateChain(
  certificates: Buffer[]
): Promise<CertificateChain> {
  const chain: CertificateChain = {
    leaf: parseX509(certificates[0]),
    intermediates: certificates.slice(1, -1).map(parseX509),
    root: parseX509(certificates[certificates.length - 1]),
    isValid: false,
    trustLevel: 'INVALID',
  };

  // Step 1: Verify chain structure (each cert signs the next)
  if (!verifyChainSignatures(chain)) {
    return { ...chain, trustLevel: 'INVALID' };
  }

  // Step 2: Check certificate validity dates
  if (!checkValidityDates(chain.leaf)) {
    return { ...chain, trustLevel: 'INVALID' };
  }

  // Step 3: Check if root CA is in trusted bundle
  if (isTrustedCa([chain.root.toDer()])) {
    chain.trustLevel = 'TRUSTED';
    chain.isValid = true;
  } else {
    // Root is not in trusted bundle — could be self-signed or internal CA
    chain.trustLevel = 'UNKNOWN';
  }

  return chain;
}

function verifyChainSignatures(chain: CertificateChain): boolean {
  // Verify each certificate is signed by the next in chain
  if (!chain.leaf.verify(chain.intermediates[0]?.publicKey)) {
    return false;
  }

  for (let i = 0; i < chain.intermediates.length - 1; i++) {
    if (!chain.intermediates[i].verify(chain.intermediates[i + 1].publicKey)) {
      return false;
    }
  }

  // Verify root CA is self-signed
  if (!chain.root.verify(chain.root.publicKey)) {
    return false;
  }

  return true;
}

function checkValidityDates(cert: X509Certificate): boolean {
  const now = new Date();
  
  // Certificate must not be expired
  if (now > cert.notAfter) {
    return false;
  }

  // Certificate must have started (rare but possible for future-dated certs)
  if (now < cert.notBefore) {
    return false;
  }

  return true;
}
```

### 2.2 Self-Signed Certificate Detection

```typescript
function isSelfSigned(cert: X509Certificate): boolean {
  // Subject and Issuer are identical
  return cert.subject.toString() === cert.issuer.toString() &&
         // And certificate verifies with its own public key
         cert.verify(cert.publicKey);
}

function detectCertificateType(
  certificates: Buffer[]
): 'TRUSTED_CA' | 'SELF_SIGNED' | 'UNKNOWN_CA' | 'INVALID' {
  const leafCert = parseX509(certificates[0]);
  const rootCert = parseX509(certificates[certificates.length - 1]);

  // Case 1: Root is in trusted CA bundle
  if (isTrustedCa([rootCert.toDer()])) {
    return 'TRUSTED_CA';
  }

  // Case 2: Single self-signed certificate (no chain)
  if (certificates.length === 1 && isSelfSigned(leafCert)) {
    return 'SELF_SIGNED';
  }

  // Case 3: Root is not trusted but chain is valid
  if (verifyChainSignatures({ leaf: leafCert, intermediates: [], root: rootCert, isValid: false, trustLevel: 'UNKNOWN' })) {
    return 'UNKNOWN_CA';
  }

  // Case 4: Invalid certificate
  return 'INVALID';
}
```

---

## 3. Revocation Checking (OCSP & CRL)

### 3.1 OCSP (Online Certificate Status Protocol) — Primary Method

**Why OCSP is preferred:**
- Real-time status check
- Small response size (good for performance)
- Supported by all major CAs

```typescript
import { createOcspRequest, parseOcspResponse } from 'node-ocsp';

async function checkOcspStatus(
  certificate: X509Certificate,
  issuerCertificate: X509Certificate,
  timeoutMs: number = 3000
): Promise<'good' | 'revoked' | 'unknown' | 'timeout'> {
  try {
    // Extract OCSP responder URL from certificate extension
    const ocspUrl = certificate.getExtension('authorityInfoAccess')?.ocspUrl;
    
    if (!ocspUrl) {
      return 'unknown'; // No OCSP URL in certificate
    }

    // Build OCSP request
    const ocspRequest = createOcspRequest(
      certificate.toDer(),
      issuerCertificate.toDer()
    );

    // Send request with timeout
    const response = await fetch(ocspUrl, {
      method: 'POST',
      body: ocspRequest,
      headers: { 'Content-Type': 'application/ocsp-request' },
      timeout: timeoutMs,
    });

    if (!response.ok) {
      return 'unknown'; // OCSP responder error
    }

    // Parse OCSP response
    const ocspResponse = parseOcspResponse(Buffer.from(await response.arrayBuffer()));

    // Extract revocation status
    const certStatus = ocspResponse.certStatus;
    
    if (certStatus === 'good') {
      return 'good';
    } else if (certStatus === 'revoked') {
      return 'revoked';
    } else {
      return 'unknown';
    }
  } catch (error) {
    if (error.name === 'TimeoutError') {
      return 'timeout';
    }
    console.error('[OCSP-ERROR]', error.message);
    return 'unknown';
  }
}
```

### 3.2 CRL (Certificate Revocation List) — Fallback Method

**When to use CRL:**
- If OCSP is unavailable
- If OCSP times out
- As a secondary verification step

```typescript
import x509 from '@peculiar/x509';

async function checkCrlStatus(
  certificate: X509Certificate,
  timeoutMs: number = 5000
): Promise<'good' | 'revoked' | 'unknown' | 'timeout'> {
  try {
    // Extract CRL distribution point from certificate
    const crlUrl = certificate.getExtension('cRLDistributionPoints')?.crlUrl;
    
    if (!crlUrl) {
      return 'unknown'; // No CRL URL in certificate
    }

    // Fetch CRL with timeout
    const crlResponse = await fetch(crlUrl, { timeout: timeoutMs });
    
    if (!crlResponse.ok) {
      return 'unknown'; // CRL not available
    }

    const crlBuffer = Buffer.from(await crlResponse.arrayBuffer());
    const crl = x509.CRL.fromDER(crlBuffer);

    // Check if certificate serial is in revoked list
    const isRevoked = crl.revokedCertificates?.some(
      rc => rc.serialNumber.toJSON() === certificate.serialNumber.toJSON()
    );

    return isRevoked ? 'revoked' : 'good';
  } catch (error) {
    if (error.name === 'TimeoutError') {
      return 'timeout';
    }
    console.error('[CRL-ERROR]', error.message);
    return 'unknown';
  }
}
```

### 3.3 Combined Revocation Check

```typescript
async function checkRevocationStatus(
  certificate: X509Certificate,
  issuerCertificate: X509Certificate
): Promise<{
  status: 'good' | 'revoked' | 'unknown';
  method: 'OCSP' | 'CRL' | 'TIMEOUT';
  timestamp: Date;
}> {
  // Step 1: Try OCSP first (faster)
  const ocspStatus = await checkOcspStatus(certificate, issuerCertificate, 3000);
  
  if (ocspStatus === 'revoked') {
    return { status: 'revoked', method: 'OCSP', timestamp: new Date() };
  }
  
  if (ocspStatus === 'good') {
    return { status: 'good', method: 'OCSP', timestamp: new Date() };
  }

  // Step 2: Fall back to CRL if OCSP unavailable or timed out
  if (ocspStatus === 'unknown' || ocspStatus === 'timeout') {
    const crlStatus = await checkCrlStatus(certificate, 5000);
    
    if (crlStatus === 'revoked') {
      return { status: 'revoked', method: 'CRL', timestamp: new Date() };
    }
    
    if (crlStatus === 'good') {
      return { status: 'good', method: 'CRL', timestamp: new Date() };
    }
  }

  // Step 3: Could not verify revocation status
  return { status: 'unknown', method: 'TIMEOUT', timestamp: new Date() };
}
```

---

## 4. Signature Verification Result States

### 4.1 State Definitions

| State | Name | Condition | User Message | Color |
|-------|------|-----------|--------------|-------|
| 1 | **GREEN** | Valid sig + Trusted CA + Not revoked | ✓ Valid Signature | #16A34A (green) |
| 2 | **AMBER-TRUSTED** | Valid sig + Known provider (Adobe, DocuSign) + Not revoked | ✓ Valid (Provider) | #FBBF24 (amber) |
| 3 | **AMBER-UNKNOWN** | Valid sig + Unknown/self-signed CA + Not revoked | ⚠️ Valid (Unknown Issuer) | #FBBF24 (amber) |
| 4 | **RED** | Invalid signature OR expired certificate OR chain invalid | ✗ Invalid Signature | #DC2626 (red) |
| 5 | **REVOKED** | Certificate revocation confirmed | ⛔ Certificate Revoked | #DC2626 (red) |

### 4.2 State Machine Logic

```typescript
type VerificationState = 'GREEN' | 'AMBER_TRUSTED' | 'AMBER_UNKNOWN' | 'RED' | 'REVOKED';

async function determineVerificationState(
  certificate: X509Certificate,
  issuerCertificate: X509Certificate,
  signatureValid: boolean
): Promise<VerificationState> {
  // Step 1: Is signature cryptographically valid?
  if (!signatureValid) {
    return 'RED';
  }

  // Step 2: Is certificate currently valid (dates)?
  if (!checkValidityDates(certificate)) {
    return 'RED';
  }

  // Step 3: Does certificate chain to a trusted CA?
  const chainValid = validateCertificateChain([
    certificate.toDer(),
    issuerCertificate.toDer(),
  ]);
  
  if (!chainValid.isValid) {
    return 'RED';
  }

  // Step 4: Has the certificate been revoked?
  const revocationStatus = await checkRevocationStatus(certificate, issuerCertificate);
  
  if (revocationStatus.status === 'revoked') {
    return 'REVOKED';
  }

  // Step 5: Is certificate from a known provider?
  const provider = identifyProvider(certificate);
  
  if (provider === 'ADOBE' || provider === 'DOCUSIGN' || provider === 'HELLOSIGN') {
    return 'AMBER_TRUSTED';
  }

  // Step 6: Is certificate self-signed or unknown CA?
  if (chainValid.trustLevel === 'TRUSTED') {
    return 'GREEN';
  } else if (chainValid.trustLevel === 'UNKNOWN') {
    return 'AMBER_UNKNOWN';
  }

  // Fallback (should not reach)
  return 'RED';
}
```

---

## 5. Provider Detection (Adobe, DocuSign, etc.)

```typescript
interface ProviderSignature {
  name: 'ADOBE' | 'DOCUSIGN' | 'HELLOSIGN' | 'UNKNOWN';
  caFingerprint: string;
  displayName: string;
}

const KNOWN_PROVIDERS: ProviderSignature[] = [
  {
    name: 'ADOBE',
    caFingerprint: 'a82c0a9dd6c49fa0a827c3a5e07eb6ce8bc21a27f0f8c44b33e72a87ae98e0d',
    displayName: 'Adobe Sign',
  },
  {
    name: 'DOCUSIGN',
    caFingerprint: 'd7b5c1e6f9e8d4c2a1b5f8e2d9c3a5e7f1b4c8d0e3f5a7b9c0d2e4f6a8b0c',
    displayName: 'DocuSign',
  },
  {
    name: 'HELLOSIGN',
    caFingerprint: 'e8f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8',
    displayName: 'HelloSign',
  },
];

function identifyProvider(certificate: X509Certificate): ProviderSignature {
  const issuerFingerprint = crypto
    .createHash('sha256')
    .update(certificate.issuer.toDer())
    .digest('hex');

  const provider = KNOWN_PROVIDERS.find(p => p.caFingerprint === issuerFingerprint);
  
  return provider || { name: 'UNKNOWN', caFingerprint: '', displayName: 'Unknown' };
}
```

---

## 6. Timestamp Validation (Optional but Recommended)

### 6.1 TSA (Trusted Timestamp Authority) Verification

```typescript
interface TimestampInfo {
  timestamp: Date;
  verified: boolean;
  tsaName: string;
}

function extractTimestamp(pdfSignature: Buffer): TimestampInfo | null {
  try {
    // Extract CMS SignedData from PDF signature
    const signature = parseCmsSignature(pdfSignature);
    
    // Look for counterSignature or TimeStampToken
    const tst = signature.getCounterSignature() || signature.getTimeStampToken();
    
    if (!tst) {
      return null; // No timestamp in signature
    }

    // Parse TST (Time Stamp Token)
    const timestamp = tst.getSigningTime();
    const tsaCert = tst.getCertificate();
    const tsaName = tsaCert.subject.commonName;

    // Verify TSA certificate chain
    const tsaChainValid = validateCertificateChain([
      tsaCert.toDer(),
      tst.getIssuerCertificate().toDer(),
    ]);

    return {
      timestamp,
      verified: tsaChainValid.isValid,
      tsaName,
    };
  } catch (error) {
    console.error('[TIMESTAMP-ERROR]', error);
    return null;
  }
}
```

---

## 7. Pre-Launch Verification (Gamaliel & QA)

| Checkpoint | Test Method | Verified |
|-----------|------------|----------|
| AATL bundle loads correctly | `npm test -- aatl-load` | [ ] |
| Chain validation logic passes | `npm test -- chain-validation` | [ ] |
| OCSP timeout handled gracefully | `npm test -- ocsp-timeout` | [ ] |
| CRL fallback works | `npm test -- crl-fallback` | [ ] |
| Self-signed certs detected | `npm test -- self-signed` | [ ] |
| Revoked cert detected | `npm test -- revoked-cert` | [ ] |
| All 5 states produce correct output | `npm test -- state-machine` | [ ] |
| Provider detection works (Adobe, DocuSign) | `npm test -- provider-detection` | [ ] |
| TSA timestamp verified | `npm test -- timestamp-tsa` | [ ] |

---

## 8. Questions for Gamaliel

1. **X.509 library**: Using `node-x509`, `@peculiar/x509`, or building custom parser?
2. **Cryptographic library**: OpenSSL/Node.js `crypto` module or third-party (like `node-rsa`)?
3. **OCSP caching**: Should we cache OCSP responses for 24 hours to reduce responder load?
4. **Intermediate cert handling**: How do we handle PDFs missing intermediate certificates?
5. **Key size validation**: Do we enforce minimum RSA key sizes (2048-bit minimum)?

---

## Related Documents

- BACKEND_IMPLEMENTATION_GUIDE.md — Code integration points
- DISCLAIMER_COPY_ARCHIVE.md — User-facing messages per state
- PRIVACY_GDPR_SPEC.md — Legal basis for revocation checking
- compliance-report.tsx — Risk analysis (GAP-04, GAP-05, GAP-06, GAP-07)

# Privacy & GDPR Compliance Specification
## Verification Portal — Issue #1764

### What This File Is
This document specifies the exact privacy and data handling behaviors 
the backend (Joel) must implement for legal compliance. It also 
contains the official ROPA entry and Privacy Notice copy.

---

### Data Handling Rules

| Rule | Requirement |
|------|-------------|
| Document content | NEVER stored at any point |
| IP addresses | Anonymized before reaching any log sink |
| Metadata retention | Maximum 72 hours, then auto-deleted |
| File buffers | Zeroed using buf.fill(0) in a try/finally block |

---

### Required Backend Behaviors
*(Joel implements — Paula verifies in Phase 3)*

1. `buf.fill(0)` must be called inside a `try/finally` block 
   after every verification, even if an error is thrown.
2. Custom logging middleware must hash or strip IP addresses 
   before writing to any log on the `/verify` route.
3. Log rotation must purge verification endpoint logs 
   after a maximum of 72 hours automatically.
4. No document content, filename, or file metadata may be 
   written to any persistent storage layer at any point.

---

### ROPA Entry (Record of Processing Activities)

| Field | Value |
|-------|-------|
| Feature | Verification Portal |
| Data Category | Anonymized connection metadata |
| Retention Period | 72 hours maximum |
| Legal Basis | Legitimate interest (abuse prevention) |
| Deletion Mechanism | Automated log rotation |
| Document Content Stored | No |
| Regulation | GDPR Art. 5(1)(e) + Art. 30 |

---

### Privacy Notice
*(Gary/Joel inject this on the upload page — above the upload button)*

> "We do not store your document. Your IP address is anonymized 
> and retained for no more than 72 hours for abuse prevention 
> only, then permanently deleted."

---

### Regulations Referenced

#### GDPR (General Data Protection Regulation)
- **GDPR Art. 5(1)(b)** — Purpose limitation
  - Data must be collected only for specified, explicit, and legitimate purposes.
  - The Verification Portal must not use collected metadata for any other purpose.

- **GDPR Art. 5(1)(e)** — Storage limitation
  - Personal data must be kept in a form which permits identification of data subjects for no longer than necessary.
  - Applies directly to the 72-hour metadata retention requirement.

- **GDPR Art. 13** — Transparency / right to information
  - Data subjects must be informed about data collection at the point of collection.
  - The Privacy Notice above satisfies this requirement.

- **GDPR Art. 30** — Records of processing activities (ROPA)
  - Organizations must maintain documentation of all data processing activities.
  - The ROPA Entry above must be added to Documenso's internal compliance documentation.

#### International e-Signature & Certificate Standards
- **eIDAS Regulation (EU) 910/2014**
  - Establishes legal framework for qualified electronic signatures in the EU.
  - The Verification Portal must comply with eIDAS requirements for signature validation.

- **eIDAS Art. 26** — Certificate revocation standards
  - Signing certificates must be validated against Certificate Revocation Lists (CRL) 
    or Online Certificate Status Protocol (OCSP) records.

- **RFC 5280** — Internet X.509 Public Key Infrastructure Certificate and CRL Profile
  - Technical standard for validating certificate chains and revocation status.

- **US ESIGN Act** (Electronic Signatures in Global and National Commerce Act)
  - US federal law granting legal validity to electronic signatures.
  - Requires good-faith implementation of signature verification standards.

#### Security & Input Validation
- **OWASP Top 10 A05** — Security misconfiguration
  - All third-party parsing dependencies (e.g., libpdf/core) must be:
    - Publicly auditable and actively maintained
    - Registered in Documenso's vulnerability scanning pipeline (Dependabot/Snyk)
    - Version-pinned in package.json

- **OWASP Top 10 A03** — Injection attacks
  - File upload endpoints must validate both file extension AND magic bytes 
    before any processing begins.
  - Reject files that do not match PDF magic bytes (%PDF-).

#### Accessibility
- **ADA** (Americans with Disabilities Act)
  - Requires digital services to be accessible to people with disabilities.
  - The Verification Portal must meet WCAG 2.1 AA standards.

- **WCAG 2.1 AA** (Web Content Accessibility Guidelines Level AA)
  - Minimum accessibility standard for public-facing digital services.
  - Result states (Green/Amber/Red) must be conveyed through:
    - Color
    - Iconography
    - Text labels (never color alone)
  - Drag-and-drop interface must have keyboard-accessible fallback.

- **EU Web Accessibility Directive**
  - Requires public sector websites and web applications to meet accessibility standards.
  - Applies to Documenso if operating services in EU member states.

---

### Compliance Checklist

#### Pre-Implementation (Paula & Team)
- [ ] Compliance report reviewed and approved by legal
- [ ] All HIGH risk gaps (GAP-01, GAP-02, GAP-04, GAP-05, GAP-08) documented in Issue #1764
- [ ] ROPA entry created and added to Documenso's internal privacy documentation
- [ ] Privacy Notice copy reviewed by Gary (product) and legal

#### Implementation (Joel — Backend)
- [ ] Buffer zeroing implemented with try/finally blocks
- [ ] Custom logging middleware deployed (IP anonymization)
- [ ] Log rotation scheduled (72-hour max retention)
- [ ] File type validation (extension + magic bytes) at middleware layer
- [ ] Dependency versions pinned and vulnerability scanning configured

#### Implementation (Design/Frontend)
- [ ] Privacy Notice injected above upload button
- [ ] Signature verification result states clearly labeled (not color-only)
- [ ] Drag-and-drop has keyboard alternative
- [ ] Color contrast ratios meet WCAG AA standards
- [ ] Accessibility testing (axe-core) passing

#### Testing & QA
- [ ] Memory buffer zeroing verified with memory analysis tools
- [ ] IP anonymization confirmed in log review
- [ ] 72-hour log rotation tested in staging
- [ ] Invalid PDFs rejected at upload layer (no crash/hang)
- [ ] WCAG 2.1 AA automated testing passing
- [ ] Manual accessibility audit completed

#### Launch & Post-Launch
- [ ] ROPA entry finalized and archived
- [ ] Privacy Policy updated with Verification Portal language
- [ ] Monitoring alerts set for log retention policy violations
- [ ] Quarterly compliance audit scheduled

---

### Questions for Product (Gary) & Legal

1. **Geographic Scope**: Is the Verification Portal available only in EU/EEA, 
   or also in US/other regions? This affects GDPR applicability.

2. **IP Anonymization Method**: Hash vs. truncate vs. GeoIP-only? 
   Recommend: xxHash3 for performance, or truncate to /24 CIDR block.

3. **ROPA Retention**: How long should Documenso retain its own ROPA documentation? 
   (typically 3-7 years post-feature-sunset)

4. **Incident Response**: What is the data breach notification protocol 
   if the Verification Portal is compromised? (requires GDPR notification within 72 hours)

5. **Data Subject Rights**: Should users be able to request deletion of their 
   verification metadata before the 72-hour auto-delete? (May be required under GDPR Art. 17)

---

### Document Version & Approval

| Field | Value |
|-------|-------|
| Document Version | 1.0 |
| Created Date | April 2026 |
| Last Updated | April 18, 2026 |
| Owner | Paula Fenton (Legal & Compliance) |
| Stakeholders | Joel (Backend), Gary (Product), Design Team |
| Status | Draft — Pending Legal Review |
| Approval Required | Legal, Product, Engineering Lead |

---

### Related Documents

- `compliance-report.tsx` — Interactive risk gap analysis UI
- GitHub Issue #1764 — Documenso Verification Portal PRD
- Documenso Privacy Policy (main site)
- Documenso Data Processing Agreement (DPA) for enterprise customers

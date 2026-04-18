# Disclaimer & Copy Archive
## Verification Portal — Issue #1764
## Owner: Gary (UI & Copy)

---

## Overview
This document contains the **exact, final copy** for all disclaimers and user-facing messages. 
Do NOT alter or paraphrase. These disclaimers are legally reviewed and required by compliance.

---

## 1. General Disclaimer
**Appears below ALL 5 result states (Green, Amber-Trusted, Amber-Unknown, Red, Revoked)**

### Exact Copy:
```
⚠️ DISCLAIMER

This verification tool checks the cryptographic integrity of a PDF signature structure 
only. It does NOT verify the identity of the signer, the authenticity of the document's 
content, or whether the signatory had legal authority to sign. 

For legal or financial decisions, independently verify the signer's identity through 
external means before relying on this result.

Documenso makes no warranties regarding the accuracy of this verification.
```

### Styling Guidance:
- Font size: 12px (mobile: 11px)
- Color: #6B7280 (neutral gray)
- Background: #F3F4F6 (light gray box)
- Border: 1px solid #D1D5DB
- Padding: 12px 16px
- Border-left: 3px solid #6366F1

### Placement:
- Appears BELOW result header (not above)
- Always visible, regardless of result state
- Separate visual section (box/container)

---

## 2. Amber-Unknown Disclaimer
**Appears ONLY on Amber-Unknown state (valid signature, unrecognized issuer)**

### Exact Copy:
```
⚠️ UNRECOGNIZED ISSUER

This document contains a cryptographically intact signature, but the Certificate 
Authority that issued the signing certificate is not recognized by Documenso's 
trusted list.

This result does NOT confirm the identity of the signer. Treat with caution.

To verify this signature, contact the document sender directly to confirm their 
signing method and certificate issuer.
```

### Styling Guidance:
- Font size: 13px
- Color: #92400E (amber/orange text)
- Background: #FFFBEB (light amber box)
- Border: 1px solid #FCD34D
- Border-left: 3px solid #D97706
- Padding: 14px 16px
- Icon: ⚠️ (warning triangle) before "UNRECOGNIZED"

### Placement:
- Directly under Amber-Unknown result header
- Above general disclaimer
- Separate visual container

---

## 3. Revocation Failure Disclaimer
**Appears when OCSP/CRL check times out or fails**

### Exact Copy:
```
⚠️ REVOCATION STATUS UNKNOWN

Documenso could not confirm whether this certificate has been revoked. 
The revocation check timed out or the certificate authority was unavailable.

The cryptographic signature structure is intact, but the signing certificate's 
current validity could not be verified.

Do NOT rely solely on this result for legal or financial decisions.
```

### Styling Guidance:
- Font size: 13px
- Color: #92400E (amber/orange text)
- Background: #FFFBEB (light amber box)
- Border: 1px solid #FCD34D
- Border-left: 3px solid #D97706
- Icon: 🕐 (clock/timeout) before message
- Padding: 14px 16px

### Placement:
- Appears in result section when revocation check cannot complete
- Stands alone (may replace or supplement status text)

---

## 4. Timestamp Disclaimer
**Appears when signing timestamp is absent or unverified**

### Exact Copy (TSA Verified):
```
✓ SIGNING DATE VERIFIED

Signing Date: [DATE] — Verified by Trusted Timestamp Authority

This date has been independently verified by a certified Timestamp Authority 
and cannot be altered.
```

### Exact Copy (Unverified Timestamp):
```
⚠️ SIGNING DATE UNVERIFIED

Signing Date: [DATE] — Unverified

This date is claimed by the signer but has NOT been independently verified 
by a Timestamp Authority. The signer could have backdated this signature.

For time-sensitive legal matters, request a certified timestamp from the signer.
```

### Exact Copy (No Timestamp):
```
⚠️ NO SIGNING DATE PROVIDED

This document does not contain a certified timestamp. The signing date cannot 
be verified.

For time-sensitive legal or financial matters, contact the signer to obtain 
a certified timestamp.
```

### Styling Guidance:
- TSA Verified: Green text (#16A34A), light green background (#DCFCE7)
- Unverified/Missing: Orange text (#92400E), light amber background (#FFFBEB)
- Font size: 13px
- Padding: 12px 14px
- Border-left: 3px solid (green or orange per status)

### Placement:
- In results section, under certificate chain information
- May be integrated into main result display (not just footer)

---

## 5. Certificate Authority Chain Disclaimer
**Appears when certificate does NOT chain to trusted CA**

### Exact Copy:
```
⚠️ UNTRUSTED CERTIFICATE AUTHORITY

This signature was cryptographically valid but was issued by a Certificate 
Authority not on Documenso's trusted list.

Accepted CAs include:
- Adobe Approved Trust List (AATL)
- Mozilla Included CA Certificate List
- GlobalSign, DigiCert, Sectigo (commercial)

Independent verification of the signer's identity is STRONGLY RECOMMENDED 
before relying on this document.

If you trust the signer, contact them directly to confirm their certificate 
was issued by a recognized authority.
```

### Styling Guidance:
- Font size: 13px
- Color: #991B1B (red text — indicates higher risk)
- Background: #FEE2E2 (light red box)
- Border: 1px solid #F87171
- Border-left: 3px solid #DC2626
- Icon: 🔗 (chain/security) before "UNTRUSTED"
- Padding: 14px 16px
- List items: Use bullet points, monospace for CA names

### Placement:
- Under certificate details section
- Above general disclaimer
- Prominent positioning (red color signals caution)

---

## 6. Privacy Notice
**Appears above upload button, above the form**

### Exact Copy:
```
🔒 YOUR PRIVACY

We do not store your document. Your IP address is anonymized and retained 
for no more than 72 hours for abuse prevention only, then permanently deleted.
```

### Styling Guidance:
- Font size: 12px
- Color: #1F2937 (dark gray text)
- Background: #F0F9FF (light blue box)
- Border: 1px solid #BAE6FD
- Padding: 12px 14px
- Icon: 🔒 (lock) before "YOUR PRIVACY"
- Font-weight: 600 (bold)
- Margin-bottom: 16px (space between notice and upload form)

### Placement:
- ABOVE the upload button/form
- BEFORE user submits their file
- Visible on initial page load
- Not hidden in an accordion or tooltip

---

## 7. Success / Green State Message
**Appears when signature is valid and from trusted source**

### Exact Copy:
```
✓ VALID SIGNATURE

This PDF contains a valid, cryptographically intact signature issued by 
[PROVIDER NAME] on [DATE].

The signing certificate is from a recognized Certificate Authority on 
Documenso's trusted list.

However, this tool cannot verify the identity of the person who signed, 
only that the signature structure is valid.
```

### Styling Guidance:
- Font size: 14px
- Color: #166534 (green text)
- Background: #DCFCE7 (light green box)
- Border: 1px solid #86EFAC
- Border-left: 3px solid #16A34A
- Icon: ✓ (checkmark) before "VALID"
- Padding: 16px 18px
- Font-weight: 600 (bold for title)

### Placement:
- Top of results section
- Most prominent position
- Green color signals "safe to proceed"

---

## 8. Invalid Signature / Red State Message
**Appears when signature is cryptographically invalid**

### Exact Copy:
```
✗ INVALID SIGNATURE

This PDF does not contain a valid signature, or the signature has been 
tampered with or corrupted.

The document or signature may have been altered after signing.

DO NOT RELY on this document for any legal, financial, or contractual purpose.
```

### Styling Guidance:
- Font size: 14px
- Color: #991B1B (red text — indicates high risk)
- Background: #FEE2E2 (light red box)
- Border: 1px solid #F87171
- Border-left: 3px solid #DC2626
- Icon: ✗ (X mark) before "INVALID"
- Padding: 16px 18px
- Font-weight: 600 (bold for title)

### Placement:
- Top of results section
- Most prominent position
- Red color signals "do not proceed"

---

## 9. Certificate Revoked / Revoked State Message
**Appears when certificate revocation check confirms revocation**

### Exact Copy:
```
⛔ CERTIFICATE REVOKED

The certificate used to sign this document has been revoked and is no longer valid.

Possible reasons:
- The signer's private key was compromised
- The Certificate Authority revoked the certificate
- The signer's organization or identity changed

This signature CANNOT be trusted.

DO NOT RELY on this document for any legal, financial, or contractual purpose.
```

### Styling Guidance:
- Font size: 14px
- Color: #991B1B (red text — highest risk level)
- Background: #FEE2E2 (light red box)
- Border: 1px solid #F87171
- Border-left: 4px solid #DC2626 (thicker border than invalid)
- Icon: ⛔ (blocked/revoked) before "CERTIFICATE"
- Padding: 16px 18px
- Font-weight: 700 (bolder than invalid)

### Placement:
- Top of results section
- Most prominent position
- Visually distinct from "Invalid Signature" (revoked is worse)

---

## 10. Email/Support Copy
**For error messages and support links**

### For Upload Errors:
```
File could not be processed. Please ensure:
1. The file is a valid PDF
2. The file is not corrupted or encrypted
3. The file is under 50 MB

If you continue to experience issues, contact support.
```

### For Timeout Errors:
```
The verification took too long to complete. Please try again.

If the problem persists, the document may be unusually large or our 
service may be experiencing high demand. Try again in a few moments.
```

### For Server Errors:
```
We encountered an unexpected error. Your document was not processed.

This error has been logged and our team will investigate. Please try 
again in a few moments.

Contact support if the problem persists.
```

---

## Usage Instructions for Designers & Developers

### Do's ✅
- Copy text exactly as shown (no paraphrasing)
- Include all icons and styling as specified
- Test color contrast ratios (4.5:1 minimum for WCAG AA)
- Ensure disclaimers are visible without scrolling on mobile
- Use monospace font for CA names and technical terms

### Don'ts ❌
- Do NOT shorten or simplify disclaimer language
- Do NOT remove icons or change colors arbitrarily
- Do NOT move disclaimers below other content
- Do NOT use lighter font weights (use 600+ for main text)
- Do NOT translate without legal review (if offering international versions)

---

## Version Control

| Version | Date | Changes | Approved By |
|---------|------|---------|------------|
| 1.0 | April 18, 2026 | Initial creation | Paula (Legal) |
| 1.1 | — | — | Gary (UI/Copy) |
| 1.2 | — | — | Legal Review |

---

## Questions for Gary & Design

1. **Font families**: Sans-serif (Helvetica, SF Pro) or serif (Georgia)?
2. **Mobile behavior**: Stack disclaimers vertically or abbreviated version?
3. **Tooltip vs. always-visible**: Should timestamp/revocation messages always show or on-hover?
4. **CA list**: Do we show specific provider names (Adobe, DocuSign) or generic "trusted CA"?
5. **Accessibility**: Screen reader order for result states + disclaimers?

---

## Related Documents

- BACKEND_IMPLEMENTATION_GUIDE.md — Where to inject these messages
- PRIVACY_GDPR_SPEC.md — Why these disclaimers are required
- compliance-report.tsx — Risk analysis backing these disclaimers

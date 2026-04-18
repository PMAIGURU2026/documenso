# Legal & Compliance Acceptance Checklist
## Verification Portal — Issue #1764
## Owner: Paula | Sign-off required before PR merges

---

### How to Use This Checklist
Paula completes this checklist during Phase 3 (Days 11–14). 
Every item must be checked before Paula's sign-off is given 
and before Joel submits the Pull Request to GitHub.

---

### Section 1 — Legal Disclaimers
*(Verify against Gary's UI build)*

- [ ] General disclaimer appears beneath ALL 5 result states
- [ ] Amber-Unknown disclaimer appears on Amber-Unknown state only
- [ ] Revocation failure disclaimer appears when OCSP/CRL cannot complete
- [ ] Timestamp disclaimer appears when TSA status is absent or unverified
- [ ] CA disclaimer appears when certificate does not chain to trusted bundle
- [ ] No disclaimer text has been altered from disclaimers.json source

---

### Section 2 — GDPR & Data Privacy
*(Verify with Joel)*

- [ ] Privacy Notice is visible on the upload page before user submits file
- [ ] ROPA entry is complete and linked from Documenso's Privacy Policy
- [ ] Joel confirms buf.fill(0) is inside a try/finally block
- [ ] Joel confirms IP hashing middleware is active on /verify route
- [ ] Joel confirms log retention is set to 72 hours maximum
- [ ] Confirmed: no document content is written to any storage layer

---

### Section 3 — Accessibility
*(Coordinate with Pape — do not sign off without Pape's audit)*

- [ ] All 5 result states use color + icon + text (never color alone)
- [ ] WCAG 2.1 AA confirmed by Pape's accessibility audit
- [ ] Drag-and-drop uploader has keyboard-accessible fallback

---

### Section 4 — Final Sign-Off

| Team Member | Role | Sign-Off |
|-------------|------|----------|
| Paula | Legal & Data Privacy | [ ] Approved |
| Joel | API Implementation | [ ] Approved |
| Gamaliel | Security & Cryptographic | [ ] Approved |
| Gary | UI & Copy | [ ] Approved |
| Pape | UX & Accessibility | [ ] Approved |
| Christian | Finance & Audit | [ ] Approved |

---

*All six sign-offs required before Joel submits PR to GitHub.*

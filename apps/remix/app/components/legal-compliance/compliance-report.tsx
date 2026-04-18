import { useState } from "react";

const gaps = [
  {
    id: "GAP-01",
    area: "Data Disposal",
    risk: "HIGH",
    regulation: "GDPR Art. 5(1)(e)",
    title: "No Explicit Memory-Clearing Protocol",
    problem:
      "The PRD says 'immediately discard the file' but does not specify HOW memory is cleared. In computing, data lingers in RAM (Random Access Memory) until actively overwritten. Simply 'releasing' a buffer does not erase it — like erasing a pencil mark but the indent remains.",
    exposure:
      "If a server is compromised or a memory dump is taken, sensitive document content could be recovered even after 'discard.'",
    protocol: [
      "Implement explicit buffer zeroing immediately after cryptographic verification completes. In Node.js: buf.fill(0) before dereferencing.",
      "Use a try/finally block to guarantee zeroing even if verification throws an error.",
      "Document this pattern in the codebase as a required security practice, not optional.",
    ],
    disclaimer:
      "Add to internal engineering docs: 'All file buffers processed by the Verification Portal MUST be zeroed using buf.fill(0) prior to garbage collection. No exceptions.'",
  },
  {
    id: "GAP-02",
    area: "Data Disposal",
    risk: "HIGH",
    regulation: "GDPR Art. 5(1)(b) + Art. 13",
    title: "Server Logs May Capture PII Silently",
    problem:
      "Even with in-memory processing, standard server logs (like those produced by Express.js, NGINX, or AWS CloudFront) automatically record IP addresses, file sizes, timestamps, and request metadata. The PRD only masks IP addresses in the UI — not in backend logs.",
    exposure:
      "GDPR treats IP addresses as personal data. Uncontrolled log retention of IPs from EU users constitutes a compliance violation, even if no document content is stored.",
    protocol: [
      "Implement a custom logging middleware for the /verify route that strips or hashes IP addresses before they reach any log sink.",
      "Set a maximum log retention window for this endpoint (e.g., 24–72 hours) with automated deletion.",
      "Add a Privacy Notice to the upload page stating: 'We do not store your document. Your IP address is anonymized and retained for no more than [X] hours for abuse prevention only.'",
    ],
    disclaimer:
      "Public-facing disclaimer: 'No document content is stored or logged. Anonymized connection metadata is retained for up to 72 hours solely for rate-limiting and security purposes, then permanently deleted.'",
  },
  {
    id: "GAP-03",
    area: "Data Disposal",
    risk: "MEDIUM",
    regulation: "GDPR Art. 5(1)(e) + Art. 30",
    title: "No Data Retention Policy Documented",
    problem:
      "GDPR requires a documented retention schedule for all personal data, even if that schedule is 'zero seconds.' The PRD makes no mention of a formal retention policy. Saying 'we keep nothing' is a compliance claim that must itself be documented and auditable.",
    exposure:
      "In a GDPR audit or data subject complaint, Documenso could not produce a Record of Processing Activities (ROPA) entry for this feature, which is itself a violation.",
    protocol: [
      "Create a ROPA entry for the Verification Portal feature specifying: data category (IP address, connection metadata), retention period (72 hours max), legal basis (legitimate interest for abuse prevention), and deletion mechanism (automated log rotation).",
      "Add this to Documenso's existing privacy documentation before the feature goes to production.",
      "Include a link to Documenso's Privacy Policy on the verification portal page.",
    ],
    disclaimer:
      "Add to Privacy Policy: 'When using the Document Verification Portal, no document content is retained. Anonymized request metadata is automatically purged within 72 hours. This feature is operated on a stateless basis in accordance with GDPR Article 5(1)(e).'",
  },
  {
    id: "GAP-04",
    area: "Signature Authenticity",
    risk: "HIGH",
    regulation: "eIDAS Reg. (EU) 910/2014 + US ESIGN Act",
    title: "No Certificate Authority (CA) Validation Chain Described",
    problem:
      "A digital signature is only as trustworthy as the authority that issued it. The PRD does not specify which Certificate Authorities (CAs) are trusted, what happens with expired certificates, or how revoked certificates are handled. Think of it like accepting a government ID without checking if that government is real.",
    exposure:
      "A bad actor could generate a self-signed certificate (which anyone can do for free in seconds), sign a fraudulent document, and the portal could display 'Valid Signature' in Amber — misleading users into trusting a fabricated document.",
    protocol: [
      "Define and hardcode a trusted CA bundle (e.g., Adobe Approved Trust List — AATL, or Mozilla's CA bundle) against which all signing certificates are validated.",
      "Distinguish clearly in the result display between: (a) certificate from a trusted CA, (b) certificate from an unknown CA, and (c) self-signed certificate.",
      "Reject or red-flag any certificate that does not chain to a trusted root CA.",
    ],
    disclaimer:
      "Add to result display for Amber state: 'This signature was cryptographically valid but was issued by a Certificate Authority not on Documenso's trusted list. Independent verification of the signer's identity is recommended before relying on this document.'",
  },
  {
    id: "GAP-05",
    area: "Signature Authenticity",
    risk: "HIGH",
    regulation: "eIDAS Art. 26 + RFC 5280",
    title: "No Certificate Revocation Check (CRL / OCSP)",
    problem:
      "A certificate can be revoked (canceled) after it was issued — for example, if a signer's private key was stolen or a company shut down. The PRD has no process for checking revocation. Imagine a credit card that was reported stolen, but the store has no way to check — they just accept it.",
    exposure:
      "A document signed with a compromised or revoked certificate could be verified as 'Valid' by the portal, creating legal liability for Documenso if a user relies on that verification in a dispute.",
    protocol: [
      "Implement OCSP (Online Certificate Status Protocol) checking as the primary revocation method. This is a real-time call to the certificate issuer asking 'is this cert still valid?'",
      "Implement CRL (Certificate Revocation List) checking as a fallback if OCSP is unavailable.",
      "Add a fourth result state to the UI: 'Certificate Revoked' (Red, distinct from invalid signature) with an explanation.",
      "Handle OCSP/CRL timeout gracefully — if the check cannot complete, display 'Revocation status unknown' rather than defaulting to Verified.",
    ],
    disclaimer:
      "Add to result display when revocation check fails: 'Revocation status could not be confirmed at this time. The cryptographic signature structure is intact, but the signing certificate's current validity could not be verified. Do not rely solely on this result for legal or financial decisions.'",
  },
  {
    id: "GAP-06",
    area: "Signature Authenticity",
    risk: "MEDIUM",
    regulation: "eIDAS Art. 41 + ISO 32000-2",
    title: "Amber State is Legally Ambiguous and Potentially Misleading",
    problem:
      "The PRD groups two very different scenarios under a single Amber 'Valid signature, not issued by Documenso' state: (1) a signature from a trusted platform like Adobe or DocuSign, and (2) a self-signed certificate anyone could create. These carry very different levels of trust but look identical to the user.",
    exposure:
      "A user could receive a fraudulent self-signed document and see the same Amber result as a legitimately DocuSign-signed contract. This is a material misrepresentation risk.",
    protocol: [
      "Split the Amber state into at minimum two distinct states: Amber-Trusted ('Valid signature from a recognized provider') and Amber-Unknown ('Valid signature structure, but issuer is unverified').",
      "Add provider detection logic to identify known platforms (Adobe, DocuSign, HelloSign) by their CA fingerprints and display the provider name when recognized.",
    ],
    disclaimer:
      "Add beneath Amber-Unknown result: 'This document contains a cryptographically intact signature, but the issuing authority is not recognized by Documenso. This result does not confirm the identity of the signer. Treat with caution.'",
  },
  {
    id: "GAP-07",
    area: "Signature Authenticity",
    risk: "MEDIUM",
    regulation: "eIDAS Art. 41 + ETSI EN 319 102",
    title: "No Timestamp Validation",
    problem:
      "Trusted timestamps are a certified, third-party record of exactly when a document was signed. They are critical in legal disputes where signing date is contested. The PRD does not mention whether timestamps are verified or even displayed. This is like confirming a letter is authentic but not checking when it was actually written.",
    exposure:
      "Without timestamp validation, the portal cannot confirm a document wasn't backdated. For legal and compliance use cases (the PRD's stated audience), this is a significant evidentiary gap.",
    protocol: [
      "Extract and display the embedded signing timestamp from the PDF signature if present.",
      "Validate the timestamp against a trusted TSA (Timestamp Authority), such as those operated by DigiCert or GlobalSign.",
      "Clearly label whether the timestamp is: (a) TSA-verified, (b) claimed but unverified, or (c) absent.",
    ],
    disclaimer:
      "Add to result display: 'Signing Date: [Date] — [TSA Verified / Unverified / Not Present]. Documenso cannot confirm the accuracy of unverified timestamps.'",
  },
  {
    id: "GAP-08",
    area: "Technical / Security",
    risk: "HIGH",
    regulation: "OWASP Top 10 — A05 Security Misconfiguration",
    title: "libpdf/core Is Unverified and Unsourced",
    problem:
      "The PRD names 'libpdf/core' as the core dependency for signature parsing, but this is not a recognized, publicly documented open-source library. This raises questions about its maintenance status, security audit history, and whether it handles malformed or malicious PDFs safely.",
    exposure:
      "A maliciously crafted PDF (a 'PDF bomb' or exploit payload) submitted to the portal could crash the server, expose memory, or execute code if the parsing library has unpatched vulnerabilities.",
    protocol: [
      "Clarify in the PRD whether 'libpdf/core' is an internal Documenso module or a public dependency.",
      "If it is a public dependency, link to its repository, version, and last security audit.",
      "Implement PDF pre-screening: validate file headers, enforce strict size limits, and consider scanning with a sandbox environment before passing to libpdf/core.",
      "Pin the dependency version in package.json and add it to Documenso's dependency vulnerability scanning pipeline (e.g., Dependabot or Snyk).",
    ],
    disclaimer:
      "Add to engineering docs: 'All third-party parsing dependencies used in the Verification Portal must be publicly auditable, actively maintained, and registered in the project's vulnerability scanning pipeline prior to merge.'",
  },
  {
    id: "GAP-09",
    area: "Technical / Security",
    risk: "MEDIUM",
    regulation: "OWASP Top 10 — A03 Injection",
    title: "No Input Sanitization or File Type Validation Specified",
    problem:
      "The PRD does not specify what happens if a user uploads a non-PDF file — an executable, a ZIP, or a disguised malicious file. Without strict input validation, the upload endpoint could be used as an attack vector.",
    exposure:
      "Processing an unexpected file type through PDF parsing libraries can cause crashes, memory corruption, or exploitation of parser vulnerabilities.",
    protocol: [
      "Enforce strict file type validation: check both file extension AND magic bytes (the actual binary signature of the file, not just what the user names it).",
      "Reject any file that does not match PDF magic bytes (%PDF-) with a clear error message before any processing begins.",
      "Set and enforce MAX_FILE_SIZE at the middleware layer before the file reaches the parser.",
    ],
    disclaimer:
      "Add to engineering acceptance criteria: 'The /verify endpoint must reject any upload that does not pass both extension validation and magic byte verification. Rejection must occur before any parsing library is invoked.'",
  },
  {
    id: "GAP-10",
    area: "Accessibility & Legal",
    risk: "MEDIUM",
    regulation: "ADA / WCAG 2.1 AA + EU Web Accessibility Directive",
    title: "No Accessibility Requirements Defined",
    problem:
      "The PRD's target audience includes legal counsel, enterprise compliance teams, and freelancers — professionals who may use assistive technologies. No WCAG (Web Content Accessibility Guidelines) compliance level is specified for the drag-and-drop interface or result display.",
    exposure:
      "A publicly accessible portal that does not meet WCAG 2.1 AA standards exposes Documenso to ADA complaints in the US and EU Web Accessibility Directive violations in Europe.",
    protocol: [
      "Specify WCAG 2.1 AA as the minimum accessibility standard in the PRD's acceptance criteria.",
      "Ensure the drag-and-drop interface has a keyboard-accessible fallback file picker.",
      "Ensure result state colors (Green/Amber/Red) are not the sole indicator — include icons and text labels so color-blind users receive equivalent information.",
      "Add accessibility testing (e.g., axe-core) to the PR review checklist for issue #1764.",
    ],
    disclaimer:
      "Add to acceptance criteria: 'The Verification Portal must meet WCAG 2.1 AA standards. All result states must be conveyed through color, iconography, AND text — never color alone.'",
  },
];

const riskColors = {
  HIGH: { bg: "#FEE2E2", text: "#991B1B", border: "#F87171", badge: "#DC2626" },
  MEDIUM: { bg: "#FEF9C3", text: "#92400E", border: "#FCD34D", badge: "#D97706" },
  LOW: { bg: "#DCFCE7", text: "#166534", border: "#86EFAC", badge: "#16A34A" },
};

const areaIcons = {
  "Data Disposal": "🗑️",
  "Signature Authenticity": "🔐",
  "Technical / Security": "🛡️",
  "Accessibility & Legal": "⚖️",
};

export const ComplianceReport = () => {
  const [expanded, setExpanded] = useState(null);
  const [filter, setFilter] = useState("ALL");

  const filtered = filter === "ALL" ? gaps : gaps.filter(g => g.risk === filter || g.area === filter);
  const areas = [...new Set(gaps.map(g => g.area))];

  return (
    <div style={{
      fontFamily: "'Georgia', 'Times New Roman', serif",
      background: "#0F1117",
      minHeight: "100vh",
      color: "#E8E6E1",
      padding: "0",
    }}>
      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, #1a1f2e 0%, #0d1117 50%, #1a1520 100%)",
        borderBottom: "1px solid #2a2d3a",
        padding: "48px 40px 36px",
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          backgroundImage: "radial-gradient(circle at 20% 50%, rgba(220,38,38,0.08) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(217,119,6,0.06) 0%, transparent 40%)",
          pointerEvents: "none",
        }} />
        <div style={{ position: "relative", maxWidth: "900px", margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
            <span style={{ fontSize: "11px", letterSpacing: "3px", color: "#DC2626", textTransform: "uppercase", fontFamily: "monospace" }}>COMPLIANCE REVIEW</span>
            <span style={{ fontSize: "11px", color: "#4B5563", fontFamily: "monospace" }}>// GitHub Issue #1764</span>
          </div>
          <h1 style={{
            fontSize: "clamp(22px, 4vw, 36px)",
            fontWeight: "700",
            color: "#F9FAFB",
            margin: "0 0 8px",
            lineHeight: 1.2,
            letterSpacing: "-0.5px",
          }}>
            Documenso Verification Portal
          </h1>
          <p style={{ fontSize: "16px", color: "#9CA3AF", margin: "0 0 28px", fontStyle: "italic" }}>
            Risk Gap Analysis & Remediation Protocol — PR #1764 Submission Review
          </p>

          {/* Summary badges */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
            {[
              { label: "Total Gaps Identified", value: gaps.length, color: "#6B7280" },
              { label: "High Risk", value: gaps.filter(g => g.risk === "HIGH").length, color: "#DC2626" },
              { label: "Medium Risk", value: gaps.filter(g => g.risk === "MEDIUM").length, color: "#D97706" },
            ].map(s => (
              <div key={s.label} style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "8px",
                padding: "10px 16px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}>
                <span style={{ fontSize: "24px", fontWeight: "700", color: s.color, fontFamily: "monospace" }}>{s.value}</span>
                <span style={{ fontSize: "11px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "1px", lineHeight: 1.3 }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{
        background: "#161b27",
        borderBottom: "1px solid #1f2330",
        padding: "14px 40px",
        display: "flex",
        gap: "8px",
        flexWrap: "wrap",
        maxWidth: "100%",
      }}>
        <div style={{ maxWidth: "900px", margin: "0 auto", width: "100%", display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: "11px", color: "#4B5563", textTransform: "uppercase", letterSpacing: "1px", marginRight: "4px" }}>Filter:</span>
          {["ALL", "HIGH", "MEDIUM", ...areas].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: "5px 12px",
              borderRadius: "20px",
              border: filter === f ? "1px solid #DC2626" : "1px solid #2a2d3a",
              background: filter === f ? "rgba(220,38,38,0.15)" : "transparent",
              color: filter === f ? "#F87171" : "#6B7280",
              fontSize: "11px",
              cursor: "pointer",
              fontFamily: "monospace",
              letterSpacing: "0.5px",
              transition: "all 0.15s",
            }}>{f}</button>
          ))}
        </div>
      </div>

      {/* Gap cards */}
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "32px 40px" }}>
        {filtered.map((gap, i) => {
          const rc = riskColors[gap.risk];
          const isOpen = expanded === gap.id;
          return (
            <div key={gap.id} style={{
              marginBottom: "16px",
              border: `1px solid ${isOpen ? rc.border : "#1f2330"}`,
              borderRadius: "10px",
              overflow: "hidden",
              transition: "border-color 0.2s",
              background: isOpen ? "rgba(255,255,255,0.02)" : "#131720",
            }}>
              {/* Card header */}
              <button onClick={() => setExpanded(isOpen ? null : gap.id)} style={{
                width: "100%",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "18px 22px",
                display: "flex",
                alignItems: "flex-start",
                gap: "14px",
                textAlign: "left",
              }}>
                {/* Left: ID + area icon */}
                <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", minWidth: "48px" }}>
                  <span style={{ fontSize: "9px", fontFamily: "monospace", color: "#4B5563", letterSpacing: "1px" }}>{gap.id}</span>
                  <span style={{ fontSize: "22px" }}>{areaIcons[gap.area]}</span>
                </div>

                {/* Middle: title + meta */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "6px", alignItems: "center" }}>
                    <span style={{
                      fontSize: "10px", fontFamily: "monospace", letterSpacing: "1px",
                      background: rc.badge, color: "#fff",
                      padding: "2px 8px", borderRadius: "4px", fontWeight: "700",
                    }}>{gap.risk} RISK</span>
                    <span style={{
                      fontSize: "10px", fontFamily: "monospace", color: "#4B5563",
                      border: "1px solid #2a2d3a", padding: "2px 8px", borderRadius: "4px",
                    }}>{gap.area}</span>
                    <span style={{
                      fontSize: "10px", fontFamily: "monospace", color: "#6366F1",
                      border: "1px solid #312e81", padding: "2px 8px", borderRadius: "4px",
                    }}>{gap.regulation}</span>
                  </div>
                  <span style={{ fontSize: "15px", fontWeight: "600", color: "#F3F4F6", lineHeight: 1.3 }}>{gap.title}</span>
                </div>

                {/* Right: expand indicator */}
                <div style={{
                  flexShrink: 0, fontSize: "18px", color: "#4B5563",
                  transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.2s",
                  marginTop: "2px",
                }}>▾</div>
              </button>

              {/* Expanded content */}
              {isOpen && (
                <div style={{ padding: "0 22px 22px", borderTop: "1px solid #1f2330" }}>

                  {/* Problem */}
                  <div style={{ marginTop: "18px" }}>
                    <div style={{ fontSize: "10px", letterSpacing: "2px", color: "#DC2626", textTransform: "uppercase", fontFamily: "monospace", marginBottom: "8px" }}>⚠ The Problem</div>
                    <p style={{ fontSize: "14px", color: "#D1D5DB", lineHeight: 1.7, margin: 0 }}>{gap.problem}</p>
                  </div>

                  {/* Exposure */}
                  <div style={{
                    marginTop: "16px", padding: "12px 16px",
                    background: `${rc.bg}18`,
                    border: `1px solid ${rc.border}44`,
                    borderRadius: "8px",
                  }}>
                    <div style={{ fontSize: "10px", letterSpacing: "2px", color: rc.badge, textTransform: "uppercase", fontFamily: "monospace", marginBottom: "6px" }}>Risk Exposure</div>
                    <p style={{ fontSize: "13px", color: "#D1D5DB", lineHeight: 1.6, margin: 0 }}>{gap.exposure}</p>
                  </div>

                  {/* Protocol */}
                  <div style={{ marginTop: "18px" }}>
                    <div style={{ fontSize: "10px", letterSpacing: "2px", color: "#10B981", textTransform: "uppercase", fontFamily: "monospace", marginBottom: "10px" }}>✓ Required Protocol</div>
                    <ol style={{ margin: 0, padding: "0 0 0 18px" }}>
                      {gap.protocol.map((p, idx) => (
                        <li key={idx} style={{ fontSize: "13px", color: "#D1D5DB", lineHeight: 1.7, marginBottom: "8px" }}>{p}</li>
                      ))}
                    </ol>
                  </div>

                  {/* Disclaimer */}
                  <div style={{
                    marginTop: "16px", padding: "14px 16px",
                    background: "rgba(99,102,241,0.08)",
                    border: "1px solid rgba(99,102,241,0.25)",
                    borderRadius: "8px",
                    borderLeft: "3px solid #6366F1",
                  }}>
                    <div style={{ fontSize: "10px", letterSpacing: "2px", color: "#818CF8", textTransform: "uppercase", fontFamily: "monospace", marginBottom: "6px" }}>📋 Required Disclaimer / Documentation Language</div>
                    <p style={{ fontSize: "13px", color: "#C7D2FE", lineHeight: 1.65, margin: 0, fontStyle: "italic" }}>"{gap.disclaimer}"</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Footer note */}
        <div style={{
          marginTop: "32px",
          padding: "20px 24px",
          background: "#161b27",
          border: "1px solid #1f2330",
          borderRadius: "10px",
          borderLeft: "3px solid #D97706",
        }}>
          <div style={{ fontSize: "10px", letterSpacing: "2px", color: "#D97706", textTransform: "uppercase", fontFamily: "monospace", marginBottom: "8px" }}>⚖ PR #1764 Submission Recommendation</div>
          <p style={{ fontSize: "13px", color: "#9CA3AF", lineHeight: 1.7, margin: 0 }}>
            This PRD should not advance to implementation until all HIGH risk gaps (GAP-01, GAP-02, GAP-04, GAP-05, GAP-08) have documented resolutions in the issue thread. 
            MEDIUM risk gaps should be resolved before the feature reaches production. Each gap above provides the exact protocol language, disclaimer text, and acceptance criteria 
            needed to remediate the exposure. These should be added directly to the GitHub Issue #1764 as updated acceptance criteria before the PR is opened.
          </p>
        </div>

        <div style={{ textAlign: "center", marginTop: "32px", fontSize: "11px", color: "#374151", fontFamily: "monospace", letterSpacing: "1px" }}>
          COMPLIANCE REVIEW — DOCUMENSO VERIFICATION PORTAL — ISSUE #1764 — DRAFT
        </div>
      </div>
    </div>
  );
}

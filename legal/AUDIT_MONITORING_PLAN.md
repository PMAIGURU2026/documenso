# Audit & Monitoring Plan
## Verification Portal — Issue #1764
## Owner: Christian (Finance & Audit) + Gamaliel (Security)

---

## Overview
This document specifies monitoring, alerting, and audit requirements to ensure ongoing 
compliance with legal, security, and accessibility standards post-launch.

---

## 1. Key Performance Indicators (KPIs)

### 1.1 Security & Data Privacy KPIs

| KPI | Target | Frequency | Alert If |
|-----|--------|-----------|----------|
| **Log Retention Compliance** | 100% of verification logs deleted by 72h | Daily | <99% |
| **Buffer Zeroing Audit Trail** | 100% of PDF buffers zeroed | Sampling (10%) | <99% |
| **IP Hash Consistency** | Same IP always hashes to same value | Monthly | Any deviation |
| **OCSP/CRL Timeout Rate** | <5% of revocation checks | Real-time | >5% in 1h window |
| **Certificate Validation Errors** | <1% of uploads | Real-time | >1% in 1h window |
| **Dependency Vulnerability Scan** | 0 high/critical vulnerabilities | Daily | Any detected |
| **Memory Leak Detection** | No PDF data in heap after request | Sampling (1%) | Any PDF data found |

### 1.2 Accessibility KPIs

| KPI | Target | Frequency | Alert If |
|-----|--------|-----------|----------|
| **WCAG 2.1 AA Automated Scan** | 0 violations | Weekly | >0 violations |
| **Color Contrast Compliance** | 100% of text ≥4.5:1 ratio | Quarterly | <100% |
| **Keyboard Navigation** | All interactive elements reachable | Quarterly | Not reachable |
| **Screen Reader Testing** | NVDA/VoiceOver pass | Semi-annually | Failures |

### 1.3 Business KPIs

| KPI | Target | Frequency | Alert If |
|-----|--------|-----------|----------|
| **Portal Uptime** | 99.9% (43.2 min/month downtime) | Real-time | <99.9% |
| **Average Response Time** | <2 seconds | Real-time | >3 seconds (p95) |
| **Error Rate** | <1% of requests | Real-time | >1% |
| **User Complaints (Accessibility)** | <1 per month | Monthly | >1 |
| **Data Breach Incidents** | 0 per year | Annual | Any incident |

---

## 2. Monitoring Setup

### 2.1 Log Aggregation (ELK Stack, Datadog, or Splunk)

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  transports: [
    // Local file (for immediate reference)
    new winston.transports.File({
      filename: 'logs/verification-portal.log',
      maxsize: 10485760, // 10 MB
      maxFiles: 20,
    }),
    // Log aggregation service (e.g., Datadog)
    new DatadogTransport({
      apiKey: process.env.DATADOG_API_KEY,
      hostname: 'verification-portal',
      service: 'documenso-verification',
      source: 'nodejs',
    }),
  ],
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
});

// Log all verification attempts (structured)
logger.info({
  eventType: 'VERIFICATION_ATTEMPT',
  anonymizedIp: req.locals.anonymizedIp,
  fileSize: req.file.size,
  timestamp: new Date().toISOString(),
  // Never log: document content, original IP, user identifiers
});
```

### 2.2 Metrics Collection (Prometheus + Grafana)

```typescript
import prometheus from 'prom-client';

// Custom metrics
const verificationAttempts = new prometheus.Counter({
  name: 'verification_attempts_total',
  help: 'Total verification attempts',
  labelNames: ['result_state'], // 'GREEN', 'RED', 'REVOKED', 'ERROR'
});

const revocationCheckDuration = new prometheus.Histogram({
  name: 'revocation_check_duration_seconds',
  help: 'Time to complete revocation check',
  buckets: [0.1, 0.5, 1, 2, 5],
});

const bufferZeroingTime = new prometheus.Histogram({
  name: 'buffer_zeroing_duration_ms',
  help: 'Time to zero file buffers',
  buckets: [1, 5, 10, 50],
});

// Usage in code
const start = Date.now();
await checkRevocationStatus(cert);
revocationCheckDuration.observe((Date.now() - start) / 1000);
```

### 2.3 Error Tracking (Sentry or Rollbar)

```typescript
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1, // Sample 10% of transactions
  environment: process.env.NODE_ENV,
});

app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.errorHandler());

// Log specific errors
try {
  await verifyPdfSignature(file);
} catch (error) {
  Sentry.captureException(error, {
    tags: {
      component: 'verification-portal',
      errorType: 'signature-validation',
    },
  });
}
```

---

## 3. Alerting Rules

### 3.1 Critical Alerts (Page On-Call Immediately)

```yaml
# Prometheus alert rules
groups:
  - name: verification-portal-critical
    rules:
      # Buffer zeroing failing
      - alert: BufferZeroingFailure
        expr: rate(buffer_zeroing_failures_total[5m]) > 0
        for: 1m
        annotations:
          summary: "Buffer zeroing failing — potential data leak"
          severity: "critical"

      # High revocation check failure rate
      - alert: RevocationCheckFailureRate
        expr: rate(revocation_check_failures_total[5m]) > 0.05
        for: 5m
        annotations:
          summary: "Revocation checks failing >5% — possible network issue"
          severity: "critical"

      # Log retention policy violated
      - alert: LogsOlderThan72Hours
        expr: max(file_age_seconds{path="/logs/verification-*.log"}) > 259200
        for: 1h
        annotations:
          summary: "Verification logs older than 72 hours detected — GDPR violation"
          severity: "critical"

      # Unauthorized access attempt
      - alert: UnauthorizedFileAccess
        expr: rate(file_access_denied_total[5m]) > 0.1
        for: 1m
        annotations:
          summary: "Multiple unauthorized file access attempts detected"
          severity: "critical"
```

### 3.2 High Alerts (Page Within 15 Minutes)

```yaml
      # Certificate validation errors spike
      - alert: CertificateValidationErrors
        expr: rate(certificate_validation_errors_total[5m]) > 0.01
        for: 10m
        annotations:
          summary: "Certificate validation errors >1% — possible CA bundle issue"
          severity: "high"

      # Service degradation (error rate >5%)
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        annotations:
          summary: "Error rate >5% — service degradation"
          severity: "high"

      # Response time degradation
      - alert: HighResponseTime
        expr: histogram_quantile(0.95, http_request_duration_seconds) > 3
        for: 10m
        annotations:
          summary: "P95 response time >3s — performance degradation"
          severity: "high"
```

### 3.3 Medium Alerts (Email to Security Team Daily Digest)

```yaml
      # OCSP responder slow
      - alert: OcspResponderSlow
        expr: histogram_quantile(0.90, ocsp_response_duration_seconds) > 2
        for: 30m
        annotations:
          summary: "OCSP responder slow — consider CRL fallback"
          severity: "medium"

      # Memory usage trending up
      - alert: MemoryUsageTrending
        expr: rate(process_resident_memory_bytes[1h]) > 10000000
        annotations:
          summary: "Memory usage trending up — possible leak"
          severity: "medium"

      # Deprecated dependency detected
      - alert: DeprecatedDependency
        expr: deprecated_dependency_detected > 0
        annotations:
          summary: "Deprecated dependency in use — plan upgrade"
          severity: "medium"
```

---

## 4. Audit Schedule

### 4.1 Daily Audits (Automated)

- [ ] Log retention: Verify all logs >72h deleted
- [ ] Dependency scan: `npm audit` for high/critical vulnerabilities
- [ ] Certificate validation errors: Alert if >1% error rate
- [ ] Memory leaks: Sample 10 requests, check heap for PDF data

**Implementation:**
```bash
# crontab: Run daily at 2 AM
0 2 * * * /usr/local/bin/daily-audit.sh
```

### 4.2 Weekly Audits (Manual + Automated)

- [ ] Review revocation check timeouts: Any pattern?
- [ ] Review access logs: Any suspicious IPs (even hashed)?
- [ ] Check OCSP/CRL availability: Any degradation?
- [ ] Verify drag-and-drop keyboard fallback: Still working?

**Owner:** Security team  
**Time:** 1-2 hours

### 4.3 Monthly Audits (Comprehensive)

- [ ] Full accessibility audit: Axe DevTools + NVDA test
- [ ] Color contrast verification: WCAG 2.1 AA compliance
- [ ] Keyboard navigation test: All interactive elements reachable
- [ ] Screen reader test: VoiceOver/NVDA announcement accuracy
- [ ] Certificate validation logic: Code review of all cert paths
- [ ] IP hashing consistency: Verify no IP leakage in logs
- [ ] Buffer zeroing verification: Spot-check 10 completed requests

**Owner:** Pape (Accessibility) + Gamaliel (Security) + Paula (Compliance)  
**Time:** 4-6 hours

### 4.4 Quarterly Audits (Compliance)

- [ ] GDPR compliance checklist: All 10 requirements still met?
- [ ] ROPA documentation: Updated with any process changes?
- [ ] Privacy Policy: Still accurate for Verification Portal?
- [ ] CA bundle refresh: AATL/Mozilla bundles updated?
- [ ] Data breach response plan: Current and tested?
- [ ] Incident log review: Any data breaches or near-misses?
- [ ] Third-party security audit: If required by contract

**Owner:** Paula (Legal) + Christian (Audit) + Gamaliel (Security)  
**Time:** 8-10 hours

### 4.5 Annual Audits (External)

- [ ] Third-party security assessment (penetration test)
- [ ] WCAG 2.1 AA certification audit
- [ ] GDPR compliance audit (if EU-focused)
- [ ] ISO 27001 assessment (if pursuing certification)

**Owner:** Hire external firm  
**Cost:** $10,000–50,000 depending on scope  
**Duration:** 2–4 weeks

---

## 5. Incident Response

### 5.1 Data Breach Protocol

**If PDF document content is leaked:**

1. **Immediately (0–15 minutes)**
   - [ ] Isolate affected server (disconnect from network)
   - [ ] Notify CISO and legal immediately
   - [ ] Preserve logs/forensics (do not overwrite)

2. **Short-term (15 minutes – 2 hours)**
   - [ ] Determine scope: How many documents exposed?
   - [ ] Identify affected users (if any)
   - [ ] Draft incident notification (required within 72 hours by GDPR)

3. **Medium-term (2–24 hours)**
   - [ ] Notify Supervisory Authority (if required by GDPR)
   - [ ] Notify affected users (email/notification)
   - [ ] Post-mortem: What failed? (buf.fill(0)? network? insider?)
   - [ ] Begin remediation

4. **Long-term (1+ weeks)**
   - [ ] Implement preventative measures
   - [ ] Notify stakeholders of fixes
   - [ ] Update incident documentation

### 5.2 Buffer Zeroing Failure

**If buf.fill(0) is not being called:**

1. [ ] Immediately disable /verify endpoint (return 503 Service Unavailable)
2. [ ] Alert security team + engineering
3. [ ] Review code changes that broke buffer zeroing
4. [ ] Verify fix with memory profiler
5. [ ] Re-enable endpoint
6. [ ] Post-incident review: How did this slip through?

### 5.3 Revocation Check Service Degradation

**If OCSP/CRL services are unavailable:**

1. [ ] Monitor timeout rate
2. [ ] If >20% timeouts for >30 minutes: Escalate to security team
3. [ ] Consider fallback: Accept "unknown" revocation status (conservative)
4. [ ] Contact CAs to determine service status
5. [ ] Update status page if user-facing

### 5.4 Certificate Validation Bypass

**If self-signed certs are showing as Green (trusted):**

1. [ ] Immediately audit all verification results (last 24h)
2. [ ] Identify affected users
3. [ ] Disable /verify endpoint
4. [ ] Fix certificate validation logic
5. [ ] Re-enable with manual testing
6. [ ] Notify affected users of potential false positives

---

## 6. Audit Record Keeping

### 6.1 Documents to Retain

- [ ] Daily audit logs (30 days retention)
- [ ] Monthly audit reports (3 years retention)
- [ ] Quarterly compliance checklists (7 years retention)
- [ ] Annual third-party security reports (7 years retention)
- [ ] Incident logs and post-mortems (7 years retention)
- [ ] Certificate update logs (7 years retention)
- [ ] Access logs (IP hashed, 72 hours retention)
- [ ] ROPA updates (3 years post-feature-sunset)

### 6.2 Audit Report Template

```markdown
# Monthly Audit Report — [Month/Year]
## Verification Portal — Issue #1764

**Date:** [Date]  
**Auditor:** [Name]  
**Owner:** [Paula/Gamaliel/Pape/Christian]

### Checklist Results

- [ ] Accessibility audit: PASS / FAIL
- [ ] Security audit: PASS / FAIL
- [ ] Compliance audit: PASS / FAIL
- [ ] Performance audit: PASS / FAIL

### Findings

[Document any issues, non-compliance, or improvements needed]

### Remediation Plan

[If any failures: what will be fixed, by whom, by when]

### Sign-Off

- [ ] Auditor: _____________________ Date: _____
- [ ] Owner: _____________________ Date: _____
```

---

## 7. Escalation Matrix

### Severity Levels

| Level | Description | Response Time | Escalation |
|-------|-------------|---------------|----|
| **Critical** | Data breach, service down, GDPR violation | 15 minutes | CISO, Legal, VP Eng |
| **High** | Security vulnerability, compliance issue | 1 hour | Security lead, Product lead |
| **Medium** | Minor issue, degradation | 4 hours | Team lead, audit owner |
| **Low** | Information/future improvement | 1 week | Owner |

---

## 8. Compliance Dashboard

**Accessible URL:** `https://internal.documenso.com/compliance/verification-portal`

**Displays:**
- ✓ Log retention: Days remaining until auto-delete
- ✓ Vulnerability scan: Latest results
- ✓ Accessibility score: Axe DevTools violations (target: 0)
- ✓ Uptime: 30-day availability percentage
- ✓ Incident history: Last 90 days
- ✓ Next audit: Scheduled date + owner
- ✓ GDPR compliance: 10/10 requirements met?

---

## 9. Pre-Launch Approval (Christian & Gamaliel)

| Item | Responsible | Approval |
|------|------------|----------|
| KPI targets defined | Christian | [ ] |
| Monitoring setup complete | Gamaliel | [ ] |
| Alert rules configured | Gamaliel | [ ] |
| Audit schedule published | Christian | [ ] |
| Incident response documented | Christian + Gamaliel | [ ] |
| Audit trail tools selected | Christian | [ ] |
| SIEM/logging configured | Gamaliel | [ ] |
| Dashboard deployed | Gamaliel | [ ] |

---

## 10. Post-Launch Timeline

| When | What | Owner |
|------|------|-------|
| Day 1 | Begin daily automated audits | Gamaliel |
| Week 1 | First manual weekly audit | Gamaliel + Paula |
| Month 1 | Monthly audit + report | Pape + Gamaliel + Paula |
| Month 3 | Quarterly compliance audit | Paula + Christian + Gamaliel |
| Month 6 | Mid-year review + reporting | All stakeholders |
| Year 1 | Annual third-party assessment | External firm |

---

## Related Documents

- SECURITY_THREAT_MODEL.md — Threats being monitored
- PRIVACY_GDPR_SPEC.md — Compliance requirements
- ACCEPTANCE_CHECKLIST.md — Pre-launch sign-offs
- BACKEND_IMPLEMENTATION_GUIDE.md — Code that's being audited

# Security Report — Secure IT Helpdesk Ticketing System

**Project:** Secure IT Helpdesk Ticketing System  
**Team:** Team B  
**Prepared by:** Rosemond Pappoe  
**Review period:** Sprint 1–2  
**Last updated:** 23 October 2026  
**Overall status:** **IN PROGRESS**

## 1. Executive summary

The review covers authentication, authorization, API input validation, attachment handling, and audit logging. The existing checklist records successful automated tests for authentication, JWT validation, rate limiting, ticket access control, and attachment handling. The attachment test result was obtained on a feature branch and must be rerun on the final integrated `main`. Audit logging has three open concerns: sensitive-detail sanitization, behavior when an audit write fails, and end-to-end verification of audit creation/retrieval.

A local code change now sanitizes sensitive keys in audit details before JSON serialization. The backend test run after this edit passed **72 tests across 6 suites**. This is regression evidence only; it does not prove the new sanitization behavior until a dedicated sanitization test passes.

**Conclusion:** Review is not complete. Unfinished work is marked **IN PROGRESS**, not presented as resolved.

## 2. Scope and method

Reviewed repository documentation and code evidence for authentication/password hashing/JWT/rate limiting, role-based access and ticket visibility, API validation and parameterized SQL, attachment handling, audit logging, and automated tests. The latest local backend suite was run on 23 October 2026 after the audit sanitization edit. No live production penetration test is claimed.

## 3. Findings summary

| Finding | Priority | Status | Evidence / next step |
|---|---|---|---|
| AUDIT-05: Audit details may contain sensitive fields | High | **IN PROGRESS — local fix added** | Add/pass tests for top-level, nested, and array redaction |
| AUDIT-06: Audit-write errors are swallowed | High / policy decision | **IN PROGRESS** | Agree required behavior for security-critical events; implement and test it |
| AUDIT-07: Audit creation/retrieval not fully verified | Medium | **IN PROGRESS** | Test persisted events and `GET /api/audit-logs` for admin/non-admin/unauthenticated callers |
| Attachment integration on `main` | Medium | **IN PROGRESS** | Previously recorded 11/11 attachment tests ran on `feature/attachment-upload`; rerun on final `main` |
| Production configuration limitations | High before deployment | **IN PROGRESS** | README notes unauthenticated Swagger UI, hard-coded development DB password, and local-only API/CORS configuration; verify safeguards |

Severity is preliminary triage and should be confirmed by the team based on the actual deployment and data classification.

## 4. Automated test evidence

### 4.1 Latest local run

On 23 October 2026, after adding `sanitizeDetails` and changing the audit insert to serialize `sanitizeDetails(details)`, the backend test command completed successfully:

```text
Test Suites: 6 passed, 6 total
Tests:       72 passed, 72 total
```

Command run from `backend`:

```powershell
npm.cmd test -- --runInBand
```

This confirms the existing suite passed after the edit. **It does not establish that the new sanitizer works correctly**, because a dedicated sanitization test has not yet been confirmed passing.

### 4.2 Previously recorded results

The existing `security/test-checklist.md` records:
- Full backend suite on `main`: 55/55 passed across five suites.
- Focused security suite on `main`: 48/48 passed across four suites.
- Attachment suite on `feature/attachment-upload`: 11/11 passed.
- Ticket suite on `feature/attachment-upload`: 19/19 passed.

The attachment and ticket results must not be represented as runs on `main`. Rerun attachment tests against the final integrated branch.

## 5. Before/after evidence: audit detail sanitization

### 5.1 Before

The audit insert previously serialized caller-provided details directly:

```javascript
JSON.stringify(details)
```

A caller that included a password, token, or other secret in `details` could therefore cause it to be stored. A code comment warned callers not to include passwords/tokens, but the service did not enforce that rule.

**Evidence source:** `backend/src/services/audit.js` before the local change; `AUDIT-05` in `security/test-checklist.md`.

### 5.2 After — local change; verification pending

The local change adds a sensitive-key pattern and recursively sanitizes object values, including nested objects and arrays:

```javascript
const SENSITIVE_KEY =
  /password|token|secret|authorization|cookie|api[_-]?key|credential/i;

function sanitizeDetails(value) {
  if (Array.isArray(value)) {
    return value.map(sanitizeDetails);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        SENSITIVE_KEY.test(key) ? '[REDACTED]' : sanitizeDetails(item),
      ])
    );
  }

  return value;
}
```

The insert parameter now uses:

```javascript
JSON.stringify(sanitizeDetails(details))
```

Expected behavior: sensitive fields are replaced with `[REDACTED]` before storage while ordinary details, such as an email address, remain available for investigation.

**Status: IN PROGRESS.** The code edit is local. A dedicated test must prove redaction of top-level fields, nested fields, and values inside arrays. This change has not been merged into `main` through this report.

### 5.3 Evidence still required

- [ ] Dedicated test passes for `password`, `accessToken`, `secret`, and `api_key`.
- [ ] Test proves nested object and array values are sanitized.
- [ ] Test proves non-sensitive fields are preserved.
- [ ] Test checks the actual audit service's serialized database parameter or persisted row.
- [ ] Record command, output, branch, and commit SHA.

## 6. Audit-write failure handling — AUDIT-06

The current service catches database errors and logs them to the server console instead of propagating the failure. This favors request availability but can allow an action, including login, to continue without a durable audit record.

This is not a resolved finding. Required actions:
1. Decide which events require durable audit persistence before the action succeeds.
2. Document the policy for login, role changes, ticket assignment, and status changes.
3. Implement it without unintentionally breaking route error handling.
4. Simulate a database write failure in tests and assert the agreed behavior.
5. Update the checklist only after the decision and tests are complete.

**Status: IN PROGRESS.** No policy decision or test result is claimed here.

## 7. Audit event creation and retrieval — AUDIT-07

Existing login integration tests verify successful and failed login events are created; the failed-login test checks that the attempted password is not present in the recorded details. This is partial evidence for event creation, but does not fully establish retrieval through `GET /api/audit-logs`.

Required actions:
- [ ] Verify admin can retrieve expected audit entries through the API.
- [ ] Verify unauthenticated requests are rejected.
- [ ] Verify non-admin requests are forbidden.
- [ ] Verify filters and pagination return the expected response shape.
- [ ] Confirm retrieved details remain redacted.

**Status: IN PROGRESS.**

## 8. Other controls and limitations

The existing checklist reports passing tests for invalid credentials, inactive accounts, JWT validation, login rate limiting, ticket visibility, role restrictions, comment permissions, and API input validation. These results apply only to the identified tests and branches; they do not prove every attack path is covered.

Attachment controls include size limits, content/MIME checks, generated filenames, storage outside the public directory by default, and authorization. The recorded 11/11 attachment suite ran on `feature/attachment-upload`; rerun it on final `main`.

The README identifies production limitations to address before deployment:
- Swagger UI is mounted without authentication.
- The development database password in `docker-compose.yml` is hard-coded.
- Frontend API URL and backend CORS configuration need deployment-specific values.

These are documented risks/follow-up items, not claims that exploitation occurred.

## 9. Friday “attack and fix” walkthrough plan

Use a local test environment and synthetic data only; do not run destructive tests against a shared or production system.

1. **Baseline:** show the audit insert's original direct serialization of `details`.
2. **Safe demonstration:** use a test fixture with a fake password, fake access token, nested secret, and `api_key` to show the prior behavior.
3. **Fix:** explain the recursive `sanitizeDetails` function and sanitized insert parameter.
4. **Regression tests:** run the full backend suite and the dedicated sanitization test.
5. **Audit access control:** demonstrate admin retrieval and rejected unauthenticated/non-admin requests once tests exist.
6. **Audit-write failures:** present the agreed policy and test. If not finished, clearly mark **IN PROGRESS**.
7. **Limitations:** identify missing evidence and any test not run on final `main`.

**Walkthrough status: IN PROGRESS** until dedicated tests and before/after evidence are captured and AUDIT-06 policy is agreed.

## 10. Remediation tracker

| Item | Action | Status |
|---|---|---|
| AUDIT-05 | Add sanitizer tests and verify redaction | **IN PROGRESS** |
| AUDIT-06 | Agree/implement audit-write failure policy with tests | **IN PROGRESS** |
| AUDIT-07 | Test audit API retrieval and authorization | **IN PROGRESS** |
| Attachments | Rerun attachment tests on final integrated `main` | **IN PROGRESS** |
| Deployment | Verify Swagger UI, DB secrets, API URL, CORS, and runtime config | **IN PROGRESS** |
| Walkthrough | Capture before/after evidence and test output | **IN PROGRESS** |

## 11. Conclusion

The latest local regression run passed 72 tests across six suites after the audit sanitization code edit. This is encouraging regression evidence, but the sanitizer still needs a dedicated passing test. Audit-write failure handling and audit API retrieval verification remain open, and attachment tests must be rerun on the final integrated branch.

**Final status: IN PROGRESS.** Do not describe the overall security review as passed until open items are resolved or explicitly accepted by the team and final evidence is recorded.

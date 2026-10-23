# Threat Model — Secure IT Helpdesk Ticketing System

**Project:** Secure IT Helpdesk Ticketing System  
**Team:** Team B  
**Owner:** Rosemond Pappoe  
**Last updated:** 23 October 2026  
**Status:** **IN PROGRESS**

## 1. Purpose and scope

This working threat model identifies key assets, trust boundaries, threat actors, and abuse cases for the helpdesk application. It is based on the repository README, `security/test-checklist.md`, and documented code/test evidence. It is not a claim that every threat has been tested or every control is complete.

## 2. System overview

The application allows staff to create and view their tickets, support staff to work on assigned tickets, and administrators to manage users, assign tickets, and view audit logs.

**Documented stack and components:** HTML/CSS/JavaScript frontend; Node.js/Express API; PostgreSQL; JWT authentication; bcrypt password hashing; Zod validation; parameterized SQL; login rate limiting; audit logging; and ticket attachment upload/download routes.

**Main data flows:**
1. User submits credentials to the login endpoint; the API returns a JWT after successful authentication.
2. Browser sends the JWT with protected API requests.
3. API authenticates the request, checks the user's current database state and permissions, validates input, and accesses PostgreSQL.
4. Attachment routes check authentication and ticket access for uploads/downloads.
5. Selected actions write audit events; administrators can request audit logs through the API.

The final deployment diagram, hosting details, and verified production network boundaries remain **IN PROGRESS**.

## 3. Assets to protect

| Asset | Security need |
|---|---|
| Credentials and password hashes | Prevent account takeover; never log plaintext passwords |
| JWTs and sessions | Validate signature, claims, and expiry; prevent token exposure |
| Tickets and comments | Enforce server-side role, ownership, and assignment checks |
| Attachments | Validate uploaded content and enforce upload and download authorization |
| User roles and account status | Prevent privilege escalation; verify current role/account state |
| Audit logs | Restrict access, avoid storing secrets, retain useful event evidence |
| Database and configuration secrets | Keep secrets out of source control and restrict database access |
| API availability | Limit abusive requests and handle failures safely |

## 4. Trust boundaries

1. **Browser → API:** request bodies, query parameters, IDs, filenames, and MIME declarations are untrusted.
2. **API → database:** SQL must remain parameterized and authorization must be enforced server-side.
3. **Role boundary:** staff, support, and admin permissions differ; each protected operation must enforce its intended role and ticket relationship.
4. **Attachment boundary:** file bytes and metadata are untrusted; upload and download permissions must be checked separately.
5. **Deployment boundary:** environment variables, CORS, proxy settings, database credentials, and API documentation exposure affect the deployed risk.
6. **Audit boundary:** user-controlled event details may contain secrets; failed audit writes may leave missing records.

## 5. Threat actors

- Unauthenticated user attempting credential guessing, account enumeration, or API abuse.
- Staff user attempting to access another user's ticket or perform privileged operations.
- Support user attempting to access unassigned tickets or perform administrative actions.
- Compromised or malicious privileged account.
- Attacker submitting malformed or hostile files and payloads.
- Attacker exploiting exposed development configuration or leaked secrets.

## 6. Threats and controls

| ID | Threat | Potential impact | Existing/documented control | Status / next action |
|---|---|---|---|---|
| TM-01 | Password guessing | Account takeover | Login rate limiter; bcrypt password hashing | Rate-limit tests passed locally; verify production thresholds/monitoring |
| TM-02 | Login account enumeration | Identify valid accounts | Wrong password and unknown email return same 401 response | Tests reported passing; retain regression coverage |
| TM-03 | Registration role escalation | Unauthorized admin/support access | Registration documented to reject supplied role and create staff accounts | Re-run relevant tests on final submission commit |
| TM-04 | Forged/invalid/expired JWT | Unauthorized API access | JWT verification and expiry; middleware checks user state | JWT tests reported passing; expiry evidence remains partially verified in checklist |
| TM-05 | Broken ticket/comment authorization | Disclosure or modification of another user's data | Ticket visibility, assignment, and role checks | Tests cover documented cases; verify final integrated branch |
| TM-06 | Mass assignment or SQL injection | Unauthorized state changes/database compromise | Zod schemas, strict fields, parameterized queries | Verified for inspected routes/tested inputs only |
| TM-07 | Malicious, oversized, or mismatched upload | Resource exhaustion or hostile content stored | 5 MB limit, content/MIME checks, generated filenames, authorization | 11/11 attachment tests were reported on `feature/attachment-upload`; rerun on final `main` |
| TM-08 | Unauthorized attachment download | Confidentiality breach | Ticket visibility and attachment-to-ticket checks | Re-run tests on final integrated branch |
| TM-09 | Non-admin reads audit logs | Exposure of user activity/IPs | Authentication and admin authorization | Existing checklist reports role-restriction tests; confirm final run |
| TM-10 | Secrets in audit details | Secrets exposed in database/logs | Recursive `sanitizeDetails` added locally in `backend/src/services/audit.js`; insert now serializes sanitized details | **IN PROGRESS:** full suite passed after edit, but dedicated sanitization test is not yet confirmed passing |
| TM-11 | Audit write fails but action proceeds | Missing accountability | Current service catches DB error and logs to console | **IN PROGRESS:** agree policy for security-critical events and test it |
| TM-12 | Swagger UI/development DB password exposed | Reconnaissance or database compromise | README documents unauthenticated Swagger UI and hard-coded development DB password as limitations | **IN PROGRESS:** verify production protections and remove development defaults |
| TM-13 | Unsafe secrets/CORS/proxy configuration | Credential leakage or origin abuse | README documents environment-based secrets and deployment-specific config | Verify production configuration and secret scanning |

## 7. Risk prioritization

**High priority:** unauthorized ticket/attachment access; authentication bypass or privilege escalation; secrets in audit details; missing audit records for security-critical events; exposed production secrets.

**Medium priority:** API/login resource exhaustion beyond tested cases; audit filter edge cases; incomplete error-path checks; missing operational alerting.

This is a qualitative prioritization and should be confirmed by the team against the deployment environment and data sensitivity.

## 8. Verification plan

- [x] Local backend test run on 23 October 2026 after the audit sanitization edit: **72 tests passed across 6 suites**.
- [ ] Add/pass dedicated redaction tests for top-level fields, nested objects, and arrays.
- [ ] Test `GET /api/audit-logs` for admin success and unauthenticated/non-admin rejection.
- [ ] Agree audit-write failure policy, implement it, and test simulated database failure.
- [ ] Rerun attachment tests on final integrated `main`.
- [ ] Capture reproducible before/after evidence for the Friday walkthrough.
- [ ] Add final architecture/deployment diagram and verify production configuration.

## 9. Limitations

This model is based on repository documentation, inspected code, and reported local tests, not a live production penetration test. No claim is made that the application is vulnerability-free. Keep all **IN PROGRESS** items open until supported by evidence.

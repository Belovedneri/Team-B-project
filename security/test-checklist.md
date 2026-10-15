Security Test Checklist and Review Report

Project:Secure IT Helpdesk Ticketing System  
Team:Team B  
Reviewer:Rosemond  
Sprint:1  
Review date:15 October 2026

1. Purpose and Status Definitions

This document records the security requirements reviewed, code evidence inspected, test evidence available, and outstanding concerns.

- **Verified in code:** The relevant implementation was inspected and the stated control was found.
- **Test exists:** A relevant automated test was identified, but successful execution has not been confirmed.
- **PASS:** The test was executed and the actual result matched the expected result.
- **FAIL:** An executed test demonstrated that the requirement was not met.
- **PARTIALLY VERIFIED:** Some evidence exists, but the complete requirement has not been confirmed.
- **NOT VERIFIED:** There is insufficient evidence to confirm the requirement.
- **BLOCKED:** Verification cannot proceed because a dependency or required access is unavailable.

Code inspection alone does not establish that a security test passed.

2. Authentication Security
**Evidence reviewed:** PR #25, registration and login with bcrypt and JWT.

| ID | Security check | Evidence and finding | Status |
| AUTH-01 | Password hashing | Registration code uses bcrypt hashing with 10 rounds. Runtime behavior has not been independently tested. | PARTIALLY VERIFIED |
| AUTH-02 | Invalid credentials | Tests cover incorrect passwords and unknown email addresses returning HTTP 401. | TEST EXISTS |
| AUTH-03 | Inactive accounts | A test checks that inactive accounts cannot log in. | TEST EXISTS |
| AUTH-04 | JWT expiry | Code configures a one-hour token expiry. Runtime rejection of expired tokens is not independently confirmed. | PARTIALLY VERIFIED |
| AUTH-05 | JWT signature and claims | Authentication code and tests cover invalid tokens and required claims. | TEST EXISTS |
| AUTH-06 | Registration privilege escalation | Registration is intended to reject a submitted role field. A corresponding test was identified. | TEST EXISTS |
| AUTH-07 | Login rate limiting | The teammate reported an integration test in `backend/tests/auth.ratelimit.test.js` that exercises the real login route and expects HTTP 429 after repeated failures. | TEST EXISTS |
| AUTH-08 | Authentication route integration | The teammate confirmed that PR #25 mounts the real authentication router after `loginLimiter`. | CODE REVIEWED |

**Automated-check evidence:** PR #25 displayed one successful automated check. The specific test cases covered by that check have not been confirmed.

3. Access Control

**Evidence reviewed:** PR #27, tickets API, ticket access service, authentication middleware, and ticket tests.

| ID | Security check | Evidence and finding | Status |
| ACCESS-01 | Staff ticket visibility | Tests cover a Staff user attempting to access another Staff user's ticket. | TEST EXISTS |
| ACCESS-02 | Support ticket visibility | Tests cover access to tickets assigned to Support users. | TEST EXISTS |
| ACCESS-03 | Admin-only operations | Code and tests cover role restrictions for privileged operations. | TEST EXISTS |
| ACCESS-04 | Ticket status workflow | Code enforces status transitions. The intended permissions for closing or reopening tickets must be confirmed against the agreed workflow. | PARTIALLY VERIFIED |
| ACCESS-05 | Unauthorized ticket access | The implementation uses 404 responses for inaccessible tickets to reduce ticket-ID enumeration. | CODE REVIEWED |
| ACCESS-06 | Ticket assignment | The route restricts assignment to Admin and checks that the assignee has the Support role. | CODE REVIEWED |
| ACCESS-07 | JWT and account status | Authentication middleware checks the user against the database and handles account and role changes. | CODE REVIEWED |

**Automated-check evidence:** PR #27 displayed zero automated checks. Test files exist, but successful execution has not been confirmed.

**Outstanding review item:** Confirm that the JWT validation and ticket-status permission concerns raised on PR #22 are addressed in the code being merged.

## 4. File Upload Security

**Evidence reviewed:** PR #33, `backend/src/routes/attachments.js`, and `backend/tests/attachments.test.js`.

| ID | Security check | Evidence and finding | Status |
| UPLOAD-01 | File size restriction | Multer enforces a 5 MB limit. | CODE REVIEWED |
| UPLOAD-02 | Allowed file types | The route allows PNG, JPEG, PDF, and plain text and checks detected content against the declared MIME type. | PARTIALLY VERIFIED |
| UPLOAD-03 | File-content validation | PNG, JPEG, and PDF checks rely on short file signatures. The PNG test uses only the eight-byte signature, which is insufficient to establish that the file is a valid PNG. | OUTSTANDING CONCERN |
| UPLOAD-04 | Generated filenames | The server generates UUID-based filenames and does not use the original filename as the stored name. | CODE REVIEWED |
| UPLOAD-05 | Storage location | Uploads are stored outside the public directory by default. | CODE REVIEWED |
| UPLOAD-06 | Upload authorization | Authentication and ticket visibility checks are applied before file receipt. | CODE REVIEWED |
| UPLOAD-07 | Download authorization | The download route checks ticket visibility and matches the attachment to the ticket. | CODE REVIEWED |
| UPLOAD-08 | Comment attachment validation | The route checks that the comment belongs to the same ticket. | CODE REVIEWED |
| UPLOAD-09 | Upload and download tests | Tests cover upload, oversized files, MIME mismatch, authentication, unauthorized access, and downloads. | TEST EXISTS |
| UPLOAD-10 | Error handling | Upload errors are converted into client errors for known Multer failures. Broader error behavior has not been independently tested. | PARTIALLY VERIFIED |

**Review action:** A security comment was submitted on PR #33 requesting stronger file validation and a genuinely valid PNG test sample. A separate question was raised about the absence of automated checks.

**Automated-check evidence:** PR #33 displayed zero automated checks. Successful test execution is unconfirmed.

## 5. Audit Logging

**Evidence reviewed:** PR #27, `backend/src/services/audit.js`, `backend/src/routes/audit.js`, and `database/schema.sql`.

| ID | Security check | Evidence and finding | Status |
| AUDIT-01 | Event coverage | The audit service defines login, failed login, role change, ticket assignment, and status change actions. | CODE REVIEWED |
| AUDIT-02 | Parameterized inserts | Audit records are inserted using parameterized SQL values. | VERIFIED IN CODE |
| AUDIT-03 | Admin-only access | The audit route uses authentication and Admin authorization middleware. | VERIFIED IN CODE |
| AUDIT-04 | Query validation | The route validates action filters, user IDs, and pagination parameters. | VERIFIED IN CODE |
| AUDIT-05 | Sensitive information | The service serializes supplied details without sanitizing them. Callers must avoid including passwords, tokens, and other secrets. | OUTSTANDING CONCERN |
| AUDIT-06 | Audit write failures | The service catches database errors and logs them to the server console without propagating the failure. Whether this is acceptable for security-critical events needs confirmation. | OUTSTANDING CONCERN |
| AUDIT-07 | Audit event verification | Relevant code exists, but successful creation and retrieval of audit records have not been independently tested. | NOT VERIFIED |

## 6. API and Input Security

**Evidence reviewed:** PR #27, `backend/src/schemas/tickets.js`, and `backend/src/routes/tickets.js`.

| ID | Security check | Evidence and finding | Status |
| API-01 | Ticket input validation | Zod schemas validate title, description, category, priority, and comment fields. | VERIFIED IN CODE |
| API-02 | Mass assignment protection | Strict schemas reject unexpected fields such as `created_by` and `status` during ticket creation. | VERIFIED IN CODE |
| API-03 | Identifier validation | Ticket identifiers must be positive integers. | VERIFIED IN CODE |
| API-04 | Pagination validation | Page and limit are validated, with a minimum page of 1 and a maximum limit of 100. | VERIFIED IN CODE |
| API-05 | SQL injection protection | Inspected ticket creation, listing, status update, assignment, and comment queries use parameterized values. The listing route uses a fixed set of allowed filter column names. | VERIFIED IN CODE FOR INSPECTED QUERIES |
| API-06 | Authentication middleware | Ticket routes apply authentication middleware. | VERIFIED IN CODE |
| API-07 | Error responses | Some errors are handled through application error handling, but all relevant error responses have not been tested for sensitive information disclosure. | PARTIALLY VERIFIED |
| API-08 | Runtime input behavior | Automated tests exist for several invalid inputs, but successful execution has not been confirmed. | TEST EXISTS |

## 7. Automated Test Evidence Summary

| Pull request | GitHub check status observed | Interpretation |
| PR #25: Authentication | One successful check | The check passed; individual test coverage is unconfirmed. |
| PR #27: Tickets and access control | Zero checks displayed | Test execution is unconfirmed. |
| PR #33: Attachments | Zero checks displayed | Test execution is unconfirmed. |

The test files reviewed are evidence that tests have been written. They are not proof that the tests have passed.

## 8. Outstanding Issues and Follow-up Actions

- Confirm the authentication integration test in PR #25 is included in the successful automated check.
- Confirm JWT validation and ticket-status permission concerns raised on PR #22 are addressed.
- Strengthen file-content validation in PR #33 and use a valid PNG sample in the tests.
- Confirm the attachment tests execute successfully.
- Confirm audit logs do not contain passwords, tokens, or other secrets.
- Decide how security-critical audit-write failures should be handled.
- Confirm the automated tests for PR #27 execute successfully.
- Complete runtime testing for authentication, access control, file uploads, audit logging, and API validation.
- Record the actual results and supporting evidence for every test performed.

## 9. Final Review Summary

**Overall status:** Security review in progress.

**Verified through code inspection:** Selected authentication, access-control, upload, audit, and input-validation controls listed above.

**Confirmed automated execution:** One successful check displayed on PR #25; individual test coverage remains unconfirmed.

**Unresolved concerns:** File-content validation, audit-data sanitization, audit-write failure handling, outstanding PR #22 review concerns, and unconfirmed test execution on PR #27 and PR #33.

**Final conclusion:** The project has several useful security controls in its implementation, but the security review cannot be declared fully passed until outstanding concerns are addressed and the relevant tests are executed with results recorded.

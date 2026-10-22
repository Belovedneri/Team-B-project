# Security Test Checklist and Review Report

**Project:** Secure IT Helpdesk Ticketing System  
**Team:** Team B  
**Reviewer:** Rosemond  
**Sprint:** Sprint 1 and Sprint 2  
**Review date:** 22 October 2026

## 1. Purpose and Status Definitions

This document records the security requirements reviewed, code evidence inspected, automated tests executed, results obtained, and outstanding concerns for the Secure IT Helpdesk Ticketing System.

Status definitions:

- **VERIFIED IN CODE:** The relevant implementation was inspected and the stated control was found.
- **TEST EXISTS:** A relevant automated test was identified, but successful execution has not been confirmed.
- **PASS:** The test was executed and the actual result matched the expected result.
- **FAIL:** An executed test demonstrated that the requirement was not met.
- **PARTIALLY VERIFIED:** Some evidence exists, but the complete requirement has not been confirmed.
- **NOT VERIFIED:** There is insufficient evidence to confirm the requirement.
- **OUTSTANDING CONCERN:** A security question or potential weakness still requires a decision or further verification.
- **BLOCKED:** Verification cannot proceed because a dependency or required access is unavailable.

Code inspection alone does not establish that a security test passed. Test results in this report identify the branch on which each test was executed.

## 2. Authentication Security

**Evidence reviewed:** PR #25, authentication implementation, PR #36 login page, authentication middleware, and automated tests.

| ID | Security check | Evidence and finding | Status |
|---|---|---|---|
| AUTH-01 | Password hashing | Registration implementation uses bcrypt hashing with 10 rounds. | VERIFIED IN CODE |
| AUTH-02 | Invalid credentials | Tests cover incorrect passwords and unknown email addresses returning HTTP 401. | PASS |
| AUTH-03 | Inactive accounts | Tests check that inactive accounts cannot log in. | PASS |
| AUTH-04 | JWT expiry | Code configures a one-hour token expiry. | PARTIALLY VERIFIED |
| AUTH-05 | JWT signature and claims | Authentication middleware and tests cover invalid tokens, signature validation, and required claims. | PASS |
| AUTH-06 | Registration privilege escalation | Registration is intended to reject a submitted role field. A corresponding test exists. | TEST EXISTS |
| AUTH-07 | Login rate limiting | The test verifies that the sixth failed login attempt returns HTTP 429. The focused rate-limit suite passed locally on `main`. | PASS |
| AUTH-08 | Authentication route integration | Authentication route integration and login limiter placement were reviewed. | VERIFIED IN CODE |
| AUTH-09 | Login response validation | PR #36 added validation of the login response before storing the token and user in session storage. | CODE REVIEWED |
| AUTH-10 | API base URL configuration | PR #36 documents the localhost API URL as local-development-only and identifies deployment configuration requirements. | CODE REVIEWED |

**Automated test evidence:**

- The full backend test suite passed locally on `main`: 55 tests across five suites.
- The focused security test run on `main` passed: 48 tests across four suites.
- The focused run included `auth.test.js`, `authenticate.test.js`, `rateLimit.test.js`, and `tickets.test.js`.

**Remaining limitation:** The test results confirm the tested cases, not every possible authentication scenario. JWT expiry and registration role-rejection behavior should be described as fully verified only when the corresponding test coverage and results have been confirmed.

## 3. Access Control

**Evidence reviewed:** PR #27, ticket API routes, ticket access service, authentication middleware, and ticket tests.

| ID | Security check | Evidence and finding | Status |
|---|---|---|---|
| ACCESS-01 | Staff ticket visibility | Tests cover a staff user attempting to access another staff user's ticket. | PASS |
| ACCESS-02 | Support ticket visibility | Tests cover support access to tickets assigned to the support user. | PASS |
| ACCESS-03 | Admin-only operations | Tests cover role restrictions for privileged operations, including ticket assignment. | PASS |
| ACCESS-04 | Ticket status workflow | The implementation enforces status transitions. The intended permissions for closing and reopening tickets should be confirmed against the agreed workflow. | PARTIALLY VERIFIED |
| ACCESS-05 | Unauthorized ticket access | Tests verify that inaccessible tickets return HTTP 404 to avoid revealing their existence. | PASS |
| ACCESS-06 | Ticket assignment | The route restricts assignment to administrators and checks that the assignee has the Support role. | PASS |
| ACCESS-07 | JWT and account status | Authentication middleware checks the user against the database and handles account and role changes. | VERIFIED IN CODE |
| ACCESS-08 | Comment permissions | Tests cover owner and assigned-support access and reject unauthorized comments. | PASS |
| ACCESS-09 | Audit-log access | Ticket tests cover restrictions on audit-log access for non-admin users. | PASS |

**Automated test evidence:**

- On `main`, the focused security test run passed with 48/48 tests across four suites.
- On `feature/attachment-upload`, `tickets.test.js` passed with 19/19 tests.

The 19-ticket-test result was obtained on the attachment feature branch. It should not be presented as a separate test run on `main`.

**Remaining limitation:** Confirm the agreed permissions for closing and reopening tickets, and verify that all related changes are present in the final integrated version.

## 4. File Upload Security

**Evidence reviewed:** PR #33, `backend/src/routes/attachments.js`, and `backend/tests/attachments.test.js` on `feature/attachment-upload`.

| ID | Security check | Evidence and finding | Status |
|---|---|---|---|
| UPLOAD-01 | File size restriction | Multer enforces a 5 MB upload limit. Tests reject files larger than 5 MB. | PASS ON FEATURE BRANCH |
| UPLOAD-02 | Allowed file types | The route allows PNG, JPEG, PDF, and plain text and compares detected content with the declared MIME type. | PARTIALLY VERIFIED |
| UPLOAD-03 | File-content validation | PNG validation decodes the image and rejects invalid PNG data. A regression test rejects a file containing only the PNG signature. | PASS ON FEATURE BRANCH |
| UPLOAD-04 | Generated filenames | The server generates UUID-based filenames rather than using original filenames as stored names. | VERIFIED IN CODE |
| UPLOAD-05 | Storage location | Uploads are stored outside the public directory by default. | VERIFIED IN CODE |
| UPLOAD-06 | Upload authorization | Authentication and ticket visibility checks are applied before file receipt. Tests cover unauthorized uploads. | PASS ON FEATURE BRANCH |
| UPLOAD-07 | Download authorization | The download route checks ticket visibility and matches the attachment to the ticket. Tests cover unauthorized downloads. | PASS ON FEATURE BRANCH |
| UPLOAD-08 | Comment attachment validation | The route checks that a comment belongs to the same ticket as the attachment. | PASS ON FEATURE BRANCH |
| UPLOAD-09 | Upload and download tests | The attachment suite passed with 11/11 tests. | PASS ON FEATURE BRANCH |
| UPLOAD-10 | Error handling | Known Multer upload errors are converted into client errors. Broader error behavior has not been independently tested. | PARTIALLY VERIFIED |

**Attachment test results:**

The command `npm.cmd test -- --runInBand tests/attachments.test.js` was executed on `feature/attachment-upload`.

**Result: 11 tests passed, 0 failed.**

The tests covered:

- Valid PNG upload and authenticated uploader identity.
- Rejection of a PNG containing only its signature.
- Rejection of content that does not match its declared MIME type.
- Rejection of files larger than 5 MB.
- Rejection of a missing file.
- Authentication requirements.
- Unauthorized upload restrictions.
- Comment-to-ticket association.
- Authorized attachment download.
- Rejection of unauthorized attachment downloads.

**Integration limitation:** PR #33 was still open at the time of this review and targeted `main`. The attachment implementation and its test results have not yet been confirmed on the integrated `main` branch. The attachment tests must be run again on `main` after PR #33 is merged.

## 5. Audit Logging

**Evidence reviewed:** PR #27, `backend/src/services/audit.js`, `backend/src/routes/audit.js`, and `database/schema.sql`.

| ID | Security check | Evidence and finding | Status |
|---|---|---|---|
| AUDIT-01 | Event coverage | The audit service defines login, failed login, role change, ticket assignment, and status change actions. | VERIFIED IN CODE |
| AUDIT-02 | Parameterized inserts | Audit records are inserted using parameterized SQL values. | VERIFIED IN CODE |
| AUDIT-03 | Admin-only access | The audit route uses authentication and administrator authorization middleware. | VERIFIED IN CODE |
| AUDIT-04 | Query validation | The route validates action filters, user IDs, and pagination parameters. | VERIFIED IN CODE |
| AUDIT-05 | Sensitive information | The service serializes supplied details without sanitizing them. Callers must avoid including passwords, tokens, and other secrets. | OUTSTANDING CONCERN |
| AUDIT-06 | Audit write failures | The service catches database errors and logs them to the server console without propagating the failure. Whether this behavior is acceptable for security-critical events needs confirmation. | OUTSTANDING CONCERN |
| AUDIT-07 | Audit event verification | Relevant code exists, but successful creation and retrieval of audit records have not been independently tested as part of this review. | NOT VERIFIED |

### Audit logging concerns

**AUDIT-05: Sensitive information**

The team should confirm that audit event details never contain passwords, authentication tokens, or other secrets.

**AUDIT-06: Audit write failures**

The audit service catches database errors and logs them to the server console without propagating the failure. This means a login may still succeed when its audit record cannot be saved.

The team needs to decide whether this behavior satisfies the security requirements and document the decision.

**AUDIT-07: Audit event verification**

The existence of audit code does not prove that records are successfully created and retrieved in runtime conditions. Additional verification is required before marking this item as passed.

## 6. API and Input Security

**Evidence reviewed:** PR #27, `backend/src/schemas/tickets.js`, `backend/src/routes/tickets.js`, and ticket tests.

| ID | Security check | Evidence and finding | Status |
|---|---|---|---|
| API-01 | Ticket input validation | Zod schemas validate ticket title, description, category, priority, and comment fields. | VERIFIED IN CODE |
| API-02 | Mass assignment protection | Strict schemas reject unexpected fields such as `created_by` and `status` during ticket creation. | PASS |
| API-03 | Identifier validation | Ticket identifiers must be positive integers. Tests cover invalid identifiers. | PASS |
| API-04 | Pagination validation | Page and limit are validated, with a minimum page of 1 and maximum limit of 100. | VERIFIED IN CODE |
| API-05 | SQL injection protection | Inspected ticket queries use parameterized values. The listing route uses an allowed set of filter column names. | VERIFIED IN CODE FOR INSPECTED QUERIES |
| API-06 | Authentication middleware | Ticket routes apply authentication middleware. | PASS |
| API-07 | Error responses | Some errors are handled through application error handling. All relevant error responses have not been tested for sensitive information disclosure. | PARTIALLY VERIFIED |
| API-08 | Runtime input behavior | Automated tests cover several invalid inputs and injection attempts. | PASS FOR TESTED CASES |

**Remaining limitation:** These results apply to the inspected code and executed test cases. They do not prove that all API inputs and error paths are secure.

## 7. Automated Test Evidence Summary

The following local test runs were completed during this review.

| Test run | Branch | Result | Interpretation |
|---|---|---|---|
| Full backend test suite | `main` | 55/55 passed | All five test suites passed locally. |
| Focused security suite | `main` | 48/48 passed | Authentication, JWT validation, rate limiting, and ticket API tests passed. |
| Attachment test suite | `feature/attachment-upload` | 11/11 passed | Attachment upload and download tests passed on the feature branch. |
| Ticket test suite | `feature/attachment-upload` | 19/19 passed | Ticket authentication, access-control, status, comment, and audit-route tests passed on the feature branch. |

The focused security tests overlap with the full backend suite and must not be added to its total.

These results confirm local execution of the listed tests. They do not establish that every security requirement has been independently tested or that attachment functionality is already integrated into `main`.

## 8. Pull Request Review Status

The following pull requests were reviewed during the security review period.

| PR | Subject | Status at review |
|---|---|---|
| #27 | Tickets API, access control, and audit logging | Merged into `main` |
| #33 | Secure ticket attachment uploads and downloads | Open at the last status check; merge and integration require confirmation |
| #35 | Security checklist and review report | Open; report updates and review remain pending |
| #36 | Login page | Merged into `main` |
| #38 | Ticket list page | Open at the last status check; review status must be checked again |
| #62 | API/frontend readiness | Merged into `main` |

This table records the statuses observed during the review. The current GitHub status should be checked before the final demonstration.

Other relevant pull requests should be reviewed for outstanding comments and changes involving authentication, access control, and file uploads before the security review is declared complete.

## 9. Outstanding Issues and Follow-up Actions

The following actions remain necessary:

1. Confirm that audit logs do not contain passwords, tokens, or other sensitive information (AUDIT-05).
2. Decide how security-critical audit-write failures should be handled (AUDIT-06).
3. Verify that audit events can be successfully created and retrieved (AUDIT-07).
4. Complete the review and merge of PR #33, then run attachment tests on the integrated `main` branch.
5. Confirm that ticket closing and reopening permissions match the agreed workflow.
6. Check the current status and outstanding review comments of relevant open pull requests.
7. Run any remaining required runtime security checks and record their actual results.
8. Confirm that the final report reflects the code and test results used for the Friday demonstration.

Outstanding concerns must remain visible until they are resolved or formally accepted by the team.

## 10. Final Security Review Summary

**Overall status: Security review in progress.**

### Confirmed test results

- Full backend test suite on `main`: 55/55 tests passed.
- Focused security suite on `main`: 48/48 tests passed.
- Attachment test suite on `feature/attachment-upload`: 11/11 tests passed.
- Ticket test suite on `feature/attachment-upload`: 19/19 tests passed.

### Security controls tested

The executed tests covered authentication failures, JWT validation, login rate limiting, ticket visibility, role restrictions, comment permissions, file upload validation, upload size limits, and attachment download authorization.

### Outstanding concerns

Audit-data sanitization, audit-write failure handling, audit event verification, ticket workflow permissions, and confirmation of attachment integration into `main` remain outstanding.

### Final conclusion

The executed automated tests passed in the branches identified in this report. The results provide evidence that the tested authentication, access-control, rate-limiting, ticket API, and attachment behaviors work as expected in those versions.

The overall security review cannot yet be declared fully passed. The remaining concerns must be resolved or formally accepted by the team, the attachment implementation must be verified on `main`, and the final findings must be reviewed and recorded.

This report does not claim that the entire application is free of security vulnerabilities.

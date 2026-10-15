# Authentication and File Upload Security Review

**Project:** Secure IT Helpdesk Ticketing System  
**Reviewer: ** Rosemond Dasilvera Pappoe  
**Review stage:** Initial preparation  
**Status:** Pending review

## 1. Purpose

This document prepares the security requirements for reviewing the helpdesk system's authentication and file-upload features.

The actual implementation has not yet been reviewed. No security approval or confirmed vulnerability is being claimed at this stage.

## 2. Authentication Security Review

Authentication is the process of verifying a user's identity during login.

| No. | Security check | Expected protection | Status |
| 1 | Password storage | Store passwords using bcrypt hashing, not plain text. | Pending review |
| 2 | User registration | Prevent users from assigning themselves Admin or Support roles. | Pending review |
| 3 | Login protection | Limit repeated login attempts and record failed logins. | Pending review |
| 4 | JWT security | Use a secure signing secret and enforce the planned one-hour expiry. | Pending review |
| 5 | Role permissions | Enforce Staff, Support and Admin permissions on the backend. | Pending review |
| 6 | Ticket ownership | Prevent unauthorized access to another user's tickets. | Pending review |
| 7 | Database security | Use parameterized SQL queries to prevent SQL injection. | Pending review |
| 8 | Inactive accounts | Prevent inactive users from accessing protected features. | Pending review |

## 3. File Upload Security Review

| No. | Security check | Expected protection | Status |
| 1 | Allowed file types | Allow only PNG, JPG, PDF and TXT files. | Pending review |
| 2 | File size | Reject files larger than 5 MB. | Pending review |
| 3 | Filename handling | Generate a unique server-side filename. | Pending review |
| 4 | File validation | Validate uploaded files on the server. | Pending review |
| 5 | Storage location | Store uploaded files outside publicly accessible folders. | Pending review |
| 6 | Download permissions | Check ticket access before allowing downloads. | Pending review |
| 7 | Path traversal | Prevent access to files outside the intended storage directory. | Pending review |
| 8 | Error handling | Avoid exposing internal paths or sensitive server details. | Pending review |

## 4. Initial Recommendations

1. Enforce authentication and authorization on the backend.
2. Never store passwords as plain text.
3. Prevent public registration from granting privileged roles.
4. Keep JWT secrets and database credentials out of source control.
5. Validate uploaded files and generate safe filenames.
6. Store attachments privately and check permissions before downloads.
7. Never log passwords or authentication tokens.
8. Review and test the implementation before declaring it secure.

## 5. Items Requiring Confirmation

- Authentication flow and implementation.
- Password hashing and JWT expiry.
- Role and ticket-ownership checks.
- Login rate limiting.
- File-upload validation and storage.
- Attachment download permissions.

## 6. Next Actions

1. Obtain the authentication and file-upload designs or relevant pull requests.
2. Compare them against the requirements in this document.
3. Record security gaps with evidence and recommended fixes.
4. Update the review status after inspecting the implementation.
5. Retest issues after fixes are made.

## 7. Current Conclusion

This is an initial security review document. The review remains incomplete until the relevant designs or implementation are available and examined.

No conclusion has yet been made that the authentication or file-upload features are secure or vulnerable.

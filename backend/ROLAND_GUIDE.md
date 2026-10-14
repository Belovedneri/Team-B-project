# Roland – Backend Guide (Team B Helpdesk)

## Your role
From the brief, you own:
- **Tickets API**: create, list with filters, view, status changes (Open → In Progress → Resolved → Closed)
- **Comments API**
- **Access control**: role and ownership checks on every protected endpoint
- **Rate limiting** on the login endpoint
- **Audit logging**: logins, failed logins, role changes, ticket assignment, status changes, plus an admin-only endpoint to view them
- **API tests** for your endpoints, including 401, 403 and validation cases

Not yours, but you depend on them: Philipa (DB, auth, JWT), Sarah (SLA fields, attachments, Swagger). Rosemond reviews your access-control PRs.

## Tech stack
| Layer | Choice | Why |
|---|---|---|
| Runtime | Node.js 20+ | Team standard |
| Framework | Express 5 | Async errors reach the error handler without try/catch |
| Database | PostgreSQL via `pg` | The brief requires parameterised queries, so use raw SQL with `$1` placeholders and no ORM |
| Validation | Zod | Named in the brief; `.strict()` blocks mass assignment |
| Auth | `jsonwebtoken` (Philipa issues tokens, you verify them) | 1-hour expiry |
| Rate limiting | `express-rate-limit` | Login: 5 failed attempts per 15 minutes |
| Security headers | `helmet`, `cors` | Cheap wins for Rosemond's report |
| Tests | Jest + Supertest + `pg-mem` | Tests run without a real database |

## Endpoints you deliver
| Method | Path | Who |
|---|---|---|
| POST | `/api/tickets` | staff, admin |
| GET | `/api/tickets?status=&priority=&category=&page=&limit=` | all (staff see own tickets, support see assigned tickets, admin see all) |
| GET | `/api/tickets/:id` | anyone who can see it |
| PATCH | `/api/tickets/:id/status` | depends on role and current status (table below) |
| PATCH | `/api/tickets/:id/assign` | admin |
| GET/POST | `/api/tickets/:id/comments` | anyone who can see the ticket |
| GET | `/api/audit-logs?action=&actorId=` | admin |

**Status rules** (`src/services/ticketAccess.js`):
- support: open → in_progress → resolved (only on tickets assigned to them)
- staff: resolved → closed (confirm the fix), or resolved → in_progress (reopen)
- admin: any forward step, plus reopening

**Security choice to mention in the demo:** if a user requests a ticket they can't see, the API returns **404**, not 403, so nobody can probe which ticket IDs exist (prevents IDOR enumeration).

## Step-by-step plan

### Today (Tue 13 Oct)
1. **Agree contracts with Philipa** (15 minutes, before writing anything):
   - JWT payload is `{ sub: userId, role }`, signed with HS256 and `JWT_SECRET`.
   - Enum values are lowercase: `staff/support/admin`, `open/in_progress/resolved/closed`, and so on.
   - Compare `database/roland_tables.sql` with her schema and merge it into `/database`.
   - She calls `audit.log(...)` on login success, login failure and role changes (see `src/services/audit.js`).
2. Create the branch `feature/tickets-api`, then copy this code into `/backend`.
3. Run `npm install` and `npm test`. All 19 tests should pass.

### Wed 14 Oct
4. Point `.env` at the team database, run Philipa's seed, and test with Postman/Thunder Client using a real login token.
5. Open a small PR for the **tickets CRUD and filters**, and tag Rosemond as reviewer.

### Thu 15 Oct
6. Open a PR for **status flow, assignment and comments**.
7. Wire `loginLimiter` in front of Philipa's login route. It's already in `app.js`, so just uncomment her router below it.
8. Tell Sarah where her hooks go: there are `// Sarah:` comments for `due_at` on create and `resolved_at` on resolve.

### Fri 16 Oct (Sprint 1 review)
9. Demo: login → create ticket → view ticket as staff → a second staff user gets 404.

### Mon 19 – Tue 20 Oct
10. Finish the audit endpoint PR, then add audit coverage for Philipa's login and role events.
11. Give Sarah request/response examples for Swagger (use the test cases as the source).

### Wed 21 – Thu 22 Oct
12. Fix Rosemond's findings, add a regression test for each one, and merge everything by Thursday.

## Commit examples
```
feat(tickets): add create and list endpoints with role-based visibility
feat(tickets): enforce status transitions per role
feat(audit): log assignment and status changes
feat(auth): rate-limit login to 5 failed attempts per 15 min
test(tickets): cover 401/403/404 and validation cases
```

## Run it
```bash
cp .env.example .env    # fill in real values; never commit .env
npm install
npm test                # in-memory DB, no Postgres needed
npm run dev             # needs DATABASE_URL and Philipa's auth routes
```

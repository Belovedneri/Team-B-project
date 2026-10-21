# Secure IT Helpdesk Ticketing System

A web-based IT helpdesk where staff log issues, support staff resolve them within agreed timeframes (SLA), and an admin oversees everything. Security is built in from the start: bcrypt-hashed passwords, JWT authentication, role-based access control, login rate limiting, audit logging and parameterised queries.

## Tech stack
Node.js and Express, PostgreSQL, JWT, bcrypt, Zod validation, Jest and Supertest for tests, and a vanilla HTML/CSS/JavaScript frontend.

## Setup
Prerequisites: Node.js 20 or newer, PostgreSQL, Git.

1. Clone the repo: `git clone https://github.com/Belovedneri/Team-B-project.git`
2. Create the database: `psql -U postgres -c "CREATE DATABASE helpdesk;"`
3. Load the schema, then the sample data (development only, the seed script empties the tables first):
```
   psql -U postgres -d helpdesk -f database/schema.sql
   psql -U postgres -d helpdesk -f database/seed.sql
```
4. Install the backend: `cd backend`, then `npm install`.
5. Copy `.env.example` to `.env` and fill in `DATABASE_URL` and `JWT_SECRET` (a long random string). Never commit `.env`.
6. Start the API with `npm start`. Run the tests with `npm test`.

The sample accounts (one admin, two support, three staff) are listed in the header of `database/seed.sql`.

## Roles
- **Staff:** create and view their own tickets
- **Support:** view and update tickets assigned to them
- **Admin:** manage users, assign tickets, view everything

## API
Every route except register and login needs `Authorization: Bearer <token>`. Ticket and audit-log routes wrap the result in `data`; register returns `{ user }` and login returns `{ token, user }`. Errors return `{ error: { message } }`.

| Method | Path | Who |
|---|---|---|
| POST | `/api/auth/register` | anyone (always creates a staff account; sending `role` is rejected) |
| POST | `/api/auth/login` | anyone (rate limited) |
| POST | `/api/tickets` | staff, admin |
| GET | `/api/tickets?status=&priority=&category=&page=&limit=` | all (staff see their own tickets, support see assigned tickets, admin see all) |
| GET | `/api/tickets/:id` | anyone who can see the ticket |
| PATCH | `/api/tickets/:id/status` | depends on role and current status (below) |
| PATCH | `/api/tickets/:id/assign` | admin |
| GET | `/api/tickets/:id/comments` | anyone who can see the ticket; oldest first, each with `user_name` and `user_role` |
| POST | `/api/tickets/:id/comments` | anyone who can see the ticket; body `{ "body": "..." }`; 400 if the ticket is closed |
| GET | `/api/audit-logs?action=&userId=` | admin |

**Status rules** (`backend/src/services/ticketAccess.js`):
- Support: Open → In Progress → Resolved, only on tickets assigned to them
- Staff: Resolved → Closed (confirm the fix) or Resolved → In Progress (reopen)
- Admin: Open → In Progress or Closed, In Progress → Resolved, Resolved → Closed or In Progress. An In Progress ticket must be resolved before it can be closed
- Closed is final for every role. If someone else changed the status first, the update returns 409 and the page should reload the ticket

A ticket the user can't see returns 404, not 403, so nobody can probe which ticket IDs exist.

## Team
| Member | Area |
|---|---|
| Philipa Amoako (team lead) | Database, authentication, frontend lead |
| Roland Daniels | Tickets and comments API, access control, audit logging, rate limiting |
| Sarah Baidu | SLA tracking, reports, attachments, API documentation |
| Rosemond Pappoe | Threat model, security testing and report, security reviews |
| Adiza | Frontend |
| Esther Korklu Anum (from 19 Oct) | Frontend: filters, Support and Admin views, overdue indicator, admin reports page |

## Folders
- `/frontend`: HTML, CSS and vanilla JavaScript
- `/backend`: Express API
- `/database`: schema and seed scripts
- `/security`: threat model, test checklist, security report

## Git workflow
All work happens on branches and goes into `main` through pull requests. Rosemond reviews any PR touching authentication, access control or file uploads.

## Still to come
Swagger docs at `/api-docs`, screenshots and a final architecture section.

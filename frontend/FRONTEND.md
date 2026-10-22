# Frontend Guide

Plain HTML, CSS and JavaScript. No framework and no build step.

## Folder layout

- `frontend/register.html`: registration page
- `frontend/login.html`: login page
- `frontend/tickets.html`: ticket list with status and priority filters and paging
- `frontend/create-ticket.html`: form to create a new ticket
- `frontend/ticket.html`: ticket detail page, with the ticket's comments
- `frontend/css/style.css`: shared styles for all pages
- `frontend/js/config.js`: the API address (`API_BASE`), loaded before the other scripts
- `frontend/js/login.js`: login form logic
- `frontend/js/tickets.js`: loads and renders the ticket list
- `frontend/js/create-ticket.js`: create-ticket form logic and validation
- `frontend/js/ticket.js`: loads one ticket and its comments

## Running it locally

1. Start the backend: `cd backend`, then `npm start` (port 3000).
2. Serve the frontend at http://localhost:5500, for example with VS Code Live Server or `npx http-server frontend -p 5500 -c-1`.
3. Open http://localhost:5500/login.html

The backend only allows requests from the address in `CORS_ORIGIN` (default http://localhost:5500). Open the pages as `localhost`, not `127.0.0.1`, and do not open them directly from a file. Otherwise the pages show "Cannot reach the server".

## How pages talk to the API

- Every page loads `js/config.js` first, then its own script.
- Requests use `fetch` to `${API_BASE}/api/...` with JSON bodies.
- After login, the token and user are kept in `sessionStorage` (`token`, `user`). Protected requests send `Authorization: Bearer <token>`.
- The token lasts one hour. If the API returns 401, the page clears the session and redirects to the login page.
- Error responses look like `{ "error": { "message": "..." } }`. Show the message with `textContent`, never `innerHTML`.
- The list and detail pages check the shape of the API response before rendering and show a clear error if it is wrong.

## Conventions

- Reuse the classes in `style.css`.
- Never put secrets or real passwords in frontend files.
- Work on a branch, open a pull request, and ask for a review.

## Status

Done: register page, login page, ticket list (filters and paging), create-ticket form, ticket detail page with comments, and a form to add comments.

Not built yet: the Support and Admin views (staff view). Ticket due times (SLA) and reports are in a separate pull request that is still under review.

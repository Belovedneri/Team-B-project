# Frontend Guide

Plain HTML, CSS and JavaScript. No framework and no build step.

## Folder layout

- `frontend/register.html`: registration page
- `frontend/login.html`: login page
- `frontend/tickets.html`: ticket list (in progress)
- `frontend/css/style.css`: shared styles for all pages
- `frontend/js/config.js`: the API address (`API_BASE`), loaded before the other scripts
- `frontend/js/login.js`: login form logic

## Running it locally

1. Start the backend: `cd backend`, then `npm start` (port 3000).
2. Serve the frontend at http://localhost:5500: `npx http-server frontend -p 5500 -c-1`
3. Open http://localhost:5500/login.html

The backend only allows requests from the address in `CORS_ORIGIN`
(default http://localhost:5500). Do not open the pages directly from a file.

## How pages talk to the API

- Every page loads `js/config.js` first, then its own script.
- Requests use `fetch` to `${API_BASE}/api/...` with JSON bodies.
- After login, the token and user are kept in `sessionStorage`
  (`token`, `user`). Protected requests send
  `Authorization: Bearer <token>`.
- Error responses look like `{ "error": { "message": "..." } }`. Show the
  message with `textContent`, never `innerHTML`.

## Conventions

- Reuse the classes in `style.css` (`register-container`, `register-card`,
  `form-group`, `form-error`).
- Never put secrets or real passwords in frontend files.
- Work on a branch, open a pull request, and ask for a review.

## Status

Done: register page, login page. In progress: ticket list.
Planned: create-ticket form, ticket detail with comments, Staff view.
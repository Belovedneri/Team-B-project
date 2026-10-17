# Sprint 1 Retrospective (12–16 Oct 2026)

## What went well
- Fast start: repo, invites, sprint board and the "never work on main" rule were in place on day one.
- Good questions early: Rosemond asked who owns auth and file upload before code was written; Sarah's schema review added the constraint tying an attachment's comment to the same ticket.
- Database schema and seed data merged by Wednesday morning, so the backend could build on them.
- Login and register work end to end (bcrypt, JWT, login rate limiting) and the ticket list works in the browser.
- Security review found real issues before anything reached main (JWT validation, staff close rule, file validation) - #22, #27, #33.
- Tests and CI are in place (43 passing on #27); the pipeline and docker compose were ready by Thursday.
- Adiza finished the registration page; Sarah split her work into smaller PRs.

## What did not go well
1. Issues had no descriptions, so Sarah had to stop and ask (Tue and Thu, issue #4).
2. Branch protection was requested twice (Tue, Thu) and is still not set up.
3. PR #22 stalled for days: Rosemond waited for confirmation on her JWT and status-permission concerns, and Sarah held back her integration work.
4. The stacked-PR plan depended on #22 merging. #27 replaced #22, so #33 and #34 ended up on a dead base branch.
5. Availability gaps (network, power cut, travel) delayed replies, and nobody knew when to expect anyone back.
6. The project board was not visible to Sarah on Tuesday (permissions), fixed after about 40 minutes.

## What we will change in Sprint 2
1. No card enters a sprint without a short description and a clear "done" - cards ready before Monday kickoff.
2. Branch protection on main set up Monday morning, after #27 merges.
3. Every PR has a named reviewer (plus Rosemond for auth, access control and uploads); reviewers reply within 24 hours; authors answer every comment before asking for re-review.
4. Branch from the latest main by default; if building on an unmerged branch, say so in the PR and check the base before review; keep PRs small and merge within a day or two.
5. Post a line in the group when you will be offline, and agree a fixed daily check-in time on Monday.
6. Day-one checklist for every new member: repo invite, board access, an assigned card (Esther starts Monday 19 Oct).
7. One owner per area of code: agree who owns a PR in the chat before two people touch the same files.
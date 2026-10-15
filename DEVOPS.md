#  Team B: DevOps & Infrastructure Guide

Welcome to the infrastructure documentation for the Secure IT Helpdesk Ticketing System. This guide covers our local Docker environment, continuous integration (CI) pipelines, and repository management rules.

##  Prerequisites
Before starting, ensure you have the following installed on your machine:
- **Docker Desktop** (Make sure the Docker engine is running)
- **Git**

## 🛠️Local Development Environment

We use Docker Compose to containerize our PostgreSQL database and Node.js backend. This ensures everyone on the team runs the exact same environment without local installation conflicts or version mismatches.

### 1. Environment Setup
Never commit real secrets or passwords to the repository. 
1. Copy the template environment file:
   `cp .env.example .env`
2. Open `.env` and verify that `DB_PASSWORD` exactly matches the `POSTGRES_PASSWORD` defined in `docker-compose.yml`.

### 2. Start the Containers
Run the following command from the root of the repository to build the images and spin up the services:
`docker-compose up --build`

### 3. Available Services
Once the build completes and the terminal logs indicate the database system is ready to accept connections, your services are live at:
- **Backend API:** `http://localhost:3000`
- **PostgreSQL Database:** `localhost:5432`

 Note: On its first startup, the database container automatically mounts and executes `/database/schema.sql` to build the tables, followed immediately by `/database/seed.sql` to populate sample users (Admin, Support, Staff) and sample tickets.*

### 4. Stopping the Environment
To gracefully stop the containers, press `Ctrl+C` in the terminal where Docker is running. To completely remove the containers and reset the database volume, run:
`docker-compose down -v`

---

##  Continuous Integration (CI) Pipeline

To maintain the integrity of our API, all pull requests targeting the `main` branch trigger our automated CI pipeline via GitHub Actions (`.github/workflows/api-tests.yml`).

- **Automated Testing:** The pipeline provisions an isolated PostgreSQL test database, installs all backend dependencies, and executes the Jest and Supertest test suites.
- **Merge Blocker:** A pull request cannot be merged unless all API tests pass successfully, including validation checks and 401/403 access control cases.

---

## 🛡️Repository Rules & Workflow

We enforce strict branch protection to ensure the `main` branch always reflects secure, working code.

1. **No Direct Pushes:** All code changes must be submitted through branches and Pull Requests.
2. **Required Approvals:** PRs require review and approval before merging.
3. **Code Owners Enforced:**
   - **Security:** Rosemond must review and approve any PR that touches authentication, access control, or file uploads.
   - **DevOps:** Any modifications to the GitHub Actions workflows, Docker configurations, or the `CODEOWNERS` file require DevOps approval.

# Team-B-project
# Secure IT Helpdesk Ticketing System

Backend REST API for the Secure IT Helpdesk Ticketing System, built with **Node.js, Express, and TypeScript**.

## Backend Setup

### Prerequisites
- Node.js
- npm
- Express (installed automatically with the project dependencies)

### Installation

Navigate to the backend directory:

```bash
cd backend
```

Install the dependencies:

```bash
npm install
```

### Run the Development Server

```bash
npm run dev
```

The API runs at `http://localhost:3000` by default.

### Build the Backend

```bash
npm run build
```

## API Documentation

This project uses **Swagger UI** and **OpenAPI** to document the API.

With the development server running, visit:

`http://localhost:3000/api-docs`

You can view documented endpoints and test them using **Try it out**.

## Health Check

- **Method:** GET
- **Endpoint:** `/health`
- **URL:** `http://localhost:3000/health`

Returns a response confirming that the API is running.
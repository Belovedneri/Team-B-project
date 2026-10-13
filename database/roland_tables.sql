-- Tables Roland's endpoints depend on.
-- Philipa owns the final schema in /database; agree these columns with her on day 1.
-- Sarah adds SLA columns (due_at, resolved_at) to tickets.

CREATE TYPE user_role       AS ENUM ('staff', 'support', 'admin');
CREATE TYPE ticket_status   AS ENUM ('open', 'in_progress', 'resolved', 'closed');
CREATE TYPE ticket_priority AS ENUM ('low', 'medium', 'high');
CREATE TYPE ticket_category AS ENUM ('hardware', 'software', 'network', 'access');

CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          user_role NOT NULL DEFAULT 'staff',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tickets (
  id          SERIAL PRIMARY KEY,
  title       VARCHAR(150) NOT NULL,
  description TEXT NOT NULL,
  category    ticket_category NOT NULL,
  priority    ticket_priority NOT NULL,
  status      ticket_status   NOT NULL DEFAULT 'open',
  created_by  INTEGER NOT NULL REFERENCES users(id),
  assigned_to INTEGER REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tickets_created_by  ON tickets(created_by);
CREATE INDEX idx_tickets_assigned_to ON tickets(assigned_to);

CREATE TABLE comments (
  id         SERIAL PRIMARY KEY,
  ticket_id  INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  author_id  INTEGER NOT NULL REFERENCES users(id),
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_comments_ticket ON comments(ticket_id);

CREATE TABLE audit_logs (
  id          SERIAL PRIMARY KEY,
  actor_id    INTEGER REFERENCES users(id),   -- NULL for failed logins by unknown emails
  action      VARCHAR(50) NOT NULL,           -- LOGIN_SUCCESS, LOGIN_FAILED, ROLE_CHANGED, TICKET_ASSIGNED, STATUS_CHANGED
  entity_type VARCHAR(30),
  entity_id   INTEGER,
  details     JSONB,                          -- never store passwords or tokens here
  ip_address  VARCHAR(45),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_action  ON audit_logs(action);
CREATE INDEX idx_audit_created ON audit_logs(created_at);

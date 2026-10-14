-- Secure IT Helpdesk: PostgreSQL schema
-- Put this file in /database/schema.sql
-- Run with: psql "$DATABASE_URL" -f database/schema.sql
--
-- Notes for the team:
--   * Roles, categories, priorities and statuses are enums, so the database rejects bad values.
--   * tickets.due_at and tickets.resolved_at are here for Sarah's SLA logic (High 4h, Medium 24h, Low 72h).
--     "Overdue" is not stored: a ticket is overdue when due_at < now() and status is not Resolved or Closed.
--     Resolution time = resolved_at - created_at.
--   * Files are stored on disk under generated names; the database keeps that generated name only,
--     never the user's original file name.
--   * Always use parameterised queries ($1, $2, ...) from the backend. Never build SQL from strings.

BEGIN;

-- ---------- Enums ----------
CREATE TYPE user_role       AS ENUM ('staff', 'support', 'admin');
CREATE TYPE ticket_category AS ENUM ('Hardware', 'Software', 'Network', 'Access');
CREATE TYPE ticket_priority AS ENUM ('Low', 'Medium', 'High');
CREATE TYPE ticket_status   AS ENUM ('Open', 'In Progress', 'Resolved', 'Closed');
CREATE TYPE audit_action    AS ENUM (
  'LOGIN', 'LOGIN_FAILED', 'ROLE_CHANGE', 'TICKET_ASSIGNED', 'STATUS_CHANGE'
);

-- ---------- Shared trigger: keep updated_at current ----------
CREATE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------- users ----------
CREATE TABLE users (
  id             INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name           TEXT        NOT NULL,
  email          TEXT        NOT NULL UNIQUE,
  password_hash  TEXT        NOT NULL,          -- bcrypt hash only, never the password
  role           user_role   NOT NULL DEFAULT 'staff',
  is_active      BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------- tickets ----------
CREATE TABLE tickets (
  id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title        TEXT            NOT NULL,
  description  TEXT            NOT NULL,
  category     ticket_category NOT NULL,
  priority     ticket_priority NOT NULL,
  status       ticket_status   NOT NULL DEFAULT 'Open',
  created_by   INTEGER         NOT NULL REFERENCES users(id),
  assigned_to  INTEGER         REFERENCES users(id) ON DELETE SET NULL,
  due_at       TIMESTAMPTZ,                      -- set by SLA logic from priority
  resolved_at  TIMESTAMPTZ,                      -- set when status becomes Resolved
  created_at   TIMESTAMPTZ     NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ     NOT NULL DEFAULT now()
);
CREATE TRIGGER tickets_updated_at BEFORE UPDATE ON tickets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_tickets_status      ON tickets (status);
CREATE INDEX idx_tickets_priority    ON tickets (priority);
CREATE INDEX idx_tickets_category    ON tickets (category);
CREATE INDEX idx_tickets_created_by  ON tickets (created_by);
CREATE INDEX idx_tickets_assigned_to ON tickets (assigned_to);
CREATE INDEX idx_tickets_due_at      ON tickets (due_at);

-- ---------- comments ----------
CREATE TABLE comments (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ticket_id   INTEGER     NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id     INTEGER     NOT NULL REFERENCES users(id),
  body        TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, ticket_id)
);
CREATE INDEX idx_comments_ticket_id ON comments (ticket_id);

-- ---------- attachments ----------
-- An attachment belongs to a ticket, and optionally to one of its comments.
CREATE TABLE attachments (
  id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ticket_id    INTEGER     NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  comment_id   INTEGER,
  uploaded_by  INTEGER     NOT NULL REFERENCES users(id),
  stored_name  TEXT        NOT NULL UNIQUE,      -- generated name on disk (e.g. a UUID + extension)
  mime_type    TEXT        NOT NULL
               CHECK (mime_type IN ('image/png', 'image/jpeg', 'application/pdf', 'text/plain')),
  size_bytes   INTEGER     NOT NULL
               CHECK (size_bytes > 0 AND size_bytes <= 5 * 1024 * 1024),  -- 5 MB limit
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (comment_id, ticket_id) REFERENCES comments (id, ticket_id) ON DELETE CASCADE
);
CREATE INDEX idx_attachments_ticket_id ON attachments (ticket_id);

-- ---------- audit_logs ----------
-- user_id is NULL for failed logins where no account matched. Never store passwords or tokens in details.
CREATE TABLE audit_logs (
  id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id      INTEGER      REFERENCES users(id) ON DELETE SET NULL,
  action       audit_action NOT NULL,
  entity_type  TEXT,                              -- e.g. 'ticket', 'user'
  entity_id    INTEGER,
  details      JSONB        NOT NULL DEFAULT '{}'::jsonb,
  ip_address   INET,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_logs_created_at ON audit_logs (created_at DESC);
CREATE INDEX idx_audit_logs_user_id    ON audit_logs (user_id);
CREATE INDEX idx_audit_logs_action     ON audit_logs (action);

COMMIT;

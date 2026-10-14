-- Secure IT Helpdesk: sample data for development and demos
-- Put this file in /database/seed.sql and run AFTER schema.sql:
--   psql "$DATABASE_URL" -f database/seed.sql
--
-- WARNING: this script EMPTIES users, tickets, comments, attachments and audit_logs first.
-- Use it on a development database only, never on real data.
--
-- Sample login for every user below (development only, not a real password):
--   password: Helpdesk#2026
-- Passwords are stored as bcrypt hashes, exactly as the real registration code should store them.
--
--   admin@helpdesk.test      admin
--   support1@helpdesk.test   support
--   support2@helpdesk.test   support
--   staff1@helpdesk.test     staff
--   staff2@helpdesk.test     staff
--   staff3@helpdesk.test     staff
--
-- Ticket dates are relative to now(), so there is always a mix of on-time, overdue and resolved
-- tickets. due_at follows the SLA: High = 4 hours, Medium = 24 hours, Low = 72 hours after creation.

BEGIN;

TRUNCATE audit_logs, attachments, comments, tickets, users RESTART IDENTITY CASCADE;

-- ---------- users ----------
INSERT INTO users (name, email, password_hash, role) VALUES
  ('Admin User',   'admin@helpdesk.test',    '$2b$10$49LU5bWbpMgp484WiT4sV..B3KEvQlrpxRzPBBhyyjUBnbJEFMqF.', 'admin'),
  ('Support One',  'support1@helpdesk.test', '$2b$10$/NVxh4nwCglmXezZWXZXOeTJ9WSvfCxUXmHOILfcnqIsiJSBQYA/.', 'support'),
  ('Support Two',  'support2@helpdesk.test', '$2b$10$cAfr3t7ssOcZPWDv4Js.EOJSqbbOLaX45zVnJMzZkeB5Ev41UleW2', 'support'),
  ('Staff One',    'staff1@helpdesk.test',   '$2b$10$rUTRoo7.P1i2tb0bAdVKXeJsr8wXVaaCvX./p1fP9KI0Z.Bovauqa', 'staff'),
  ('Staff Two',    'staff2@helpdesk.test',   '$2b$10$SsaZoPYoUsVKxii2Vpcrre7RlKuAGtqjt0vJeFTYdy5A2BtpOYpuG', 'staff'),
  ('Staff Three',  'staff3@helpdesk.test',   '$2b$10$pXyDaESwLF9COn3jR7Lgcew9Mcp08z0EmXgonR3GdfhdbGgW2mJMq', 'staff');

-- ---------- tickets ----------
-- Columns: title, description, category, priority, status, created_by, assigned_to, created_at, resolved_at
-- due_at is computed from priority and created_at below.
WITH t (title, description, category, priority, status, creator, assignee, age, resolved_after) AS (
  VALUES
    ('Laptop will not boot',            'Laptop shows a black screen after the logo.',                'Hardware', 'High',   'Open',        'staff1@helpdesk.test', NULL,                      interval '30 minutes', NULL::interval),
    ('Cannot connect to office Wi-Fi',  'Wi-Fi shows connected but there is no internet access.',     'Network',  'High',   'In Progress', 'staff2@helpdesk.test', 'support1@helpdesk.test',  interval '2 hours',    NULL),
    ('Server room VPN down',            'VPN fails for the whole finance team since this morning.',   'Network',  'High',   'Open',        'staff3@helpdesk.test', 'support2@helpdesk.test',  interval '6 hours',    NULL),
    ('Install accounting software',     'Need the accounting application installed on my PC.',        'Software', 'Medium', 'Open',        'staff1@helpdesk.test', NULL,                      interval '3 hours',    NULL),
    ('Printer on floor 2 not printing', 'Print jobs stay in the queue and never print.',              'Hardware', 'Medium', 'In Progress', 'staff2@helpdesk.test', 'support2@helpdesk.test',  interval '10 hours',   NULL),
    ('Request access to shared drive',  'Need read access to the HR shared drive for onboarding.',    'Access',   'Medium', 'Open',        'staff3@helpdesk.test', 'support1@helpdesk.test',  interval '30 hours',   NULL),
    ('Reset email password',            'Locked out of my email account after too many attempts.',    'Access',   'High',   'Resolved',    'staff1@helpdesk.test', 'support1@helpdesk.test',  interval '3 days',     interval '3 hours'),
    ('Update PDF reader',               'PDF reader shows a security warning on start.',              'Software', 'Low',    'Resolved',    'staff2@helpdesk.test', 'support2@helpdesk.test',  interval '4 days',     interval '2 days'),
    ('Replace broken keyboard',         'Several keys on my keyboard do not respond.',                'Hardware', 'Low',    'Closed',      'staff3@helpdesk.test', 'support1@helpdesk.test',  interval '6 days',     interval '1 day'),
    ('Slow internet in meeting room',   'Video calls drop in the main meeting room.',                 'Network',  'Low',    'Open',        'staff1@helpdesk.test', NULL,                      interval '5 hours',    NULL)
)
INSERT INTO tickets (title, description, category, priority, status, created_by, assigned_to, due_at, resolved_at, created_at)
SELECT
  t.title,
  t.description,
  t.category::ticket_category,
  t.priority::ticket_priority,
  t.status::ticket_status,
  (SELECT id FROM users WHERE email = t.creator),
  (SELECT id FROM users WHERE email = t.assignee),
  now() - t.age + CASE t.priority
                    WHEN 'High'   THEN interval '4 hours'
                    WHEN 'Medium' THEN interval '24 hours'
                    ELSE               interval '72 hours'
                  END,
  CASE WHEN t.resolved_after IS NOT NULL THEN now() - t.age + t.resolved_after END,
  now() - t.age
FROM t;

-- ---------- comments ----------
INSERT INTO comments (ticket_id, user_id, body, created_at)
SELECT tk.id, u.id, c.body, now() - c.age
FROM (VALUES
  ('Cannot connect to office Wi-Fi',  'support1@helpdesk.test', 'Looking into this now. Which floor are you on?',        interval '90 minutes'),
  ('Cannot connect to office Wi-Fi',  'staff2@helpdesk.test',   'Second floor, near the printers.',                      interval '80 minutes'),
  ('Server room VPN down',            'support2@helpdesk.test', 'Confirmed on our side, escalating to the network team.', interval '5 hours'),
  ('Reset email password',            'support1@helpdesk.test', 'Password reset link sent. Please confirm it works.',     interval '3 days'),
  ('Reset email password',            'staff1@helpdesk.test',   'Works now, thank you.',                                  interval '2 days 22 hours')
) AS c (ticket_title, author, body, age)
JOIN tickets tk ON tk.title = c.ticket_title
JOIN users   u  ON u.email  = c.author;

-- ---------- audit_logs (a few sample events) ----------
INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, created_at)
VALUES
  ((SELECT id FROM users WHERE email = 'admin@helpdesk.test'),    'LOGIN',           'user',   (SELECT id FROM users WHERE email = 'admin@helpdesk.test'),    '{}'::jsonb,                                  '10.0.0.5',  now() - interval '1 hour'),
  (NULL,                                                           'LOGIN_FAILED',    'user',   NULL,                                                          '{"attempted_email": "unknown@helpdesk.test"}', '10.0.0.77', now() - interval '50 minutes'),
  ((SELECT id FROM users WHERE email = 'admin@helpdesk.test'),    'TICKET_ASSIGNED', 'ticket', (SELECT id FROM tickets WHERE title = 'Server room VPN down'), '{"assigned_to": "support2@helpdesk.test"}',  '10.0.0.5',  now() - interval '5 hours'),
  ((SELECT id FROM users WHERE email = 'support1@helpdesk.test'), 'STATUS_CHANGE',   'ticket', (SELECT id FROM tickets WHERE title = 'Reset email password'),   '{"from": "In Progress", "to": "Resolved"}',   '10.0.0.21', now() - interval '3 days' + interval '3 hours');

COMMIT;

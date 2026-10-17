const express = require('express');
const db = require('../config/db');
const AppError = require('../utils/AppError');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const s = require('../schemas/tickets');
const audit = require('../services/audit');
const { visibilityFilter, getVisibleTicket, canTransition } = require('../services/ticketAccess');

const router = express.Router();
router.use(authenticate); // every ticket route requires a valid JWT

// POST /api/tickets — staff (and admin) log a new issue
router.post('/', authorize('staff', 'admin'), validate({ body: s.createTicket }), async (req, res) => {
  const { title, description, category, priority } = req.body;
  // Sarah: compute due_at from priority here (High 4h, Medium 24h, Low 72h)
  const { rows } = await db.query(
    `INSERT INTO tickets (title, description, category, priority, created_by)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [title, description, category, priority, req.user.id]
  );
  res.status(201).json({ data: rows[0] });
});

// GET /api/tickets?status=&priority=&category=&page=&limit=
router.get('/', validate({ query: s.listQuery }), async (req, res) => {
  const { status, priority, category, page, limit } = req.validatedQuery;
  const vis = visibilityFilter(req.user, 1);
  const where = [vis.clause];
  const params = [...vis.params];

  // Filters are whitelisted column names with bound values — no user text in SQL.
  for (const [col, val] of [['status', status], ['priority', priority], ['category', category]]) {
    if (val) { params.push(val); where.push(`t.${col} = $${params.length}`); }
  }
  const whereSql = where.join(' AND ');

  const countRes = await db.query(`SELECT COUNT(*)::int AS total FROM tickets t WHERE ${whereSql}`, params);
  params.push(limit, (page - 1) * limit);
  const { rows } = await db.query(
    `SELECT t.* FROM tickets t WHERE ${whereSql}
     ORDER BY t.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  res.json({ data: rows, meta: { page, limit, total: countRes.rows[0].total } });
});

// GET /api/tickets/:id
router.get('/:id', validate({ params: s.idParam }), async (req, res) => {
  const ticket = await getVisibleTicket(req.user, req.params.id);
  res.json({ data: ticket });
});

// PATCH /api/tickets/:id/status — enforces the status flow per role
router.patch('/:id/status', validate({ params: s.idParam, body: s.updateStatus }), async (req, res) => {
  const ticket = await getVisibleTicket(req.user, req.params.id);
  const { status } = req.body;
  if (ticket.status === status) throw new AppError(400, `Ticket is already ${status}`);
  if (!canTransition(req.user.role, ticket.status, status)) {
    throw new AppError(403, `A ${req.user.role} cannot move a ticket from ${ticket.status} to ${status}`);
  }
  // Sarah: set resolved_at when status becomes 'Resolved'
  const { rows } = await db.query(
    `UPDATE tickets SET status = $1, updated_at = now() WHERE id = $2 RETURNING *`,
    [status, ticket.id]
  );
  await audit.log({
    userId: req.user.id, action: audit.ACTIONS.STATUS_CHANGE, entityType: 'ticket', entityId: ticket.id,
    details: { from: ticket.status, to: status }, ip: req.ip,
  });
  res.json({ data: rows[0] });
});

// PATCH /api/tickets/:id/assign — admin assigns to a support user
router.patch('/:id/assign', authorize('admin'), validate({ params: s.idParam, body: s.assignTicket }), async (req, res) => {
  const ticket = await getVisibleTicket(req.user, req.params.id);
  const { rows: users } = await db.query(`SELECT id, role FROM users WHERE id = $1`, [req.body.assigneeId]);
  if (!users[0]) throw new AppError(404, 'Assignee not found');
  if (users[0].role !== 'support') throw new AppError(400, 'Tickets can only be assigned to support staff');

  const { rows } = await db.query(
    `UPDATE tickets SET assigned_to = $1, updated_at = now() WHERE id = $2 RETURNING *`,
    [users[0].id, ticket.id]
  );
  await audit.log({
    userId: req.user.id, action: audit.ACTIONS.TICKET_ASSIGNED, entityType: 'ticket', entityId: ticket.id,
    details: { from: ticket.assigned_to, to: users[0].id }, ip: req.ip,
  });
  res.json({ data: rows[0] });
});

// GET /api/tickets/:id/comments
router.get('/:id/comments', validate({ params: s.idParam }), async (req, res) => {
  const ticket = await getVisibleTicket(req.user, req.params.id);
  const { rows } = await db.query(
    `SELECT c.id, c.body, c.created_at, c.user_id, u.name AS user_name, u.role AS user_role
     FROM comments c JOIN users u ON u.id = c.user_id
     WHERE c.ticket_id = $1 ORDER BY c.created_at ASC`,
    [ticket.id]
  );
  res.json({ data: rows });
});

// POST /api/tickets/:id/comments — anyone who can see the ticket can comment
router.post('/:id/comments', validate({ params: s.idParam, body: s.createComment }), async (req, res) => {
  const ticket = await getVisibleTicket(req.user, req.params.id);
  if (ticket.status === 'Closed') throw new AppError(400, 'Cannot comment on a closed ticket');
  const { rows } = await db.query(
    `INSERT INTO comments (ticket_id, user_id, body) VALUES ($1, $2, $3) RETURNING *`,
    [ticket.id, req.user.id, req.body.body]
  );
  res.status(201).json({ data: rows[0] });
});

module.exports = router;

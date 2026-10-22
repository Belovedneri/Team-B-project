const express = require('express');
const db = require('../config/db');
const AppError = require('../utils/AppError');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const s = require('../schemas/tickets');
const audit = require('../services/audit');
const { visibilityFilter, getVisibleTicket, canTransition } = require('../services/ticketAccess');

/**
 * @openapi
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *   schemas:
 *     TicketInput:
 *       type: object
 *       required:
 *         - title
 *         - description
 *         - category
 *         - priority
 *       properties:
 *         title:
 *           type: string
 *           minLength: 3
 *           maxLength: 150
 *         description:
 *           type: string
 *           minLength: 10
 *           maxLength: 5000
 *         category:
 *           type: string
 *           enum: [Hardware, Software, Network, Access]
 *         priority:
 *           type: string
 *           enum: [Low, Medium, High]
 *     TicketStatusUpdate:
 *       type: object
 *       required: [status]
 *       properties:
 *         status:
 *           type: string
 *           enum: [Open, In Progress, Resolved, Closed]
 *     TicketAssignment:
 *       type: object
 *       required: [assigneeId]
 *       properties:
 *         assigneeId:
 *           type: integer
 *           minimum: 1
 *     CommentInput:
 *       type: object
 *       required: [body]
 *       properties:
 *         body:
 *           type: string
 *           minLength: 1
 *           maxLength: 2000
 *
 * @openapi
 * /api/tickets:
 *   post:
 *     tags: [Tickets]
 *     summary: Create a ticket
 *     description: Staff and admins can create tickets. The creator is taken from the authenticated user.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TicketInput'
 *     responses:
 *       '201':
 *         description: Ticket created
 *       '400':
 *         description: Invalid request
 *       '401':
 *         description: Authentication required
 *       '403':
 *         description: Staff or admin role required
 *
 *   get:
 *     tags: [Tickets]
 *     summary: List visible tickets
 *     description: Returns tickets visible to the authenticated user, with optional filters and pagination.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [Open, In Progress, Resolved, Closed]
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [Low, Medium, High]
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [Hardware, Software, Network, Access]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *     responses:
 *       '200':
 *         description: Tickets retrieved
 *       '401':
 *         description: Authentication required
 *
 * @openapi
 * /api/tickets/{id}:
 *   get:
 *     tags: [Tickets]
 *     summary: Get a visible ticket by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *     responses:
 *       '200':
 *         description: Ticket retrieved
 *       '401':
 *         description: Authentication required
 *       '404':
 *         description: Ticket not found or not visible
 *
 * @openapi
 * /api/tickets/{id}/status:
 *   patch:
 *     tags: [Tickets]
 *     summary: Update ticket status
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TicketStatusUpdate'
 *     responses:
 *       '200':
 *         description: Ticket status updated
 *       '400':
 *         description: Invalid request or ticket already has the requested status
 *       '401':
 *         description: Authentication required
 *       '403':
 *         description: Status transition not allowed for the user's role
 *       '404':
 *         description: Ticket not found or not visible to the authenticated user
 *       '409':
 *         description: Ticket status was changed by someone else. Reload and try again
 *
 * @openapi
 * /api/tickets/{id}/assign:
 *   patch:
 *     tags: [Tickets]
 *     summary: Assign ticket to support staff
 *     description: Admin-only operation.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TicketAssignment'
 *     responses:
 *       '200':
 *         description: Ticket assigned
 *       '400':
 *         description: Assignee is not support staff
 *       '401':
 *         description: Authentication required
 *       '403':
 *         description: Admin role required
 *       '404':
 *         description: Ticket or assignee not found
 *
 * @openapi
 * /api/tickets/{id}/comments:
 *   get:
 *     tags: [Tickets]
 *     summary: List comments on a visible ticket
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *     responses:
 *       '200':
 *         description: Comments retrieved
 *       '401':
 *         description: Authentication required
 *       '404':
 *         description: Ticket not found or not visible
 *
 *   post:
 *     tags: [Tickets]
 *     summary: Add a comment to a visible ticket
 *     description: Comments cannot be added to closed tickets.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CommentInput'
 *     responses:
 *       '201':
 *         description: Comment created
 *       '400':
 *         description: Ticket is closed or comment is invalid
 *       '401':
 *         description: Authentication required
 *       '404':
 *         description: Ticket not found or not visible
 */

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
  // Only update if the status is still what we checked above, so two concurrent changes can't both win
  const { rows } = await db.query(
    `UPDATE tickets SET status = $1, updated_at = now() WHERE id = $2 AND status = $3 RETURNING *`,
    [status, ticket.id, ticket.status]
  );
  if (!rows[0]) throw new AppError(409, 'Ticket status was changed by someone else. Reload and try again');
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

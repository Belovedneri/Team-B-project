const express = require('express');
const db = require('../config/db');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { auditQuery } = require('../schemas/tickets');

const router = express.Router();

// GET /api/audit-logs?action=&actorId=&page=&limit= — admin only
router.get('/', authenticate, authorize('admin'), validate({ query: auditQuery }), async (req, res) => {
  const { action, actorId, page, limit } = req.validatedQuery;
  const where = ['TRUE'];
  const params = [];
  if (action) { params.push(action); where.push(`a.action = $${params.length}`); }
  if (actorId) { params.push(actorId); where.push(`a.user_id = $${params.length}`); }
  params.push(limit, (page - 1) * limit);

  const { rows } = await db.query(
    `SELECT a.*, u.email AS actor_email FROM audit_logs a
     LEFT JOIN users u ON u.id = a.user_id
     WHERE ${where.join(' AND ')}
     ORDER BY a.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  res.json({ data: rows, meta: { page, limit } });
});

module.exports = router;

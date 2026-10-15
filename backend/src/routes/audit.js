const express = require('express');
const db = require('../config/db');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { auditQuery } = require('../schemas/tickets');

const router = express.Router();

// GET /api/audit-logs?action=&userId=&page=&limit= — admin only
router.get('/', authenticate, authorize('admin'), validate({ query: auditQuery }), async (req, res) => {
  const { action, userId, page, limit } = req.validatedQuery;
  const where = ['TRUE'];
  const params = [];
  if (action) { params.push(action); where.push(`a.action = $${params.length}`); }
  if (userId) { params.push(userId); where.push(`a.user_id = $${params.length}`); }
  params.push(limit, (page - 1) * limit);

  const { rows } = await db.query(
    // Filter first, then join (pg-mem can't filter on an indexed column after a join).
    `SELECT a.*, u.email AS user_email
     FROM (SELECT * FROM audit_logs a WHERE ${where.join(' AND ')}) a
     LEFT JOIN users u ON u.id = a.user_id
     ORDER BY a.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  res.json({ data: rows, meta: { page, limit } });
});

module.exports = router;

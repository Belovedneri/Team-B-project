const express = require('express');
const db = require('../config/db');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { auditQuery } = require('../schemas/tickets');

/**
 * @openapi
 * /api/audit-logs:
 *   get:
 *     tags:
 *       - Audit Logs
 *     summary: Retrieve audit logs
 *     description: Returns audit logs with optional filters. Restricted to administrators.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: action
 *         required: false
 *         schema:
 *           type: string
 *         description: Filter by audit action
 *       - in: query
 *         name: userId
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Filter by user ID
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *     responses:
 *       '200':
 *         description: Audit logs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       user_email:
 *                         type: string
 *                         nullable: true
 *                       action:
 *                         type: string
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                 meta:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *       '401':
 *         description: Authentication required
 *       '403':
 *         description: Administrator access required
 *       '400':
 *         description: Invalid query parameters
 */

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

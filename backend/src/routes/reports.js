const express = require('express');
const db = require('../config/db');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

/**
 * @openapi
 * /api/reports:
 *   get:
 *     tags: [Reports]
 *     summary: Get ticket reports
 *     description: Returns ticket counts grouped by status and priority. Administrators only.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Ticket reports retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     byStatus:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           status:
 *                             type: string
 *                             example: Open
 *                           count:
 *                             type: integer
 *                             example: 3
 *                     byPriority:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           priority:
 *                             type: string
 *                             enum: [High, Medium, Low]
 *                           count:
 *                             type: integer
 *                             example: 2
 *       '401':
 *         description: Authentication required
 *       '403':
 *         description: Administrator role required
 */
const router = express.Router();

router.use(authenticate);
router.use(authorize('admin'));

router.get('/', async (req, res) => {
  const [statusResult, priorityResult] = await Promise.all([
    db.query(
      `SELECT status, COUNT(*)::int AS count
       FROM tickets
       GROUP BY status
       ORDER BY status`
    ),
    db.query(
      `SELECT priority, COUNT(*)::int AS count
       FROM tickets
       GROUP BY priority
       ORDER BY priority`
    ),
  ]);

  res.json({
    data: {
      byStatus: statusResult.rows,
      byPriority: priorityResult.rows,
    },
  });
});

module.exports = router;

const db = require('../config/db');

// Must match the audit_action enum in database/schema.sql
const ACTIONS = Object.freeze({
  LOGIN: 'LOGIN',
  LOGIN_FAILED: 'LOGIN_FAILED',
  ROLE_CHANGE: 'ROLE_CHANGE',
  TICKET_ASSIGNED: 'TICKET_ASSIGNED',
  STATUS_CHANGE: 'STATUS_CHANGE',
});

/**
 * Write one audit entry. Never pass passwords or tokens in `details`.
 * Philipa calls this from login (success/fail) and role changes:
 *   await audit.log({ userId: user.id, action: audit.ACTIONS.LOGIN, ip: req.ip })
 *   await audit.log({ action: audit.ACTIONS.LOGIN_FAILED, details: { email }, ip: req.ip })
 */
async function log({ userId = null, action, entityType = null, entityId = null, details = {}, ip = null }) {
  try {
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, action, entityType, entityId, JSON.stringify(details), normalizeIp(ip)]
    );
  } catch (err) {
    // An audit failure must not break the user's request, but it must be visible.
    console.error('AUDIT LOG FAILURE', action, err.message);
  }
}

// Node reports IPv4 clients as '::ffff:1.2.3.4'; store them as plain IPv4.
function normalizeIp(ip) {
  return ip && ip.startsWith('::ffff:') ? ip.slice(7) : ip;
}

module.exports = { log, ACTIONS };

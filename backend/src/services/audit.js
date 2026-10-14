const db = require('../config/db');

const ACTIONS = Object.freeze({
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILED: 'LOGIN_FAILED',
  ROLE_CHANGED: 'ROLE_CHANGED',
  TICKET_ASSIGNED: 'TICKET_ASSIGNED',
  STATUS_CHANGED: 'STATUS_CHANGED',
});

/**
 * Write one audit entry. Never pass passwords or tokens in `details`.
 * Philipa calls this from login (success/fail) and role changes:
 *   await audit.log({ actorId: user.id, action: audit.ACTIONS.LOGIN_SUCCESS, ip: req.ip })
 *   await audit.log({ action: audit.ACTIONS.LOGIN_FAILED, details: { email }, ip: req.ip })
 */
async function log({ actorId = null, action, entityType = null, entityId = null, details = null, ip = null }) {
  try {
    await db.query(
      `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [actorId, action, entityType, entityId, details ? JSON.stringify(details) : null, ip]
    );
  } catch (err) {
    // An audit failure must not break the user's request, but it must be visible.
    console.error('AUDIT LOG FAILURE', action, err.message);
  }
}

module.exports = { log, ACTIONS };

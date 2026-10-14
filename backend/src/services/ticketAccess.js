const db = require('../config/db');
const AppError = require('../utils/AppError');

// SQL condition that limits rows to what this user may see.
// Returns { clause, params } to splice into a WHERE.
function visibilityFilter(user, startIndex = 1) {
  if (user.role === 'admin') return { clause: 'TRUE', params: [] };
  if (user.role === 'support') return { clause: `t.assigned_to = $${startIndex}`, params: [user.id] };
  return { clause: `t.created_by = $${startIndex}`, params: [user.id] }; // staff
}

// Load a ticket the user is allowed to see, or throw 404.
// 404 (not 403) so users can't probe which ticket IDs exist.
async function getVisibleTicket(user, ticketId) {
  const vis = visibilityFilter(user, 2);
  const { rows } = await db.query(
    `SELECT t.* FROM tickets t WHERE t.id = $1 AND ${vis.clause}`,
    [ticketId, ...vis.params]
  );
  if (!rows[0]) throw new AppError(404, 'Ticket not found');
  return rows[0];
}

// Allowed status moves per role. Flow: open → in_progress → resolved → closed
const TRANSITIONS = {
  support: { open: ['in_progress'], in_progress: ['resolved'] },
  staff:   { resolved: ['closed', 'in_progress'] }, // confirm fix, or reopen
  admin:   { open: ['in_progress', 'closed'], in_progress: ['resolved'], resolved: ['closed', 'in_progress'] },
};

function canTransition(role, from, to) {
  return (TRANSITIONS[role]?.[from] || []).includes(to);
}

module.exports = { visibilityFilter, getVisibleTicket, canTransition, TRANSITIONS };

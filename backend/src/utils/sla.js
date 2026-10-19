const SLA_HOURS = Object.freeze({
  High: 4,
  Medium: 24,
  Low: 72,
});

function calculateDueDate(priority, createdAt = new Date()) {
  const hours = SLA_HOURS[priority];

  if (hours === undefined) {
    throw new Error(`Invalid ticket priority: ${priority}`);
  }

  return new Date(createdAt.getTime() + hours * 60 * 60 * 1000);
}

function isSlaBreached(ticket, currentTime = new Date()) {
  if (!ticket || !ticket.due_at || ticket.resolved_at) {
    return false;
  }

  if (ticket.status === 'Resolved' || ticket.status === 'Closed') {
    return false;
  }

  return new Date(ticket.due_at).getTime() < currentTime.getTime();
}

module.exports = {
  calculateDueDate,
  isSlaBreached,
};

export type TicketPriority = "High" | "Medium" | "Low";

const SLA_HOURS: Record<TicketPriority, number> = {
  High: 4,
  Medium: 24,
  Low: 72,
};

export function calculateDueDate(
  priority: TicketPriority,
  createdAt: Date = new Date()
): Date {
  const hours = SLA_HOURS[priority];

  return new Date(createdAt.getTime() + hours * 60 * 60 * 1000);
}

export function getResolvedAt(
  status: string,
  currentTime: Date = new Date()
): Date | null {
  if (status === "Resolved") {
    return currentTime;
  }

  return null;
}
const { z } = require('zod');
const { ACTIONS } = require('../services/audit');

// Must match the enums in /database/schema.sql exactly (case included)
const CATEGORIES = ['Hardware', 'Software', 'Network', 'Access'];
const PRIORITIES = ['Low', 'Medium', 'High'];
const STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'];

const idParam = z.object({ id: z.coerce.number().int().positive() });

const createTicket = z.object({
  title: z.string().trim().min(3).max(150),
  description: z.string().trim().min(10).max(5000),
  category: z.enum(CATEGORIES),
  priority: z.enum(PRIORITIES),
}).strict(); // reject extra fields like created_by or status (mass assignment)

const listQuery = z.object({
  status: z.enum(STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  category: z.enum(CATEGORIES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const updateStatus = z.object({ status: z.enum(STATUSES) }).strict();
const assignTicket = z.object({ assigneeId: z.number().int().positive() }).strict();
const createComment = z.object({ body: z.string().trim().min(1).max(2000) }).strict();

const auditQuery = z.object({
  action: z.enum(Object.values(ACTIONS)).optional(),
  actorId: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

module.exports = { idParam, createTicket, listQuery, updateStatus, assignTicket, createComment, auditQuery, STATUSES };

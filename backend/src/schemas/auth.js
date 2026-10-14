const { z } = require('zod');

const email = z.string().trim().toLowerCase().email().max(255);

// .strict() rejects unknown fields, so a request that includes "role" gets a 400.
const registerSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email,
  password: z.string().min(8).max(72), // bcrypt only uses the first 72 bytes
}).strict();

const loginSchema = z.object({
  email,
  password: z.string().min(1).max(72),
}).strict();

module.exports = { registerSchema, loginSchema };
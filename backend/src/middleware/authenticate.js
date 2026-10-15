// Verifies the JWT Philipa's /auth/login issues. Agreed payload: { sub: String(userId), role }.
// The token only proves identity. Every request re-reads the user, so a deactivated account
// or a changed role takes effect immediately rather than when the token expires.
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const db = require('../config/db');
const AppError = require('../utils/AppError');

const ROLES = ['staff', 'support', 'admin'];

const claimsSchema = z.object({
  // users.id is a positive Postgres INTEGER; JWT `sub` is always a string
  sub: z.string().regex(/^[1-9]\d{0,9}$/).transform(Number).refine(n => n <= 2147483647),
  role: z.enum(ROLES),
  exp: z.number(), // jwt.verify only checks expiry when exp is present, so require it
});

const rejected = () => new AppError(401, 'Invalid or expired token');

module.exports = async (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return next(new AppError(401, 'Authentication required'));

  let claims;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    claims = claimsSchema.parse(payload);
  } catch {
    return next(rejected());
  }

  try {
    const { rows } = await db.query('SELECT id, role, is_active FROM users WHERE id = $1', [claims.sub]);
    const user = rows[0];
    // Unknown, deactivated, or role changed since the token was issued: force a fresh login
    if (!user || !user.is_active || user.role !== claims.role) return next(rejected());
    req.user = { id: user.id, role: user.role };
    next();
  } catch (err) {
    next(err); // DB failure is a 500, not a 401
  }
};

module.exports.ROLES = ROLES;

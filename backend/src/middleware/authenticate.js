// Verifies the JWT Philipa's /auth/login issues. Agree the payload with her: { sub, role }.
const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');

module.exports = (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return next(new AppError(401, 'Authentication required'));
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    req.user = { id: Number(payload.sub), role: payload.role };
    next();
  } catch {
    next(new AppError(401, 'Invalid or expired token'));
  }
};

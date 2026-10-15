const { ZodError } = require('zod');
const AppError = require('../utils/AppError');

// Consistent JSON error shape: { error: { message, details? } }
// eslint-disable-next-line no-unused-vars
module.exports = (err, req, res, next) => {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: { message: 'Validation failed', details: err.issues.map(i => ({ field: i.path.join('.'), message: i.message })) },
    });
  }
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { message: err.message, ...(err.details && { details: err.details }) } });
  }
  console.error(err); // log internally, never leak stack traces to the client
  return res.status(500).json({ error: { message: 'Internal server error' } });
};

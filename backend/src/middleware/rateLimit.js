const rateLimit = require('express-rate-limit');

// Apply to POST /api/auth/login (Philipa's route): app.use('/api/auth/login', loginLimiter)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.LOGIN_RATE_LIMIT || 5),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true, // only failed attempts count toward the limit
  message: { error: { message: 'Too many login attempts. Try again in 15 minutes.' } },
});

// Gentle limit for the whole API
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { message: 'Too many requests' } },
});

module.exports = { loginLimiter, apiLimiter };

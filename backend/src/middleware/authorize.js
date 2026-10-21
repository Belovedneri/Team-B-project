const AppError = require('../utils/AppError');

// Role check: authorize('admin') or authorize('support', 'admin')
module.exports = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return next(new AppError(403, 'You do not have permission to perform this action'));
  }
  next();
};

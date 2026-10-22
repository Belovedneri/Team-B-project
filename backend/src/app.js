const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { apiLimiter, loginLimiter } = require('./middleware/rateLimit');
const errorHandler = require('./middleware/errorHandler');
const AppError = require('./utils/AppError');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');

const app = express();
app.set('trust proxy', 1); // so req.ip is the real client IP behind a proxy
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5500' }));
app.use(express.json({ limit: '100kb' }));
app.use('/api', apiLimiter);

app.use('/api/auth/login', loginLimiter);           // must come BEFORE Philipa's auth router
app.use('/api/auth', require('./routes/auth'));  // Philipa
app.use('/api/tickets', require('./routes/tickets'));
app.use('/api/tickets', require('./routes/attachments')); // Sarah
app.use('/api/audit-logs', require('./routes/audit'));
// app.use('/api/reports', require('./routes/reports')); // Sarah

// Swagger API documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use((req, res, next) => next(new AppError(404, 'Route not found')));
app.use(errorHandler);

module.exports = app;

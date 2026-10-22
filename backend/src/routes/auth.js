const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const audit = require('../services/audit');
const AppError = require('../utils/AppError');
const validate = require('../middleware/validate');
const { registerSchema, loginSchema } = require('../schemas/auth');

const router = express.Router();
const BCRYPT_ROUNDS = 10;
const TOKEN_TTL = '1h';
// Used when the email doesn't exist, so login takes the same time either way.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_ROUNDS);

function signToken(user) {
  return jwt.sign({ sub: String(user.id), role: user.role }, process.env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: TOKEN_TTL,
  });
}


/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Register a staff account
 *     description: Creates a staff account. The role is assigned by the server and cannot be supplied by the client.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *                 example: Sarah Baidu
 *               email:
 *                 type: string
 *                 format: email
 *                 maxLength: 255
 *                 example: sarah@example.com
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 maxLength: 72
 *                 example: SecurePass123
 *     responses:
 *       '201':
 *         description: Staff account created successfully
 *       '400':
 *         description: Request validation failed, including an unknown field such as role
 *       '409':
 *         description: Email is already registered
 */
// Registration always creates a staff user. The role is never taken from the request.
router.post('/register', validate({ body: registerSchema }), async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const { rows } = await db.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'staff')
       RETURNING id, name, email, role, created_at`,
      [name, email, passwordHash]
    );
    res.status(201).json({ user: rows[0] });
  } catch (err) {
    if (err.code === '23505') return next(new AppError(409, 'Email is already registered'));
    next(err);
  }
});


/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Log in to an account
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 maxLength: 255
 *                 example: sarah@example.com
 *               password:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 72
 *                 example: SecurePass123
 *     responses:
 *       '200':
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: JWT bearer token
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     name:
 *                       type: string
 *                     email:
 *                       type: string
 *                     role:
 *                       type: string
 *                       enum:
 *                         - staff
 *                         - support
 *                         - admin
 *       '400':
 *         description: Request validation failed
 *       '401':
 *         description: Invalid credentials or inactive account
 */
router.post('/login', validate({ body: loginSchema }), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const { rows } = await db.query(
      'SELECT id, name, email, role, password_hash, is_active FROM users WHERE email = $1',
      [email]
    );
    const user = rows[0];
    const passwordOk = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);

    if (!user || !passwordOk || !user.is_active) {
      await audit.log({
        userId: user ? user.id : null,
        action: audit.ACTIONS.LOGIN_FAILED,
        details: { email },
        ip: req.ip,
      });
      throw new AppError(401, 'Invalid email or password');
    }

    await audit.log({ userId: user.id, action: audit.ACTIONS.LOGIN, ip: req.ip });
    res.json({
      token: signToken(user),
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
const express = require('express');
const request = require('supertest');

test('login limiter blocks the 6th failed attempt with 429', async () => {
  const { loginLimiter } = require('../src/middleware/rateLimit');
  const app = express();
  app.post('/api/auth/login', loginLimiter, (req, res) => res.status(401).json({ error: { message: 'Invalid credentials' } }));
  for (let i = 0; i < 5; i++) expect((await request(app).post('/api/auth/login')).status).toBe(401);
  const blocked = await request(app).post('/api/auth/login');
  expect(blocked.status).toBe(429);
  expect(blocked.body.error.message).toMatch(/Too many/);
});

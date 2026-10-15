const request = require('supertest');
const { setupDb } = require('./setup');
const app = require('../src/app');

beforeEach(() => { setupDb(); });

test('real /api/auth/login route is rate limited: 5 failed attempts, then 429', async () => {
  const person = { name: 'Limit Test', email: 'limit.test@test.io', password: 'Str0ng#Pass1' };
  await request(app).post('/api/auth/register').send(person);

  const bad = { email: person.email, password: 'Wrong#Pass99' };
  for (let i = 0; i < 5; i++) {
    const res = await request(app).post('/api/auth/login').send(bad);
    expect(res.status).toBe(401);
  }

  const blocked = await request(app).post('/api/auth/login').send(bad);
  expect(blocked.status).toBe(429);
  expect(blocked.body.error.message).toMatch(/Too many login attempts/);

  // Even the correct password is refused while the limit is active
  const correct = await request(app)
    .post('/api/auth/login')
    .send({ email: person.email, password: person.password });
  expect(correct.status).toBe(429);
});
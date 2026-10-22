// Integration tests: the real app, the real /api/auth/login route and the real loginLimiter.
// rateLimit.test.js only proves the limiter works on its own; these prove it is wired in.
const request = require('supertest');
const bcrypt = require('bcrypt');
const { setupDb, USERS } = require('./setup');
const app = require('../src/app');

const PASSWORD = 'Correct#Horse1';
const HASH = bcrypt.hashSync(PASSWORD, 4); // low cost keeps the suite fast

let mem;
let ipCounter = 0;
beforeEach(() => {
  mem = setupDb();
  mem.public.none(`UPDATE users SET password_hash = '${HASH}'`);
  ipCounter += 1; // the limiter keys on client IP, so give each test its own
});

// trust proxy is 1, so X-Forwarded-For sets req.ip
const login = (email, password) => request(app)
  .post('/api/auth/login')
  .set('X-Forwarded-For', `203.0.113.${ipCounter}`)
  .send({ email, password });

const auditRows = (action) =>
  mem.public.many(`SELECT user_id, action, details, ip_address FROM audit_logs WHERE action = '${action}'`);

describe('POST /api/auth/login', () => {
  test('a token from the real login works on a protected route', async () => {
    const res = await login('staff1@test.io', PASSWORD);
    expect(res.status).toBe(200);
    const tickets = await request(app).get('/api/tickets').set('Authorization', `Bearer ${res.body.token}`);
    expect(tickets.status).toBe(200);
  });

  test('wrong password and unknown email get the same 401', async () => {
    const wrong = await login('staff1@test.io', 'nope');
    const unknown = await login('nobody@test.io', 'nope');
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
  });

  test('inactive user cannot log in, even with the right password', async () => {
    mem.public.none(`UPDATE users SET is_active = false WHERE id = ${USERS.staff1}`);
    expect((await login('staff1@test.io', PASSWORD)).status).toBe(401);
  });

  test('success and failure are audited, without the password', async () => {
    await login('staff1@test.io', PASSWORD);
    await login('staff1@test.io', 'nope');
    expect(auditRows('LOGIN')).toEqual([expect.objectContaining({ user_id: USERS.staff1, ip_address: `203.0.113.${ipCounter}` })]);
    const [failed] = auditRows('LOGIN_FAILED');
    expect(failed).toMatchObject({ user_id: USERS.staff1, details: { email: 'staff1@test.io' } });
    expect(JSON.stringify(failed.details)).not.toContain('nope');
  });
});

describe('loginLimiter on the real route', () => {
  test('6th failed attempt gets 429, and then even the right password is blocked', async () => {
    for (let i = 0; i < 5; i++) expect((await login('staff1@test.io', 'nope')).status).toBe(401);
    const blocked = await login('staff1@test.io', 'nope');
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.message).toMatch(/Too many/);
    expect((await login('staff1@test.io', PASSWORD)).status).toBe(429);
  });

  test('successful logins do not count toward the limit', async () => {
    for (let i = 0; i < 6; i++) expect((await login('staff1@test.io', PASSWORD)).status).toBe(200);
    for (let i = 0; i < 5; i++) expect((await login('staff1@test.io', 'nope')).status).toBe(401);
  });

  test('the limit is per client IP', async () => {
    for (let i = 0; i < 6; i++) await login('staff1@test.io', 'nope');
    const other = await request(app).post('/api/auth/login')
      .set('X-Forwarded-For', '198.51.100.1').send({ email: 'staff1@test.io', password: PASSWORD });
    expect(other.status).toBe(200);
  });
});

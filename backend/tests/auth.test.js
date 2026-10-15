const request = require('supertest');
const jwt = require('jsonwebtoken');
const { setupDb } = require('./setup');
const app = require('../src/app');

let mem;
beforeEach(() => { mem = setupDb(); });

const person = { name: 'New Person', email: 'new.person@test.io', password: 'Str0ng#Pass1' };
const register = (body = person) => request(app).post('/api/auth/register').send(body);
const login = (body) => request(app).post('/api/auth/login').send(body);

describe('POST /api/auth/register', () => {
  test('creates a staff user and never returns the password hash', async () => {
    const res = await register();
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ name: 'New Person', email: 'new.person@test.io', role: 'staff' });
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
  });

  test('ignores attempts to choose a role (400)', async () => {
    const res = await register({ ...person, role: 'admin' });
    expect(res.status).toBe(400);
  });

  test('rejects a password shorter than 8 characters (400)', async () => {
    const res = await register({ ...person, password: 'short' });
    expect(res.status).toBe(400);
  });

  test('duplicate email returns 409', async () => {
    await register();
    const res = await register();
    expect(res.status).toBe(409);
  });
});

describe('POST /api/auth/login', () => {
  test('valid login returns a 1-hour token with sub and role', async () => {
    await register();
    const res = await login({ email: person.email, password: person.password });
    expect(res.status).toBe(200);
    const payload = jwt.verify(res.body.token, process.env.JWT_SECRET);
    expect(payload.role).toBe('staff');
    expect(typeof payload.sub).toBe('number');
    expect(payload.exp - payload.iat).toBe(3600);
    expect(res.body.user).toMatchObject({ email: person.email, role: 'staff' });
  });

  test('wrong password and unknown email give the same 401 message', async () => {
    await register();
    const wrongPw = await login({ email: person.email, password: 'Wrong#Pass99' });
    const unknown = await login({ email: 'nobody@test.io', password: 'Wrong#Pass99' });
    expect(wrongPw.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrongPw.body.error.message).toBe(unknown.body.error.message);
  });

  test('deactivated user cannot log in (401)', async () => {
    await register();
    mem.public.none(`UPDATE users SET is_active = false WHERE email = '${person.email}'`);
    const res = await login({ email: person.email, password: person.password });
    expect(res.status).toBe(401);
  });
});
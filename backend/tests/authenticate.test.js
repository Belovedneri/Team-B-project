const request = require('supertest');
const jwt = require('jsonwebtoken');
const { setupDb, token, auth, USERS } = require('./setup');
const app = require('../src/app');

let mem;
beforeEach(() => { mem = setupDb(); });

const get = (authHeader) => request(app).get('/api/tickets').set('Authorization', authHeader);
const signed = (payload) => `Bearer ${jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' })}`;

describe('JWT claim validation (401)', () => {
  test.each([
    ['missing sub', { role: 'staff' }],
    ['non-numeric sub', { sub: 'abc', role: 'staff' }],
    ['zero sub', { sub: '0', role: 'staff' }],
    ['negative sub', { sub: '-1', role: 'staff' }],
    ['decimal sub', { sub: '1.5', role: 'staff' }],
    ['sub beyond INTEGER range', { sub: '99999999999', role: 'staff' }],
    ['numeric (non-string) sub', { sub: 1, role: 'staff' }],
    ['missing role', { sub: '1' }],
    ['unknown role', { sub: '1', role: 'superadmin' }],
    ['role with wrong case', { sub: '4', role: 'Admin' }],
  ])('%s', async (_, payload) => {
    expect((await get(signed(payload))).status).toBe(401);
  });

  test('token with no expiry', async () => {
    const noExp = jwt.sign({ sub: '1', role: 'staff' }, process.env.JWT_SECRET);
    expect((await get(`Bearer ${noExp}`)).status).toBe(401);
  });

  test('valid claims are accepted', async () => {
    expect((await get(auth.staff1)).status).toBe(200);
  });
});

describe('Account state is checked on every request (401)', () => {
  test('user that no longer exists', async () => {
    expect((await get(`Bearer ${token(999, 'staff')}`)).status).toBe(401);
  });

  test('deactivated user, even with an unexpired token', async () => {
    mem.public.none(`UPDATE users SET is_active = false WHERE id = ${USERS.staff1}`);
    expect((await get(auth.staff1)).status).toBe(401);
  });

  test('demoted admin cannot keep using an admin token', async () => {
    mem.public.none(`UPDATE users SET role = 'staff' WHERE id = ${USERS.admin}`);
    expect((await get(auth.admin)).status).toBe(401);
  });

  test('token claiming a role the user does not have', async () => {
    expect((await get(`Bearer ${token(USERS.staff1, 'admin')}`)).status).toBe(401);
  });
});

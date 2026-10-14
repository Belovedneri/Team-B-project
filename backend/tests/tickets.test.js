const request = require('supertest');
const { setupDb, token, auth, USERS } = require('./setup');
const app = require('../src/app');

const valid = { title: 'Printer jammed', description: 'Second floor printer jams on every page', category: 'Hardware', priority: 'High' };

let mem;
beforeEach(() => { mem = setupDb(); });

const create = (who = 'staff1', body = valid) =>
  request(app).post('/api/tickets').set('Authorization', auth[who]).send(body);

describe('Authentication (401)', () => {
  test('no token', async () => {
    const res = await request(app).get('/api/tickets');
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBeDefined();
  });
  test('expired token', async () => {
    const expired = token(1, 'staff', { expiresIn: -10 });
    const res = await request(app).get('/api/tickets').set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
  });
  test('token signed with wrong secret', async () => {
    const forged = require('jsonwebtoken').sign({ sub: '4', role: 'admin' }, 'wrong');
    const res = await request(app).get('/api/tickets').set('Authorization', `Bearer ${forged}`);
    expect(res.status).toBe(401);
  });
});

describe('POST /api/tickets', () => {
  test('staff creates a ticket; status defaults to Open, owner from token', async () => {
    const res = await create();
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ status: 'Open', created_by: USERS.staff1, priority: 'High' });
  });
  test('support cannot create tickets (403)', async () => {
    expect((await create('support')).status).toBe(403);
  });
  test('invalid category / short title rejected (400)', async () => {
    const res = await create('staff1', { ...valid, category: 'printer', title: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.error.details.map(d => d.field)).toEqual(expect.arrayContaining(['category', 'title']));
  });
  test('cannot set created_by or status via body (mass assignment)', async () => {
    const res = await create('staff1', { ...valid, created_by: 2, status: 'Closed' });
    expect(res.status).toBe(400);
  });
  test('SQL injection in title is stored as plain text', async () => {
    const res = await create('staff1', { ...valid, title: "x'); DROP TABLE tickets;--" });
    expect(res.status).toBe(201);
    expect((await request(app).get('/api/tickets').set('Authorization', auth.admin)).body.meta.total).toBe(1);
  });
});

describe('Visibility and ownership', () => {
  test('staff only sees own tickets; other staff get 404 on direct access', async () => {
    const { body } = await create('staff1');
    await create('staff2');
    const list = await request(app).get('/api/tickets').set('Authorization', auth.staff1);
    expect(list.body.data).toHaveLength(1);
    const other = await request(app).get(`/api/tickets/${body.data.id}`).set('Authorization', auth.staff2);
    expect(other.status).toBe(404);
  });
  test('support sees only tickets assigned to them', async () => {
    const { body } = await create();
    await create();
    await request(app).patch(`/api/tickets/${body.data.id}/assign`).set('Authorization', auth.admin).send({ assigneeId: USERS.support });
    const list = await request(app).get('/api/tickets').set('Authorization', auth.support);
    expect(list.body.data.map(t => t.id)).toEqual([body.data.id]);
  });
  test('filters by status, priority, category', async () => {
    await create();
    await create('staff1', { ...valid, priority: 'Low', category: 'Network' });
    const res = await request(app).get('/api/tickets?priority=Low&category=Network').set('Authorization', auth.admin);
    expect(res.body.data).toHaveLength(1);
    expect((await request(app).get('/api/tickets?status=bogus').set('Authorization', auth.admin)).status).toBe(400);
  });
  test('non-numeric id rejected (400)', async () => {
    expect((await request(app).get('/api/tickets/abc').set('Authorization', auth.admin)).status).toBe(400);
  });
});

describe('Assignment and status flow', () => {
  let id;
  beforeEach(async () => { id = (await create()).body.data.id; });

  test('only admin can assign (403 for staff/support)', async () => {
    const r = await request(app).patch(`/api/tickets/${id}/assign`).set('Authorization', auth.support).send({ assigneeId: USERS.support });
    expect(r.status).toBe(403);
  });
  test('cannot assign to a non-support user', async () => {
    const r = await request(app).patch(`/api/tickets/${id}/assign`).set('Authorization', auth.admin).send({ assigneeId: USERS.staff2 });
    expect(r.status).toBe(400);
  });
  test('full flow Open → In Progress → Resolved → Closed is audited', async () => {
    const patch = (who, status) => request(app).patch(`/api/tickets/${id}/status`).set('Authorization', auth[who]).send({ status });
    await request(app).patch(`/api/tickets/${id}/assign`).set('Authorization', auth.admin).send({ assigneeId: USERS.support });

    expect((await patch('staff1', 'In Progress')).status).toBe(403);  // staff can't start work
    expect((await patch('support', 'Closed')).status).toBe(403);      // can't skip steps
    expect((await patch('support', 'In Progress')).status).toBe(200);
    expect((await patch('support', 'Resolved')).status).toBe(200);
    expect((await patch('staff1', 'Closed')).status).toBe(200);       // owner confirms fix

    const logs = await request(app).get('/api/audit-logs').set('Authorization', auth.admin);
    const actions = logs.body.data.map(l => l.action);
    expect(actions.filter(a => a === 'STATUS_CHANGE')).toHaveLength(3);
    expect(actions).toContain('TICKET_ASSIGNED');
    const change = logs.body.data.find(l => l.action === 'STATUS_CHANGE' && l.details.to === 'Closed');
    expect(change).toMatchObject({ user_id: USERS.staff1, entity_type: 'ticket', entity_id: id, details: { from: 'Resolved' } });
  });
});

describe('Comments', () => {
  test('owner and assigned support can comment; others get 404', async () => {
    const id = (await create()).body.data.id;
    await request(app).patch(`/api/tickets/${id}/assign`).set('Authorization', auth.admin).send({ assigneeId: USERS.support });
    const post = (who) => request(app).post(`/api/tickets/${id}/comments`).set('Authorization', auth[who]).send({ body: 'Any update?' });
    expect((await post('staff1')).status).toBe(201);
    expect((await post('support')).status).toBe(201);
    expect((await post('staff2')).status).toBe(404);
    const list = await request(app).get(`/api/tickets/${id}/comments`).set('Authorization', auth.staff1);
    expect(list.body.data.map(c => c.user_id)).toEqual([USERS.staff1, USERS.support]);
  });
  test('empty comment rejected', async () => {
    const id = (await create()).body.data.id;
    const r = await request(app).post(`/api/tickets/${id}/comments`).set('Authorization', auth.staff1).send({ body: '  ' });
    expect(r.status).toBe(400);
  });
});

describe('Audit logs endpoint', () => {
  test('filters by action and userId; unknown action rejected', async () => {
    const id = (await create()).body.data.id;
    await request(app).patch(`/api/tickets/${id}/assign`).set('Authorization', auth.admin).send({ assigneeId: USERS.support });
    await request(app).patch(`/api/tickets/${id}/status`).set('Authorization', auth.support).send({ status: 'In Progress' });
    const get = (q) => request(app).get(`/api/audit-logs?${q}`).set('Authorization', auth.admin);
    expect((await get('action=STATUS_CHANGE')).body.data.map(l => l.user_id)).toEqual([USERS.support]);
    expect((await get(`userId=${USERS.admin}`)).body.data.map(l => l.action)).toEqual(['TICKET_ASSIGNED']);
    expect((await get('action=STATUS_CHANGED')).status).toBe(400);
  });
  test('admin only', async () => {
    expect((await request(app).get('/api/audit-logs').set('Authorization', auth.staff1)).status).toBe(403);
    expect((await request(app).get('/api/audit-logs').set('Authorization', auth.support)).status).toBe(403);
    expect((await request(app).get('/api/audit-logs').set('Authorization', auth.admin)).status).toBe(200);
  });
});

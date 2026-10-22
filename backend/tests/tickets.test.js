const request = require('supertest');
const { setupDb, token, auth, USERS } = require('./setup');
const app = require('../src/app');
const db = require('../src/config/db');

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
  test('status change that loses a race gets 409 and is not audited', async () => {
    await request(app).patch(`/api/tickets/${id}/assign`).set('Authorization', auth.admin).send({ assigneeId: USERS.support });
    // Another request moves the ticket on after the route has read it but before its UPDATE runs
    const query = db.query;
    const spy = jest.spyOn(db, 'query').mockImplementation((text, params) => {
      if (/^UPDATE tickets\s+SET status/.test(text)) {
        mem.public.none(`UPDATE tickets SET status = 'In Progress' WHERE id = ${id}`);
      }
      return query(text, params);
    });
    let r;
    try {
      r = await request(app).patch(`/api/tickets/${id}/status`).set('Authorization', auth.support).send({ status: 'In Progress' });
    } finally {
      spy.mockRestore();
    }

    expect(r.status).toBe(409);
    const logs = await request(app).get('/api/audit-logs').set('Authorization', auth.admin);
    expect(logs.body.data.map(l => l.action)).not.toContain('STATUS_CHANGE');
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
  test('staff can reopen a resolved ticket but not close an open one', async () => {
    const patch = (who, status) =>
      request(app).patch(`/api/tickets/${id}/status`)
        .set('Authorization', auth[who])
        .send({ status });

    await request(app)
      .patch(`/api/tickets/${id}/assign`)
      .set('Authorization', auth.admin)
      .send({ assigneeId: USERS.support });

    expect((await patch('staff1', 'Closed')).status).toBe(403);
    expect((await patch('support', 'In Progress')).status).toBe(200);
    expect((await patch('support', 'Resolved')).status).toBe(200);
    expect((await patch('staff1', 'In Progress')).status).toBe(200);
  });

  test('reopened overdue ticket clears resolved_at and is flagged as breached', async () => {
    const patch = (who, status) =>
      request(app).patch(`/api/tickets/${id}/status`)
        .set('Authorization', auth[who])
        .send({ status });

    await request(app)
      .patch(`/api/tickets/${id}/assign`)
      .set('Authorization', auth.admin)
      .send({ assigneeId: USERS.support });

    expect((await patch('support', 'In Progress')).status).toBe(200);
    expect((await patch('support', 'Resolved')).status).toBe(200);

    const overdueAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    mem.public.none(
      `UPDATE tickets SET due_at = '${overdueAt}' WHERE id = ${id}`
    );

    const reopened = await patch('staff1', 'In Progress');

    expect(reopened.status).toBe(200);
    expect(reopened.body.data.resolved_at).toBeNull();
    expect(reopened.body.data.sla_breached).toBe(true);
  });

    const patch = (who, status) => request(app).patch(`/api/tickets/${id}/status`).set('Authorization', auth[who]).send({ status });
    test('admin can close an open ticket directly', async () => {
    const res = await request(app).patch(`/api/tickets/${id}/status`).set('Authorization', auth.admin).send({ status: 'Closed' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('Closed');
  });
  test('admin can work, resolve, reopen and close, but not close an in-progress ticket', async () => {
    const patch = (status) => request(app).patch(`/api/tickets/${id}/status`).set('Authorization', auth.admin).send({ status });

    expect((await patch('In Progress')).status).toBe(200);
    expect((await patch('Closed')).status).toBe(403);       // must be resolved first
    expect((await patch('Resolved')).status).toBe(200);
    expect((await patch('In Progress')).status).toBe(200);  // reopen
    expect((await patch('Resolved')).status).toBe(200);
    expect((await patch('Closed')).status).toBe(200);
    expect((await patch('In Progress')).status).toBe(403);  // Closed is final
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
  test('created comment has the same shape as the list (what the ticket page renders)', async () => {
    const id = (await create()).body.data.id;
    const created = await request(app).post(`/api/tickets/${id}/comments`).set('Authorization', auth.staff1).send({ body: 'Still jamming' });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ body: 'Still jamming', user_id: USERS.staff1, user_name: 'Staff One', user_role: 'staff' });
    expect(created.body.data.created_at).toBeDefined();

    const list = await request(app).get(`/api/tickets/${id}/comments`).set('Authorization', auth.staff1);
    expect(list.status).toBe(200);
    expect(Object.keys(list.body.data[0]).sort()).toEqual(Object.keys(created.body.data).sort());
  });
  test('cannot comment on a closed ticket (400), but can still read its comments', async () => {
    const id = (await create()).body.data.id;
    await request(app).post(`/api/tickets/${id}/comments`).set('Authorization', auth.staff1).send({ body: 'Before closing' });
    await request(app).patch(`/api/tickets/${id}/status`).set('Authorization', auth.admin).send({ status: 'Closed' });
    const r = await request(app).post(`/api/tickets/${id}/comments`).set('Authorization', auth.staff1).send({ body: 'After closing' });
    expect(r.status).toBe(400);
    expect(r.body.error.message).toBe('Cannot comment on a closed ticket');
    const list = await request(app).get(`/api/tickets/${id}/comments`).set('Authorization', auth.staff1);
    expect(list.body.data.map(c => c.body)).toEqual(['Before closing']);
  });
  test('frontend origin passes the CORS preflight for posting a comment', async () => {
    const origin = process.env.CORS_ORIGIN || 'http://localhost:5500';
    const r = await request(app).options('/api/tickets/1/comments')
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'authorization,content-type');
    expect(r.status).toBe(204);
    expect(r.headers['access-control-allow-origin']).toBe(origin);
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

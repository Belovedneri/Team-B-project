const request = require('supertest');
const { setupDb, auth } = require('./setup');
const app = require('../src/app');

const valid = {
  title: 'Printer jammed',
  description: 'Second floor printer jams on every page',
  category: 'Hardware',
  priority: 'High',
};

beforeEach(() => {
  setupDb();
});

const create = (priority, title) =>
  request(app)
    .post('/api/tickets')
    .set('Authorization', auth.staff1)
    .send({ ...valid, priority, title });

describe('GET /api/reports', () => {
  test('admin receives ticket counts grouped by status and priority', async () => {
    await create('High', 'High priority ticket');
    await create('High', 'Another high priority ticket');
    await create('Low', 'Low priority ticket');

    const res = await request(app)
      .get('/api/reports')
      .set('Authorization', auth.admin);

    expect(res.status).toBe(200);

    expect(res.body.data.byStatus).toEqual([
      { status: 'Open', count: 3 },
    ]);

    expect(res.body.data.byPriority).toEqual([
      { priority: 'High', count: 2 },
      { priority: 'Low', count: 1 },
    ]);
  });

  test('staff cannot access reports', async () => {
    const res = await request(app)
      .get('/api/reports')
      .set('Authorization', auth.staff1);

    expect(res.status).toBe(403);
  });

  test('support cannot access reports', async () => {
    const res = await request(app)
      .get('/api/reports')
      .set('Authorization', auth.support);

    expect(res.status).toBe(403);
  });

  test('requests without a token are rejected', async () => {
    const res = await request(app).get('/api/reports');

    expect(res.status).toBe(401);
  });
});

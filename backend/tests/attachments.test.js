
const request = require('supertest');
const fs = require('fs/promises');
const { PNG } = require('pngjs');
const os = require('os');
const path = require('path');

// Use a separate temporary folder for attachment tests.
const uploadDir = path.join(os.tmpdir(), 'helpdesk-attachments-test');

process.env.UPLOAD_DIR = uploadDir;

const { setupDb, auth } = require('./setup');
const app = require('../src/app');

const valid = {
  title: 'Printer jammed',
  description: 'Printer keeps jamming',
  category: 'Hardware',
  priority: 'High',
};

// Generate a valid 1x1 PNG image for attachment tests.
const png = PNG.sync.write({
  width: 1,
  height: 1,
  data: Buffer.from([255, 0, 0, 255]),
});

async function createTicket(who = 'staff1') {
  const res = await request(app)
    .post('/api/tickets')
    .set('Authorization', auth[who])
    .send(valid);

  expect(res.status).toBe(201);
  return res.body.data.id;
}

function upload(
  ticketId,
  who = 'staff1',
  buffer = png,
  contentType = 'image/png'
) {
  return request(app)
    .post(`/api/tickets/${ticketId}/attachments`)
    .set('Authorization', auth[who])
    .attach('file', buffer, {
      filename: 'test-file',
      contentType,
    });
}

beforeEach(async () => {
  await setupDb();
  await fs.rm(uploadDir, { recursive: true, force: true });
  await fs.mkdir(uploadDir, { recursive: true });
});

afterAll(async () => {
  await fs.rm(uploadDir, { recursive: true, force: true });
  delete process.env.UPLOAD_DIR;
});

describe('Attachment uploads', () => {
  test('uploads a PNG and records the authenticated user', async () => {
    const ticketId = await createTicket();
    const res = await upload(ticketId);

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      ticket_id: ticketId,
      uploaded_by: 1,
      mime_type: 'image/png',
      size_bytes: png.length,
    });

    expect(res.body.data.downloadUrl).toBeDefined();
    expect(res.body.data.stored_name).toBeUndefined();

    const files = await fs.readdir(uploadDir);
    expect(files).toHaveLength(1);
    expect(files[0]).not.toBe('test-file');
  });

  test('rejects a PNG containing only the file signature', async () => {
    const ticketId = await createTicket();

    const fakePng = Buffer.from([
      0x89, 0x50, 0x4e, 0x47,
      0x0d, 0x0a, 0x1a, 0x0a,
    ]);

    const res = await upload(ticketId, 'staff1', fakePng, 'image/png');

    expect(res.status).toBe(400);
  });

  test('rejects content that does not match its declared MIME type', async () => {
    const ticketId = await createTicket();

    const res = await upload(
      ticketId,
      'staff1',
      Buffer.from('This is not a PDF'),
      'application/pdf'
    );

    expect(res.status).toBe(400);
  });

  test('rejects files larger than 5 MB', async () => {
    const ticketId = await createTicket();
    const oversized = Buffer.alloc(5 * 1024 * 1024 + 1, 65);

    const res = await upload(ticketId, 'staff1', oversized, 'text/plain');

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('5 MB');
  });

  test('rejects a missing file', async () => {
    const ticketId = await createTicket();

    const res = await request(app)
      .post(`/api/tickets/${ticketId}/attachments`)
      .set('Authorization', auth.staff1);

    expect(res.status).toBe(400);
  });

  test('requires authentication', async () => {
    const ticketId = await createTicket();

    const res = await request(app)
      .post(`/api/tickets/${ticketId}/attachments`)
      .attach('file', png, {
        filename: 'test.png',
        contentType: 'image/png',
      });

    expect(res.status).toBe(401);
  });

  test('does not allow another staff member to upload to the ticket', async () => {
    const ticketId = await createTicket('staff1');
    const res = await upload(ticketId, 'staff2');

    expect(res.status).toBe(404);
  });

  test('allows an attachment linked to a comment on the same ticket', async () => {
    const ticketId = await createTicket();

    const comment = await request(app)
      .post(`/api/tickets/${ticketId}/comments`)
      .set('Authorization', auth.staff1)
      .send({ body: 'Please see the attached screenshot.' });

    expect(comment.status).toBe(201);

    const res = await request(app)
      .post(`/api/tickets/${ticketId}/attachments`)
      .set('Authorization', auth.staff1)
      .field('comment_id', String(comment.body.data.id))
      .attach('file', png, {
        filename: 'test.png',
        contentType: 'image/png',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.comment_id).toBe(comment.body.data.id);
  });

  test('rejects a comment that does not belong to the ticket', async () => {
    const firstTicket = await createTicket('staff1');
    const secondTicket = await createTicket('staff2');

    const comment = await request(app)
      .post(`/api/tickets/${secondTicket}/comments`)
      .set('Authorization', auth.staff2)
      .send({ body: 'Comment on another ticket' });

    expect(comment.status).toBe(201);

    const res = await request(app)
      .post(`/api/tickets/${firstTicket}/attachments`)
      .set('Authorization', auth.staff1)
      .field('comment_id', String(comment.body.data.id))
      .attach('file', png, {
        filename: 'test.png',
        contentType: 'image/png',
      });

    expect(res.status).toBe(400);
  });
});

describe('Attachment downloads', () => {
  test('allows the ticket owner to download an attachment', async () => {
    const ticketId = await createTicket();
    const uploaded = await upload(ticketId);

    expect(uploaded.status).toBe(201);

    const res = await request(app)
      .get(uploaded.body.data.downloadUrl)
      .set('Authorization', auth.staff1);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('image/png');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  test('does not allow another staff member to download the attachment', async () => {
    const ticketId = await createTicket('staff1');
    const uploaded = await upload(ticketId);

    expect(uploaded.status).toBe(201);

    const res = await request(app)
      .get(uploaded.body.data.downloadUrl)
      .set('Authorization', auth.staff2);

    expect(res.status).toBe(404);
  });
});

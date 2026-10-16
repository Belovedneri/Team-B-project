const express = require('express');
const multer = require('multer');
const { PNG } = require('pngjs');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { z } = require('zod');

const db = require('../config/db');
const AppError = require('../utils/AppError');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const s = require('../schemas/tickets');
const { getVisibleTicket } = require('../services/ticketAccess');

const router = express.Router();
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.resolve(__dirname, '../../uploads');

const allowedTypes = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'application/pdf': '.pdf',
  'text/plain': '.txt',
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
});

router.use(authenticate);

// Check ticket access before receiving a file.
async function checkTicketAccess(req, res, next) {
  try {
    req.ticket = await getVisibleTicket(req.user, req.params.id);
    next();
  } catch (err) {
    next(err);
  }
}

// Convert upload errors into clear client errors.
function receiveFile(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new AppError(400, 'File must not exceed 5 MB'));
      }

      return next(new AppError(400, 'Please upload exactly one file'));
    }

    next(err);
  });
}

// Check file contents instead of trusting the browser's MIME declaration.
function detectMimeType(buffer) {
  const pngSignature = Buffer.from([
    0x89, 0x50, 0x4e, 0x47,
    0x0d, 0x0a, 0x1a, 0x0a,
  ]);

  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(pngSignature)) {
    try {
      const image = PNG.sync.read(buffer);

      // Reject images with unreasonable dimensions.
      if (
        image.width <= 0 ||
        image.height <= 0 ||
        image.width * image.height > 25_000_000
      ) {
        return null;
      }

      return 'image/png';
    } catch {
      // The signature exists, but the PNG data is invalid.
      return null;
    }
  }

  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return 'image/jpeg';
  }

  if (buffer.subarray(0, 5).toString('ascii') === '%PDF-') {
    return 'application/pdf';
  }

  // Plain text must be valid UTF-8 without binary control characters.
  const text = buffer.toString('utf8');
  const validUtf8 = Buffer.from(text, 'utf8').equals(buffer);
  const hasBinaryControls =
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(text);

  if (buffer.length > 0 && validUtf8 && !hasBinaryControls) {
    return 'text/plain';
  }

  return null;
}

// POST /api/tickets/:id/attachments
router.post(
  '/:id/attachments',
  validate({ params: s.idParam }),
  checkTicketAccess,
  receiveFile,
  async (req, res) => {
    const ticket = req.ticket;

    if (!req.file) {
      throw new AppError(400, 'A file is required');
    }

    if (req.file.size === 0) {
      throw new AppError(400, 'Empty files are not allowed');
    }

    const detectedType = detectMimeType(req.file.buffer);

    if (
      !detectedType ||
      !allowedTypes[req.file.mimetype] ||
      detectedType !== req.file.mimetype
    ) {
      throw new AppError(
        400,
        'Unsupported file type or file content does not match its declared type'
      );
    }

    // A comment must belong to the same ticket.
    let commentId = null;

    if (req.body.comment_id !== undefined) {
      commentId = Number(req.body.comment_id);

      if (!Number.isInteger(commentId) || commentId < 1) {
        throw new AppError(400, 'comment_id must be a positive integer');
      }

      const comment = await db.query(
        'SELECT id FROM comments WHERE id = $1 AND ticket_id = $2',
        [commentId, ticket.id]
      );

      if (!comment.rows[0]) {
        throw new AppError(400, 'Comment does not belong to this ticket');
      }
    }

    const storedName = `${crypto.randomUUID()}${allowedTypes[detectedType]}`;
    const filePath = path.join(UPLOAD_DIR, storedName);

    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    await fs.writeFile(filePath, req.file.buffer, { flag: 'wx' });

    try {
      const { rows } = await db.query(
        `INSERT INTO attachments
          (ticket_id, comment_id, uploaded_by, stored_name, mime_type, size_bytes)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, ticket_id, comment_id, uploaded_by,
                   mime_type, size_bytes, created_at`,
        [
          ticket.id,
          commentId,
          req.user.id,
          storedName,
          detectedType,
          req.file.size,
        ]
      );

      res.status(201).json({
        data: {
          ...rows[0],
          downloadUrl: `/api/tickets/${ticket.id}/attachments/${rows[0].id}/download`,
        },
      });
    } catch (err) {
      // Remove the file if the database insert fails.
      await fs.unlink(filePath).catch(() => {});

      if (err.code === '23503') {
        throw new AppError(400, 'Invalid ticket or comment reference');
      }

      throw err;
    }
  }
);

// GET /api/tickets/:id/attachments/:attachmentId/download
router.get(
  '/:id/attachments/:attachmentId/download',
  validate({
    params: z.object({
      id: z.coerce.number().int().positive(),
      attachmentId: z.coerce.number().int().positive(),
    }),
  }),
  async (req, res, next) => {
    const ticket = await getVisibleTicket(req.user, req.params.id);

    const { rows } = await db.query(
      `SELECT id, stored_name, mime_type
       FROM attachments
       WHERE id = $1 AND ticket_id = $2`,
      [req.params.attachmentId, ticket.id]
    );

    if (!rows[0]) {
      throw new AppError(404, 'Attachment not found');
    }

    const filePath = path.join(UPLOAD_DIR, rows[0].stored_name);

    try {
      await fs.access(filePath);
    } catch {
      throw new AppError(404, 'Attachment file not found');
    }

    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Content-Type', rows[0].mime_type);

    res.download(filePath, rows[0].stored_name, (err) => {
      if (err && !res.headersSent) next(err);
    });
  }
);

module.exports = router;

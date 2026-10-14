// Spins up an in-memory Postgres (pg-mem) with the team schema (database/schema.sql) + sample users.
// Lets tests run anywhere without a real database.
const fs = require('fs');
const path = require('path');
const { newDb } = require('pg-mem');
const jwt = require('jsonwebtoken');
const db = require('../src/config/db');

process.env.JWT_SECRET = 'test_secret';

// pg-mem can't run plpgsql functions or CREATE TRIGGER, so the set_updated_at
// function and its triggers are skipped here. Everything else (enums, tables,
// constraints, indexes) loads as written. Routes set updated_at themselves.
function loadSchema() {
  return fs.readFileSync(path.join(__dirname, '../../database/schema.sql'), 'utf8')
    .replace(/CREATE FUNCTION[\s\S]*?\$\$\s*LANGUAGE plpgsql;/g, '')
    .replace(/CREATE TRIGGER[^;]*;/g, '');
}

function setupDb() {
  const mem = newDb();
  mem.public.none(loadSchema());
  mem.public.none(`
    INSERT INTO users (name, email, password_hash, role) VALUES
      ('Staff One', 'staff1@test.io', 'x', 'staff'),
      ('Staff Two', 'staff2@test.io', 'x', 'staff'),
      ('Support One', 'support1@test.io', 'x', 'support'),
      ('Admin', 'admin@test.io', 'x', 'admin');
  `);
  const { Pool } = mem.adapters.createPg();
  db.setPool(new Pool());
  return mem;
}

const token = (id, role, opts = {}) => jwt.sign({ sub: String(id), role }, process.env.JWT_SECRET, { expiresIn: '1h', ...opts });

const USERS = { staff1: 1, staff2: 2, support: 3, admin: 4 };
const auth = {
  staff1: `Bearer ${token(1, 'staff')}`,
  staff2: `Bearer ${token(2, 'staff')}`,
  support: `Bearer ${token(3, 'support')}`,
  admin: `Bearer ${token(4, 'admin')}`,
};

module.exports = { setupDb, token, auth, USERS };

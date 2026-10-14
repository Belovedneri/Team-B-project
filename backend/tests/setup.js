// Spins up an in-memory Postgres (pg-mem) with the schema + sample users.
// Lets tests run anywhere without a real database.
const fs = require('fs');
const path = require('path');
const { newDb } = require('pg-mem');
const jwt = require('jsonwebtoken');
const db = require('../src/config/db');

process.env.JWT_SECRET = 'test_secret';

function setupDb() {
  const mem = newDb();
  mem.public.none(fs.readFileSync(path.join(__dirname, '../database/roland_tables.sql'), 'utf8'));
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

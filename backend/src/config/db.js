// Shared pg pool. Philipa may already own this file — reuse hers if so.
const { Pool } = require('pg');

let pool = new Pool({ connectionString: process.env.DATABASE_URL });

module.exports = {
  // Always use $1, $2 placeholders. Never build SQL with string concatenation.
  query: (text, params) => pool.query(text, params),
  setPool: (p) => { pool = p; }, // used by tests to swap in an in-memory DB
};

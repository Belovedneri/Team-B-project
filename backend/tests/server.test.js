// Starts the real entry point in a child process, from an empty temp dir so no local .env is picked up.
const { spawnSync } = require('child_process');
const os = require('os');
const path = require('path');
const { assertJwtSecret, PLACEHOLDER_SECRETS } = require('../src/config/env');

const SERVER = path.join(__dirname, '../src/server.js');

function startServer(jwtSecret) {
  const env = { ...process.env, PORT: '0' };
  if (jwtSecret === undefined) delete env.JWT_SECRET;
  else env.JWT_SECRET = jwtSecret;
  return spawnSync(process.execPath, [SERVER], { cwd: os.tmpdir(), env, encoding: 'utf8', timeout: 10000 });
}

describe('Server refuses to start without a real JWT_SECRET', () => {
  test('missing secret', () => {
    const r = startServer(undefined);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch('JWT_SECRET is not set');
  });

  test('empty secret', () => {
    const r = startServer('');
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch('JWT_SECRET is not set');
  });

  test.each(PLACEHOLDER_SECRETS)('placeholder secret %s', (secret) => {
    const r = startServer(secret);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch('JWT_SECRET is still the placeholder value');
  });

  test('a real secret passes the check', () => {
    expect(() => assertJwtSecret('a-long-random-value-9f3c1e7b2d')).not.toThrow();
  });
});

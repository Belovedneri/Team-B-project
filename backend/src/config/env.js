// Startup checks for required config. server.js calls this before the app loads.
// Values copied from .env.example files, so a forgotten copy-paste can't ship a known secret.
const PLACEHOLDER_SECRETS = ['replace_with_a_long_random_string', 'change-me', 'change_me', 'changeme'];

function assertJwtSecret(secret = process.env.JWT_SECRET) {
  if (!secret || !secret.trim()) throw new Error('JWT_SECRET is not set');
  if (PLACEHOLDER_SECRETS.includes(secret.trim().toLowerCase())) {
    throw new Error('JWT_SECRET is still the placeholder value. Set a long random string');
  }
}

module.exports = { assertJwtSecret, PLACEHOLDER_SECRETS };

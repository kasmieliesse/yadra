const { neon } = require('@neondatabase/serverless');

let sql = null;
function db() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL manquant (variable d\'environnement Vercel).');
  }
  if (!sql) sql = neon(process.env.DATABASE_URL);
  return sql;
}

module.exports = { db };

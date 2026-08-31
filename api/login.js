const bcrypt = require('bcryptjs');
const { db } = require('./_lib/db');
const { isEmail } = require('./_lib/validate');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const email = (body.email || '').trim().toLowerCase();
    const password = body.password || '';

    if (!isEmail(email) || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis.' });
    }

    const sql = db();
    const rows = await sql`select id, first_name, last_name, email, password_hash, email_verified from users where lower(email) = ${email}`;
    if (!rows.length) {
      return res.status(401).json({ error: 'Identifiants incorrects.' });
    }
    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Identifiants incorrects.' });
    }
    if (!user.email_verified) {
      return res.status(403).json({ error: 'Adresse email non vérifiée. Consultez votre boîte mail.' });
    }

    return res.status(200).json({
      ok: true,
      user: { id: user.id, firstName: user.first_name, lastName: user.last_name, email: user.email }
    });
  } catch (err) {
    console.error('login error:', err);
    return res.status(500).json({ error: 'Une erreur est survenue. Réessayez dans un instant.' });
  }
};

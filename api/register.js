const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { db } = require('./_lib/db');
const { sendVerificationEmail } = require('./_lib/email');
const { isEmail, nonEmpty } = require('./_lib/validate');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const firstName = (body.firstName || '').trim();
    const lastName = (body.lastName || '').trim();
    const email = (body.email || '').trim().toLowerCase();
    const password = body.password || '';

    if (!nonEmpty(firstName, 80) || !nonEmpty(lastName, 80)) {
      return res.status(400).json({ error: 'Nom et prénom requis.' });
    }
    if (!isEmail(email)) {
      return res.status(400).json({ error: 'Adresse email invalide.' });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' });
    }

    const sql = db();
    const existing = await sql`select id from users where lower(email) = ${email}`;
    if (existing.length) {
      return res.status(409).json({ error: 'Un compte existe déjà avec cette adresse email.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 24 * 3600 * 1000);

    await sql`
      insert into users (first_name, last_name, email, password_hash, verify_token, verify_token_expires)
      values (${firstName}, ${lastName}, ${email}, ${passwordHash}, ${verifyToken}, ${expires.toISOString()})
    `;

    const appUrl = process.env.APP_URL || 'https://yadra.fr';
    const verifyUrl = appUrl + '/api/verify-email?token=' + verifyToken;
    try {
      await sendVerificationEmail(email, firstName, verifyUrl);
    } catch (emailErr) {
      // Le compte est créé même si l'email échoue ; on le signale côté serveur pour diagnostic.
      console.error('Échec envoi email de vérification:', emailErr);
    }

    return res.status(201).json({ ok: true, message: 'Compte créé. Vérifiez votre adresse email pour l\'activer.' });
  } catch (err) {
    console.error('register error:', err);
    return res.status(500).json({ error: 'Une erreur est survenue. Réessayez dans un instant.' });
  }
};

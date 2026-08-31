const { db } = require('./_lib/db');
const { sendLeadNotification } = require('./_lib/email');
const { nonEmpty } = require('./_lib/validate');

const VALID_TYPES = ['project_inquiry', 'general_contact', 'promoter_application'];

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const type = VALID_TYPES.indexOf(body.type) !== -1 ? body.type : 'general_contact';
    const name = (body.name || '').trim();
    const email = (body.email || '').trim();
    const phone = (body.phone || '').trim();
    const message = (body.message || '').trim();
    const projectId = (body.projectId || '').trim() || null;
    const projectName = (body.projectName || '').trim() || null;

    if (!nonEmpty(name, 120)) {
      return res.status(400).json({ error: 'Votre nom est requis.' });
    }
    if (!email && !phone) {
      return res.status(400).json({ error: 'Indiquez au moins un email ou un téléphone.' });
    }

    const sql = db();
    const rows = await sql`
      insert into leads (type, project_id, project_name, name, email, phone, message)
      values (${type}, ${projectId}, ${projectName}, ${name}, ${email || null}, ${phone || null}, ${message || null})
      returning id
    `;

    try {
      await sendLeadNotification({ type, project_name: projectName, name, email, phone, message });
    } catch (emailErr) {
      console.error('Échec notification email lead:', emailErr);
    }

    return res.status(201).json({ ok: true, id: rows[0].id });
  } catch (err) {
    console.error('contact error:', err);
    return res.status(500).json({ error: 'Une erreur est survenue. Réessayez dans un instant.' });
  }
};

const { sql, getSessionUser, readBody, sendEmail, userApprovedHtml, userRejectedHtml } = require('./_lib');

module.exports = async function (req, res) {
  try {
    const session = getSessionUser(req);
    if (!session || !session.isAdmin) { res.status(403).json({ error: 'interdit' }); return; }

    if (req.method === 'GET') {
      const rows = await sql`SELECT id, name, email, phone, type, status, created_at FROM users ORDER BY created_at DESC`;
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json({
        users: rows.map(function (u) {
          return { id: u.id, name: u.name, email: u.email, phone: u.phone, type: u.type, status: u.status, createdAt: u.created_at };
        })
      });
      return;
    }

    if (req.method === 'PATCH') {
      const body = await readBody(req);
      const id = String(body.id || '');
      const status = String(body.status || '');
      if (!id || ['actif', 'refuse', 'attente'].indexOf(status) === -1) { res.status(400).json({ error: 'id et status valides requis' }); return; }
      const rows = await sql`SELECT id, name, email, phone, type, status FROM users WHERE id = ${id}`;
      if (!rows.length) { res.status(404).json({ error: 'introuvable' }); return; }
      const user = rows[0];
      await sql`UPDATE users SET status = ${status} WHERE id = ${id}`;
      if (status === 'actif' && user.status !== 'actif') {
        await sendEmail({ to: user.email, subject: 'Votre compte yadra! est activé', html: userApprovedHtml(user) });
      } else if (status === 'refuse' && user.status !== 'refuse') {
        await sendEmail({ to: user.email, subject: 'Votre inscription yadra!', html: userRejectedHtml(user) });
      }
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: 'method not allowed' });
  } catch (err) {
    res.status(500).json({ error: 'admin failed', detail: String(err && err.message || err) });
  }
};

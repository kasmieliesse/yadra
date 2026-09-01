const { sql, getSessionUser } = require('./_lib');

module.exports = async function (req, res) {
  try {
    if (req.method !== 'GET') { res.status(405).json({ error: 'method not allowed' }); return; }
    const session = getSessionUser(req);
    if (!session || !session.isAdmin) { res.status(403).json({ error: 'interdit' }); return; }
    const rows = await sql`SELECT id, name, email, type, created_at FROM users ORDER BY created_at DESC`;
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      users: rows.map(function (u) {
        return { id: u.id, name: u.name, email: u.email, type: u.type, createdAt: u.created_at };
      })
    });
  } catch (err) {
    res.status(500).json({ error: 'admin failed', detail: String(err && err.message || err) });
  }
};

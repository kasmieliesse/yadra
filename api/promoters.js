const { sql, getSessionUser, readBody } = require('./_lib');

module.exports = async function (req, res) {
  try {
    if (req.method !== 'PATCH') { res.status(405).json({ error: 'method not allowed' }); return; }
    const session = getSessionUser(req);
    if (!session || !session.isAdmin) { res.status(403).json({ error: 'interdit' }); return; }
    const body = await readBody(req);
    const id = String(body.id || '');
    if (!id) { res.status(400).json({ error: 'id requis' }); return; }
    await sql`UPDATE promoters SET verified = NOT verified WHERE id = ${id}`;
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'promoters failed', detail: String(err && err.message || err) });
  }
};

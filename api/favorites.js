const { sql, getSessionUser, readBody } = require('./_lib');

module.exports = async function (req, res) {
  try {
    const session = getSessionUser(req);
    if (!session) { res.status(401).json({ error: 'auth required' }); return; }

    if (req.method === 'GET') {
      const rows = await sql`SELECT project_id FROM favorites WHERE user_id = ${session.id}`;
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json({ projectIds: rows.map(function (r) { return r.project_id; }) });
      return;
    }

    if (req.method === 'POST') {
      const body = await readBody(req);
      const projectId = String(body.projectId || '');
      if (!projectId) { res.status(400).json({ error: 'projectId requis' }); return; }
      const existing = await sql`SELECT 1 FROM favorites WHERE user_id = ${session.id} AND project_id = ${projectId}`;
      if (existing.length) {
        await sql`DELETE FROM favorites WHERE user_id = ${session.id} AND project_id = ${projectId}`;
        res.status(200).json({ active: false });
      } else {
        await sql`INSERT INTO favorites (user_id, project_id) VALUES (${session.id}, ${projectId})`;
        res.status(200).json({ active: true });
      }
      return;
    }

    res.status(405).json({ error: 'method not allowed' });
  } catch (err) {
    res.status(500).json({ error: 'favorites failed', detail: String(err && err.message || err) });
  }
};

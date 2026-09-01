const { sql, readBody, getSessionUser } = require('./_lib');

module.exports = async function (req, res) {
  try {
    if (req.method === 'POST') {
      const body = await readBody(req);
      const path = String(body.path || '').slice(0, 300);
      if (!path) { res.status(204).end(); return; }
      const projectId = body.projectId ? String(body.projectId).slice(0, 100) : null;
      await sql`INSERT INTO page_views (path, project_id) VALUES (${path}, ${projectId})`;
      res.status(204).end();
      return;
    }

    if (req.method === 'GET') {
      const session = getSessionUser(req);
      const scope = String(req.query.scope || '');

      if (scope === 'admin') {
        if (!session || !session.isAdmin) { res.status(403).json({ error: 'interdit' }); return; }
        const totalRows = await sql`SELECT count(*)::int AS n FROM page_views`;
        const last30Rows = await sql`SELECT count(*)::int AS n FROM page_views WHERE created_at > now() - interval '30 days'`;
        const topRows = await sql`
          SELECT p.id, p.nom, count(pv.*)::int AS views
          FROM page_views pv JOIN projects p ON p.id = pv.project_id
          GROUP BY p.id, p.nom ORDER BY views DESC LIMIT 5`;
        res.setHeader('Cache-Control', 'no-store');
        res.status(200).json({ total: totalRows[0].n, last30: last30Rows[0].n, topProjects: topRows });
        return;
      }

      if (scope === 'mine') {
        if (!session || session.type !== 'promoteur' || !session.promoterId) { res.status(403).json({ error: 'interdit' }); return; }
        const rows = await sql`
          SELECT p.id, p.nom, count(pv.*)::int AS views
          FROM projects p LEFT JOIN page_views pv ON pv.project_id = p.id
          WHERE p.promoter_id = ${session.promoterId}
          GROUP BY p.id, p.nom ORDER BY views DESC`;
        const total = rows.reduce(function (sum, r) { return sum + r.views; }, 0);
        res.setHeader('Cache-Control', 'no-store');
        res.status(200).json({ total: total, byProject: rows });
        return;
      }

      res.status(400).json({ error: 'scope requis' });
      return;
    }

    res.status(405).end();
  } catch (err) {
    if (req.method === 'POST') { res.status(204).end(); return; }
    res.status(500).json({ error: 'track failed', detail: String(err && err.message || err) });
  }
};

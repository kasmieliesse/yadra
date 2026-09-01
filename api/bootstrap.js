const { sql, shapeProject, shapePromoter, getSessionUser } = require('./_lib');

module.exports = async function (req, res) {
  if (req.method !== 'GET') { res.status(405).json({ error: 'method not allowed' }); return; }
  try {
    const promoterRows = await sql`SELECT id, slug, name, wilaya, verified, founded, description FROM promoters ORDER BY name`;
    const promotersById = {};
    const promoters = promoterRows.map(function (p) {
      const shaped = shapePromoter(p);
      promotersById[p.id] = shaped;
      return shaped;
    });
    const projectRows = await sql`SELECT * FROM projects WHERE status = 'publie' ORDER BY created_at DESC`;
    const projects = projectRows.map(function (row) { return shapeProject(row, promotersById); });
    const session = getSessionUser(req);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ projects: projects, promoters: promoters, session: session });
  } catch (err) {
    res.status(500).json({ error: 'bootstrap failed', detail: String(err && err.message || err) });
  }
};

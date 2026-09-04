// Appelée une fois par mois par un Vercel Cron (voir "crons" dans
// vercel.json) pour transformer /donnees/prix-immobilier d'un instantané
// en série temporelle (audit SEO §J/§L). Idempotente : ON CONFLICT permet
// de rappeler cette route sans jamais dupliquer une ligne pour la même
// wilaya/période — donc pas besoin d'authentifier strictement l'appel.
const { sql } = require('./_lib');

const WILAYA_ORDER = ['alger', 'oran', 'blida', 'constantine'];

module.exports = async function (req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') { res.status(405).end(); return; }
  try {
    await sql`CREATE TABLE IF NOT EXISTS price_snapshots (
      id TEXT PRIMARY KEY,
      wilaya TEXT NOT NULL,
      period TEXT NOT NULL,
      avg_price_m2 INT,
      projects_count INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(wilaya, period)
    )`;

    const period = new Date().toISOString().slice(0, 7); // 'AAAA-MM'
    const rows = await sql`SELECT wilaya, typologies FROM projects WHERE status = 'publie'`;

    const results = [];
    for (const w of WILAYA_ORDER) {
      const projectsInW = rows.filter(function (r) { return r.wilaya === w; });
      const perM2 = [];
      projectsInW.forEach(function (p) {
        (p.typologies || []).forEach(function (t) {
          if (t.prix && t.surface) perM2.push(t.prix / t.surface);
        });
      });
      const avg = perM2.length ? Math.round(perM2.reduce(function (a, b) { return a + b; }, 0) / perM2.length) : null;
      const id = 'snap-' + w + '-' + period;
      await sql`INSERT INTO price_snapshots (id, wilaya, period, avg_price_m2, projects_count)
        VALUES (${id}, ${w}, ${period}, ${avg}, ${projectsInW.length})
        ON CONFLICT (wilaya, period) DO UPDATE SET avg_price_m2 = EXCLUDED.avg_price_m2, projects_count = EXCLUDED.projects_count`;
      results.push({ wilaya: w, period: period, avg: avg, projects: projectsInW.length });
    }

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ ok: true, period: period, results: results });
  } catch (err) {
    res.status(500).json({ error: 'snapshot failed', detail: String(err && err.message || err) });
  }
};

// Historique des prix au m² (audit SEO §J/§L) — lecture et écriture réunies
// dans un seul fichier pour rester sous la limite de 12 fonctions
// serverless du plan Vercel Hobby (voir schema.sql pour le contexte : deux
// fichiers séparés faisaient passer le déploiement à 13 fonctions et le
// bloquait silencieusement à l'étape "Deploying outputs").
//
// GET  /api/prices             -> historique (utilisé par le client et par
//                                  le rendu bot sur /donnees/prix-immobilier
//                                  et /comparatifs/alger-vs-oran)
// GET  /api/prices?action=snapshot -> calcule et enregistre le relevé du
//                                  mois en cours (appelé une fois par mois
//                                  par une tâche planifiée côté Claude, en
//                                  remplacement d'un Vercel Cron non
//                                  disponible sur ce plan). Idempotente :
//                                  ON CONFLICT permet de rappeler cette
//                                  route sans dupliquer une ligne pour la
//                                  même wilaya/période.
const { sql } = require('./_lib');

const WILAYA_ORDER = ['alger', 'oran', 'blida', 'constantine'];

async function readHistory(res) {
  try {
    const rows = await sql`SELECT wilaya, period, avg_price_m2, projects_count FROM price_snapshots ORDER BY wilaya, period`;
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    res.status(200).json({ snapshots: rows });
  } catch (err) {
    // La table peut ne pas encore exister si le premier relevé n'a pas
    // encore tourné : on renvoie une liste vide plutôt qu'une erreur, pour
    // ne jamais casser la page qui l'appelle.
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ snapshots: [] });
  }
}

async function writeSnapshot(res) {
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
}

module.exports = async function (req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') { res.status(405).end(); return; }
  if (String(req.query.action || '') === 'snapshot') { await writeSnapshot(res); return; }
  await readHistory(res);
};

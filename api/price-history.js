// Lecture publique de l'historique des prix (alimenté par
// api/snapshot-prices.js). Utilisée par /donnees/prix-immobilier pour
// afficher une évolution dès que suffisamment de relevés existent.
const { sql } = require('./_lib');

module.exports = async function (req, res) {
  if (req.method !== 'GET') { res.status(405).end(); return; }
  try {
    const rows = await sql`SELECT wilaya, period, avg_price_m2, projects_count FROM price_snapshots ORDER BY wilaya, period`;
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    res.status(200).json({ snapshots: rows });
  } catch (err) {
    // La table peut ne pas encore exister si le premier cron n'a pas
    // encore tourné : on renvoie une liste vide plutôt qu'une erreur, pour
    // ne jamais casser la page qui l'appelle.
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ snapshots: [] });
  }
};

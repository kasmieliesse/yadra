const { sql, slugify } = require('./_lib');

// Wilayas et typologies réellement couvertes (§F du dossier SEO : garde-fou
// anti-thin-content — on ne référence dans le sitemap que des pages ville/
// typologie qui existent réellement côté front, pas une combinatoire).
const WILAYA_ORDER = ['alger', 'oran', 'blida', 'constantine'];
const WILAYA_COMMUNES = {
  alger: ['Hydra', 'Bab Ezzouar', 'Dely Ibrahim', 'Bir Mourad Raïs', 'El Achour', 'Ouled Fayet'],
  oran: ['Bir El Djir', 'Es Sénia', 'Canastel', 'Oran Centre'],
  blida: ['Blida Centre', 'Boufarik', 'Ouled Yaïch'],
  constantine: ['Ali Mendjeli', 'Constantine Centre', 'El Khroub']
};

const STATIC_PAGES = [
  { path: '/', priority: '1.0', changefreq: 'daily' },
  { path: '/projets', priority: '0.9', changefreq: 'daily' },
  { path: '/villes', priority: '0.7', changefreq: 'weekly' },
  { path: '/promoteurs', priority: '0.7', changefreq: 'weekly' },
  { path: '/a-propos', priority: '0.5', changefreq: 'monthly' },
  { path: '/investir', priority: '0.5', changefreq: 'monthly' },
  { path: '/donnees/prix-immobilier', priority: '0.6', changefreq: 'weekly' },
  { path: '/comparatifs/neuf-vs-ancien', priority: '0.4', changefreq: 'monthly' },
  { path: '/guides/acheter-depuis-letranger', priority: '0.6', changefreq: 'monthly' },
  { path: '/guides/financement-credit-immobilier-algerie', priority: '0.6', changefreq: 'monthly' },
  { path: '/guides/verifier-promoteur-immobilier-algerie', priority: '0.6', changefreq: 'monthly' },
  { path: '/lexique', priority: '0.5', changefreq: 'monthly' },
  { path: '/legal/mentions-legales', priority: '0.2', changefreq: 'yearly' },
  { path: '/legal/conditions', priority: '0.2', changefreq: 'yearly' },
  { path: '/legal/confidentialite', priority: '0.2', changefreq: 'yearly' }
];

function xmlEscape(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

module.exports = async function (req, res) {
  try {
    const projects = await sql`SELECT wilaya, commune, slug, created_at FROM projects WHERE status = 'publie' ORDER BY created_at DESC`;
    const promoters = await sql`SELECT slug, created_at FROM promoters ORDER BY created_at DESC`;
    const today = new Date().toISOString().slice(0, 10);

    // Garde-fou : une page ville n'est référencée dans le sitemap que si elle
    // contient au moins 3 programmes publiés réels (même seuil que le
    // noindex appliqué côté front dans render()). Les pages typologie ne
    // sont pas incluses ici : elles restent atteignables par maillage interne
    // (/investir) et passent sous le même garde-fou noindex côté front.
    const countByWilaya = {};
    const countByCommune = {};
    projects.forEach(function (p) {
      countByWilaya[p.wilaya] = (countByWilaya[p.wilaya] || 0) + 1;
      var ck = p.wilaya + '|' + p.commune;
      countByCommune[ck] = (countByCommune[ck] || 0) + 1;
    });

    const urls = [];
    STATIC_PAGES.forEach(function (p) {
      urls.push('<url><loc>https://yadra.fr' + p.path + '</loc><lastmod>' + today + '</lastmod><changefreq>' + p.changefreq + '</changefreq><priority>' + p.priority + '</priority></url>');
    });
    WILAYA_ORDER.forEach(function (w) {
      if ((countByWilaya[w] || 0) < 3) return;
      urls.push('<url><loc>https://yadra.fr/villes/' + w + '</loc><lastmod>' + today + '</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>');
      // Garde-fou identique, au niveau commune : même seuil de 3 programmes
      // réels, appliqué à chaque commune officiellement listée pour cette
      // wilaya (voir noindex équivalent côté front dans render()).
      (WILAYA_COMMUNES[w] || []).forEach(function (c) {
        if ((countByCommune[w + '|' + c] || 0) < 3) return;
        urls.push('<url><loc>https://yadra.fr/villes/' + w + '/' + slugify(c) + '</loc><lastmod>' + today + '</lastmod><changefreq>weekly</changefreq><priority>0.6</priority></url>');
      });
    });
    projects.forEach(function (p) {
      const loc = 'https://yadra.fr/projets/' + xmlEscape(p.wilaya) + '/' + xmlEscape(p.slug);
      const lastmod = new Date(p.created_at).toISOString().slice(0, 10);
      urls.push('<url><loc>' + loc + '</loc><lastmod>' + lastmod + '</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>');
    });
    promoters.forEach(function (p) {
      const loc = 'https://yadra.fr/promoteurs/' + xmlEscape(p.slug);
      const lastmod = new Date(p.created_at).toISOString().slice(0, 10);
      urls.push('<url><loc>' + loc + '</loc><lastmod>' + lastmod + '</lastmod><changefreq>weekly</changefreq><priority>0.6</priority></url>');
    });

    const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
      + urls.map(function (u) { return '  ' + u; }).join('\n')
      + '\n</urlset>\n';

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    res.status(200).send(xml);
  } catch (err) {
    res.status(500).send('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');
  }
};

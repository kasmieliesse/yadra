const { sql } = require('./_lib');

const STATIC_PAGES = [
  { path: '/', priority: '1.0', changefreq: 'daily' },
  { path: '/projets', priority: '0.9', changefreq: 'daily' },
  { path: '/villes', priority: '0.7', changefreq: 'weekly' },
  { path: '/promoteurs', priority: '0.7', changefreq: 'weekly' },
  { path: '/a-propos', priority: '0.5', changefreq: 'monthly' },
  { path: '/investir', priority: '0.5', changefreq: 'monthly' },
  { path: '/guides/acheter-depuis-letranger', priority: '0.6', changefreq: 'monthly' },
  { path: '/legal/mentions-legales', priority: '0.2', changefreq: 'yearly' },
  { path: '/legal/conditions', priority: '0.2', changefreq: 'yearly' },
  { path: '/legal/confidentialite', priority: '0.2', changefreq: 'yearly' }
];

function xmlEscape(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

module.exports = async function (req, res) {
  try {
    const projects = await sql`SELECT wilaya, slug, created_at FROM projects WHERE status = 'publie' ORDER BY created_at DESC`;
    const promoters = await sql`SELECT slug, created_at FROM promoters ORDER BY created_at DESC`;

    const urls = [];
    STATIC_PAGES.forEach(function (p) {
      urls.push('<url><loc>https://yadra.fr' + p.path + '</loc><changefreq>' + p.changefreq + '</changefreq><priority>' + p.priority + '</priority></url>');
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

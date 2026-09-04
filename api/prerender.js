// Rendu HTML côté serveur, réservé aux crawlers (voir vercel.json : les
// rewrites qui pointent ici sont conditionnés à l'en-tête User-Agent, les
// visiteurs humains ne passent jamais par cette fonction et continuent de
// recevoir la SPA normale, inchangée).
//
// Objectif : donner aux robots qui n'exécutent pas (ou mal, ou en différé)
// le JavaScript un contenu HTML réel dès la première réponse — le même
// contenu que celui que la SPA affiche une fois chargée, pas un contenu
// différent (voir la note "dynamic rendering" de Google : le principe est
// la parité de contenu, pas la parité visuelle).
//
// IMPORTANT — limite connue de cette implémentation : elle n'a pas pu être
// testée contre la base de production réelle depuis cet environnement (pas
// d'accès à DATABASE_URL ici). À vérifier sur un déploiement preview Vercel
// avant de merger sur main : voir la checklist dans la description de la PR.

const { sql, shapeProject, shapePromoter } = require('./_lib');

const SITE = 'https://yadra.fr';
const DEFAULT_DESC = "yadra! met en relation acquéreurs et promoteurs immobiliers en Algérie. Recherchez un projet par ville, budget et typologie, consultez les fiches détaillées et contactez directement le promoteur.";

// Doit rester synchronisé avec WILAYAS / WILAYA_ORDER dans index.html.
const WILAYAS = {
  alger: { label: 'Alger' }, oran: { label: 'Oran' }, blida: { label: 'Blida' }, constantine: { label: 'Constantine' },
  setif: { label: 'Sétif' }, annaba: { label: 'Annaba' }, 'tizi-ouzou': { label: 'Tizi Ouzou' }
};
const WILAYA_ORDER = ['alger', 'oran', 'blida', 'constantine'];

// Doit rester synchronisé avec TYPOLOGIE_DEFS dans index.html.
const TYPOLOGIE_DEFS = {
  f2: { labels: ['F2'], title: 'F2' },
  f3: { labels: ['F3'], title: 'F3' },
  'f4-f5': { labels: ['F4', 'F5'], title: 'F4 / F5' }
};

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function money(n) {
  if (n == null) return '—';
  return Math.round(n).toLocaleString('fr-FR') + ' DA';
}
function breadcrumbLd(items) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map(function (it, i) { return { '@type': 'ListItem', position: i + 1, name: it.name, item: SITE + it.path }; })
  };
}
function page(opts) {
  var title = esc(opts.title || 'yadra!');
  var description = esc((opts.description || DEFAULT_DESC).slice(0, 300));
  var canonical = SITE + opts.path;
  var robots = opts.noindex ? 'noindex, follow' : 'index, follow';
  var ld = opts.ld ? '<script type="application/ld+json">' + JSON.stringify(opts.ld) + '</script>' : '';
  return '<!doctype html><html lang="fr"><head><meta charset="utf-8">'
    + '<title>' + title + '</title>'
    + '<meta name="description" content="' + description + '">'
    + '<link rel="canonical" href="' + canonical + '">'
    + '<meta name="robots" content="' + robots + '">'
    + '<meta property="og:title" content="' + title + '"><meta property="og:description" content="' + description + '"><meta property="og:url" content="' + canonical + '">'
    + ld
    + '</head><body>'
    + '<main>' + opts.body + '</main>'
    + '<p><a href="' + canonical + '">Voir la version complète du site</a></p>'
    + '</body></html>';
}
function projectListHTML(projects) {
  if (!projects.length) return '<p>Aucun programme publié pour le moment.</p>';
  return '<ul>' + projects.map(function (p) {
    var w = WILAYAS[p.wilaya] ? WILAYAS[p.wilaya].label : p.wilaya;
    return '<li><a href="' + SITE + '/projets/' + p.wilaya + '/' + p.slug + '">' + esc(p.nom) + '</a> — ' + esc(p.commune) + ', ' + esc(w)
      + (p.prixMin ? ' — à partir de ' + money(p.prixMin) : '') + '</li>';
  }).join('') + '</ul>';
}

async function loadPromotersById() {
  var rows = await sql`SELECT id, slug, name, wilaya, verified, founded, description FROM promoters`;
  var map = {};
  rows.forEach(function (p) { map[p.id] = shapePromoter(p); });
  return map;
}
async function loadPublishedProjects() {
  var promotersById = await loadPromotersById();
  var rows = await sql`SELECT * FROM projects WHERE status = 'publie' ORDER BY created_at DESC`;
  return rows.map(function (r) { return shapeProject(r, promotersById); });
}

module.exports = async function (req, res) {
  var kind = req.query.kind;
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=1800');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  try {
    if (kind === 'home') {
      var all = await loadPublishedProjects();
      var body = '<h1>yadra! — Marketplace immobilier premium en Algérie</h1>'
        + '<p>' + esc(DEFAULT_DESC) + '</p>'
        + '<h2>Villes couvertes</h2><ul>' + WILAYA_ORDER.map(function (w) { return '<li><a href="' + SITE + '/villes/' + w + '">' + WILAYAS[w].label + '</a></li>'; }).join('') + '</ul>'
        + '<h2>Derniers programmes</h2>' + projectListHTML(all.slice(0, 20));
      res.status(200).send(page({ path: '/', body: body, ld: { '@context': 'https://schema.org', '@graph': [{ '@type': 'Organization', name: 'yadra!', url: SITE + '/' }, { '@type': 'WebSite', name: 'yadra!', url: SITE + '/' }] } }));
      return;
    }
    if (kind === 'marketplace') {
      var projects = await loadPublishedProjects();
      var body2 = '<h1>Tous les projets immobiliers en Algérie</h1>' + projectListHTML(projects);
      res.status(200).send(page({ path: '/projets', title: 'Tous les projets immobiliers en Algérie | yadra!', description: "Programmes immobiliers neufs en Algérie — Alger, Oran, Blida, Constantine et plus.", body: body2 }));
      return;
    }
    if (kind === 'detail') {
      var wilaya = String(req.query.wilaya || ''), slug = String(req.query.slug || '');
      var promotersById2 = await loadPromotersById();
      var rows2 = await sql`SELECT * FROM projects WHERE wilaya = ${wilaya} AND slug = ${slug} AND status = 'publie'`;
      if (!rows2.length) { res.status(404).send(page({ path: '/projets/' + wilaya + '/' + slug, title: 'Page introuvable | yadra!', noindex: true, body: '<h1>Programme introuvable</h1>' })); return; }
      var p = shapeProject(rows2[0], promotersById2);
      var w2 = WILAYAS[p.wilaya] ? WILAYAS[p.wilaya].label : p.wilaya;
      var body3 = '<h1>' + esc(p.nom) + '</h1>'
        + '<p>' + esc(p.commune) + ', ' + esc(w2) + (p.promoter ? ' — ' + esc(p.promoter.name) : '') + '</p>'
        + '<div>' + esc(p.description || '') + '</div>'
        + '<h2>Typologies</h2><ul>' + p.typologies.map(function (t) { return '<li>' + esc(t.label) + ' — ' + esc(t.surface) + ' m² — ' + money(t.prix) + '</li>'; }).join('') + '</ul>';
      res.status(200).send(page({
        path: '/projets/' + p.wilaya + '/' + p.slug,
        title: p.nom + ' — ' + (p.commune || '') + ', ' + w2 + ' | yadra!',
        description: p.description || DEFAULT_DESC,
        body: body3,
        ld: { '@context': 'https://schema.org', '@graph': [
          breadcrumbLd([{ name: 'Accueil', path: '/' }, { name: 'Projets', path: '/projets' }, { name: w2, path: '/villes/' + p.wilaya }, { name: p.nom, path: '/projets/' + p.wilaya + '/' + p.slug }]),
          { '@type': 'RealEstateListing', name: p.nom, description: p.description, url: SITE + '/projets/' + p.wilaya + '/' + p.slug, address: { '@type': 'PostalAddress', addressLocality: p.commune, addressRegion: w2, addressCountry: 'DZ' }, offers: { '@type': 'Offer', price: p.prixMin, priceCurrency: 'DZD', availability: 'https://schema.org/InStock' } }
        ] }
      }));
      return;
    }
    if (kind === 'villes') {
      var body4 = '<h1>Explorer par ville</h1><ul>' + WILAYA_ORDER.map(function (w) { return '<li><a href="' + SITE + '/villes/' + w + '">' + WILAYAS[w].label + '</a></li>'; }).join('') + '</ul>';
      res.status(200).send(page({ path: '/villes', title: 'Explorer par ville — Programmes immobiliers en Algérie | yadra!', body: body4 }));
      return;
    }
    if (kind === 'ville') {
      var wv = String(req.query.wilaya || '');
      if (WILAYA_ORDER.indexOf(wv) === -1) { res.status(404).send(page({ path: '/villes/' + wv, noindex: true, body: '<h1>Ville introuvable</h1>' })); return; }
      var allP = await loadPublishedProjects();
      var localP = allP.filter(function (p) { return p.wilaya === wv; });
      var body5 = '<h1>Immobilier neuf à ' + WILAYAS[wv].label + '</h1>' + projectListHTML(localP);
      res.status(200).send(page({
        path: '/villes/' + wv, title: 'Immobilier neuf à ' + WILAYAS[wv].label + ' | yadra!',
        description: 'Programmes immobiliers neufs à ' + WILAYAS[wv].label + ' : prix, typologies et promoteurs vérifiés.',
        noindex: localP.length < 3, body: body5,
        ld: { '@context': 'https://schema.org', '@graph': [breadcrumbLd([{ name: 'Accueil', path: '/' }, { name: 'Villes', path: '/villes' }, { name: WILAYAS[wv].label, path: '/villes/' + wv }])] }
      }));
      return;
    }
    if (kind === 'typologie') {
      var ts = String(req.query.slug || '');
      var def = TYPOLOGIE_DEFS[ts];
      if (!def) { res.status(404).send(page({ path: '/typologies/' + ts, noindex: true, body: '<h1>Typologie introuvable</h1>' })); return; }
      var allP2 = await loadPublishedProjects();
      var matchP = allP2.filter(function (p) { return p.typologies.some(function (t) { return def.labels.indexOf(t.label) !== -1; }); });
      var body6 = '<h1>Logement ' + def.title + ' neuf en Algérie</h1>' + projectListHTML(matchP);
      res.status(200).send(page({ path: '/typologies/' + ts, title: 'Logement ' + def.title + ' neuf en Algérie | yadra!', noindex: matchP.length < 3, body: body6 }));
      return;
    }
    if (kind === 'promoteurs') {
      var proms = await sql`SELECT slug, name FROM promoters ORDER BY name`;
      var body7 = '<h1>Nos promoteurs immobiliers vérifiés en Algérie</h1><ul>' + proms.map(function (p) { return '<li><a href="' + SITE + '/promoteurs/' + p.slug + '">' + esc(p.name) + '</a></li>'; }).join('') + '</ul>';
      res.status(200).send(page({ path: '/promoteurs', title: 'Nos promoteurs immobiliers vérifiés en Algérie | yadra!', body: body7 }));
      return;
    }
    if (kind === 'promoteur') {
      var pslug = String(req.query.slug || '');
      var promRows = await sql`SELECT * FROM promoters WHERE slug = ${pslug}`;
      if (!promRows.length) { res.status(404).send(page({ path: '/promoteurs/' + pslug, noindex: true, body: '<h1>Promoteur introuvable</h1>' })); return; }
      var pr = shapePromoter(promRows[0]);
      var prProjects = await sql`SELECT wilaya, slug, nom FROM projects WHERE promoter_id = ${promRows[0].id} AND status = 'publie'`;
      var body8 = '<h1>' + esc(pr.name) + '</h1><div>' + esc(pr.desc || '') + '</div><h2>Projets</h2><ul>'
        + prProjects.map(function (p) { return '<li><a href="' + SITE + '/projets/' + p.wilaya + '/' + p.slug + '">' + esc(p.nom) + '</a></li>'; }).join('') + '</ul>';
      res.status(200).send(page({
        path: '/promoteurs/' + pr.slug, title: pr.name + ' — Promoteur immobilier ' + (WILAYAS[pr.wilaya] ? WILAYAS[pr.wilaya].label : '') + ' | yadra!', description: pr.desc || DEFAULT_DESC, body: body8,
        ld: { '@context': 'https://schema.org', '@graph': [breadcrumbLd([{ name: 'Accueil', path: '/' }, { name: 'Promoteurs', path: '/promoteurs' }, { name: pr.name, path: '/promoteurs/' + pr.slug }]), { '@type': 'RealEstateAgent', name: pr.name, url: SITE + '/promoteurs/' + pr.slug, description: pr.desc }] }
      }));
      return;
    }
    // NB : /investir, /a-propos, /donnees/*, /comparatifs/*, /guides/* ne
    // sont volontairement PAS routées vers cette fonction (voir vercel.json)
    // — leur contenu est éditorial et déjà écrit en dur dans index.html ; le
    // dupliquer ici créerait un risque de désynchronisation, et Googlebot
    // sait déjà exécuter leur JavaScript. Seules les pages entièrement
    // pilotées par la base (catalogue, villes, promoteurs) sont concernées.
    res.status(404).send(page({ path: '/', noindex: true, body: '<h1>Page introuvable</h1>' }));
  } catch (err) {
    // Ne jamais laisser un bot sur une erreur brute : page minimale valide,
    // indexable par défaut (le pire cas reste "moins riche", jamais cassé).
    res.status(200).send(page({ path: '/', body: '<h1>yadra!</h1><p>' + esc(DEFAULT_DESC) + '</p>' }));
  }
};

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

const { sql, shapeProject, shapePromoter, slugify } = require('./_lib');

const SITE = 'https://yadra.fr';
const DEFAULT_DESC = "yadra! met en relation acquéreurs et promoteurs immobiliers en Algérie. Recherchez un projet par ville, budget et typologie, consultez les fiches détaillées et contactez directement le promoteur.";

// Doit rester synchronisé avec WILAYAS / WILAYA_ORDER dans index.html.
const WILAYAS = {
  alger: { label: 'Alger', communes: ['Hydra', 'Bab Ezzouar', 'Dely Ibrahim', 'Bir Mourad Raïs', 'El Achour', 'Ouled Fayet'] },
  oran: { label: 'Oran', communes: ['Bir El Djir', 'Es Sénia', 'Canastel', 'Oran Centre'] },
  blida: { label: 'Blida', communes: ['Blida Centre', 'Boufarik', 'Ouled Yaïch'] },
  constantine: { label: 'Constantine', communes: ['Ali Mendjeli', 'Constantine Centre', 'El Khroub'] },
  setif: { label: 'Sétif', communes: ['Sétif Centre', 'El Eulma'] },
  annaba: { label: 'Annaba', communes: ['Annaba Centre', 'Seraïdi', 'El Bouni'] },
  'tizi-ouzou': { label: 'Tizi Ouzou', communes: ['Tizi Ouzou Centre', 'Draâ Ben Khedda', 'Boukhalfa'] }
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
    if (kind === 'commune') {
      var wvc = String(req.query.wilaya || '');
      var cslug = String(req.query.commune || '');
      if (WILAYA_ORDER.indexOf(wvc) === -1 || !WILAYAS[wvc]) { res.status(404).send(page({ path: '/villes/' + wvc + '/' + cslug, noindex: true, body: '<h1>Ville introuvable</h1>' })); return; }
      var communeLabel = (WILAYAS[wvc].communes || []).filter(function (c) { return slugify(c) === cslug; })[0];
      if (!communeLabel) { res.status(404).send(page({ path: '/villes/' + wvc + '/' + cslug, noindex: true, body: '<h1>Commune introuvable</h1>' })); return; }
      var allC = await loadPublishedProjects();
      var localC = allC.filter(function (p) { return p.wilaya === wvc && p.commune === communeLabel; });
      var body5c = '<h1>Immobilier neuf à ' + esc(communeLabel) + ', ' + esc(WILAYAS[wvc].label) + '</h1>' + projectListHTML(localC);
      res.status(200).send(page({
        path: '/villes/' + wvc + '/' + cslug, title: 'Immobilier neuf à ' + communeLabel + ', ' + WILAYAS[wvc].label + ' | yadra!',
        description: 'Programmes immobiliers neufs à ' + communeLabel + ', ' + WILAYAS[wvc].label + '.',
        noindex: localC.length < 3, body: body5c,
        ld: { '@context': 'https://schema.org', '@graph': [breadcrumbLd([{ name: 'Accueil', path: '/' }, { name: 'Villes', path: '/villes' }, { name: WILAYAS[wvc].label, path: '/villes/' + wvc }, { name: communeLabel, path: '/villes/' + wvc + '/' + cslug }])] }
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
    if (kind === 'apropos') {
      var faqA = [
        ['yadra! vend-il directement des biens ?', 'Non. yadra! met en relation les acquéreurs avec les promoteurs ; la vente se conclut toujours directement avec le promoteur du projet.'],
        ['Comment un promoteur est-il vérifié avant publication ?', 'Chaque promoteur transmet son registre de commerce et ses références avant que ses projets soient publiés sur la plateforme.'],
        ["L'utilisation de yadra! est-elle payante ?", 'Non. La recherche, la consultation des fiches projets et le contact des promoteurs sont entièrement gratuits pour les acquéreurs.'],
        ["Je vis à l'étranger, puis-je acheter depuis la diaspora ?", "Oui. De nombreux acquéreurs suivent leur projet à distance ; nous privilégions les promoteurs habitués à accompagner les acheteurs de la diaspora, du premier contact jusqu'à la remise des clés."]
      ];
      var bodyA = '<h1>Le neuf algérien, montré tel qu\'il est.</h1>'
        + '<p>Chercher un logement neuf en Algérie veut souvent dire courir après l\'information : un prix qui change au téléphone, un chantier qu\'on ne voit jamais avancer, un promoteur impossible à vérifier. yadra! est né pour changer cet ordre des choses — pour ceux qui vivent en Algérie comme pour la diaspora, parfois à des milliers de kilomètres du chantier.</p>'
        + '<p>L\'équipe qbm construit yadra! depuis Alger, projet par projet. Pas d\'ambition de tout référencer : on préfère dix fiches vérifiées à cent approximatives, et un promoteur qu\'on a réellement rencontré à un logo ajouté en cinq minutes.</p>'
        + '<blockquote>Notre métier n\'est pas de vendre. C\'est de vérifier avant vous — pour que la visite ne soit pas la première fois que vous découvrez la vérité sur un projet.</blockquote>'
        + '<h2>Trois principes, sans exception</h2><ul>'
        + '<li><strong>Exigence</strong> — Aucun projet n\'apparaît sur yadra! avant qu\'on ait vérifié le promoteur : registre de commerce, références clients, avancement du chantier constaté sur place.</li>'
        + '<li><strong>Transparence</strong> — Le prix affiché est celui négocié avec le promoteur. Pas de marge cachée, pas de frais qui apparaissent au moment de signer.</li>'
        + '<li><strong>Sélection</strong> — On refuse plus de projets qu\'on n\'en publie. Un bon emplacement ne suffit pas s\'il n\'est pas porté par un promoteur sérieux.</li></ul>'
        + '<h2>Questions fréquentes</h2><dl>' + faqA.map(function (qa) { return '<dt>' + esc(qa[0]) + '</dt><dd>' + esc(qa[1]) + '</dd>'; }).join('') + '</dl>';
      res.status(200).send(page({
        path: '/a-propos', title: 'À propos — yadra!', description: "yadra! vérifie les promoteurs avant de publier leurs projets, pour les acquéreurs en Algérie comme pour la diaspora à l'étranger.", body: bodyA,
        ld: { '@context': 'https://schema.org', '@graph': [breadcrumbLd([{ name: 'Accueil', path: '/' }, { name: 'À propos', path: '/a-propos' }]), { '@type': 'FAQPage', mainEntity: faqA.map(function (qa) { return { '@type': 'Question', name: qa[0], acceptedAnswer: { '@type': 'Answer', text: qa[1] } }; }) }] }
      }));
      return;
    }
    if (kind === 'investir') {
      var allInv = await loadPublishedProjects();
      var bodyI = '<h1>Investir dans l\'immobilier neuf en Algérie, depuis le pays ou depuis l\'étranger.</h1>'
        + '<p>Les grandes villes algériennes construisent vite, et le neuf reste encore accessible face à l\'ancien bien situé. Que vous viviez en Algérie ou dans la diaspora, yadra! vous donne une vue claire sur les projets en cours, avec une information fiable sur les promoteurs et les prix.</p>'
        + '<p>' + WILAYA_ORDER.length + ' villes couvertes, ' + allInv.length + '+ projets suivis, promoteurs vérifiés à 100%.</p>'
        + '<h2>Par typologie</h2><ul>' + Object.keys(TYPOLOGIE_DEFS).map(function (slug) { return '<li><a href="' + SITE + '/typologies/' + slug + '">Logement ' + esc(TYPOLOGIE_DEFS[slug].title) + '</a></li>'; }).join('') + '</ul>'
        + '<h2>Pour aller plus loin</h2><ul>'
        + '<li><a href="' + SITE + '/donnees/prix-immobilier">Prix au m² par ville</a></li>'
        + '<li><a href="' + SITE + '/comparatifs/neuf-vs-ancien">Neuf ou ancien</a></li>'
        + '<li><a href="' + SITE + '/guides/financement-credit-immobilier-algerie">Financer son achat</a></li></ul>';
      res.status(200).send(page({
        path: '/investir', title: "Investir dans l'immobilier neuf en Algérie | yadra!", description: "Une vue claire sur les projets immobiliers en cours en Algérie, pour investir depuis le pays ou depuis la diaspora à l'étranger.", body: bodyI,
        ld: { '@context': 'https://schema.org', '@graph': [breadcrumbLd([{ name: 'Accueil', path: '/' }, { name: 'Investir', path: '/investir' }])] }
      }));
      return;
    }
    if (kind === 'donnees') {
      var allD = await loadPublishedProjects();
      var statsD = WILAYA_ORDER.map(function (w) {
        var projs = allD.filter(function (p) { return p.wilaya === w; });
        var perM2 = [];
        projs.forEach(function (p) { (p.typologies || []).forEach(function (t) { if (t.prix && t.surface) perM2.push(t.prix / t.surface); }); });
        var avg = perM2.length ? Math.round(perM2.reduce(function (a, b) { return a + b; }, 0) / perM2.length) : null;
        return { label: WILAYAS[w].label, projects: projs.length, avg: avg };
      });
      var bodyD = '<h1>Prix moyen au m² de l\'immobilier neuf, par ville</h1>'
        + '<p>Ces chiffres sont calculés automatiquement à partir des prix affichés par les promoteurs sur les programmes actuellement publiés sur yadra! — pas une statistique officielle ou exhaustive du marché, mais un instantané réel et vérifiable de notre catalogue, mis à jour à chaque nouvelle publication.</p>'
        + '<table><thead><tr><th>Ville</th><th>Prix moyen / m² constaté</th><th>Programmes</th></tr></thead><tbody>'
        + statsD.map(function (s) { return '<tr><td>' + esc(s.label) + '</td><td>' + (s.avg ? money(s.avg) + '/m²' : 'Données insuffisantes') + '</td><td>' + s.projects + '</td></tr>'; }).join('')
        + '</tbody></table>';
      try {
        var snapRows = await sql`SELECT wilaya, period, avg_price_m2 FROM price_snapshots ORDER BY wilaya, period`;
        var byW = {};
        snapRows.forEach(function (s) { (byW[s.wilaya] = byW[s.wilaya] || []).push(s); });
        var withHistory = Object.keys(byW).filter(function (w) { return byW[w].length >= 2; });
        if (withHistory.length) {
          bodyD += '<h2>Évolution</h2><table><thead><tr><th>Ville</th><th>Période</th><th>Prix moyen / m²</th></tr></thead><tbody>'
            + withHistory.map(function (w) {
              var label = WILAYAS[w] ? WILAYAS[w].label : w;
              return byW[w].map(function (s) { return '<tr><td>' + esc(label) + '</td><td>' + esc(s.period) + '</td><td>' + (s.avg_price_m2 ? money(s.avg_price_m2) + '/m²' : '—') + '</td></tr>'; }).join('');
            }).join('')
            + '</tbody></table>';
        }
      } catch (e) { /* table pas encore créée (premier cron pas encore passé) : instantané seul, rien ne casse */ }
      res.status(200).send(page({
        path: '/donnees/prix-immobilier', title: "Prix moyen au m² de l'immobilier neuf en Algérie | yadra!", description: "Prix moyen au m² par ville, calculé à partir du catalogue de programmes immobiliers neufs publiés sur yadra!.", body: bodyD,
        ld: { '@context': 'https://schema.org', '@graph': [breadcrumbLd([{ name: 'Accueil', path: '/' }, { name: "Prix de l'immobilier neuf", path: '/donnees/prix-immobilier' }]), { '@type': 'Dataset', name: "Prix moyen au m² de l'immobilier neuf en Algérie par ville — catalogue yadra!", description: "Prix moyen au m² calculé à partir des programmes immobiliers neufs publiés sur yadra!, par wilaya.", url: SITE + '/donnees/prix-immobilier', creator: { '@type': 'Organization', name: 'yadra!' } }] }
      }));
      return;
    }
    if (kind === 'comparatif') {
      var rowsC = [
        ['Garantie légale', 'Garantie décennale sur le gros œuvre, garantie de parfait achèvement', "Aucune garantie constructeur ; l'état dépend de l'entretien passé"],
        ['Normes et finitions', 'Aux normes en vigueur au moment de la construction, finitions au choix selon le promoteur', "Normes de l'époque de construction, finitions existantes à rénover ou non"],
        ['Calendrier', 'Livraison différée si achat sur plan, avec un échéancier de paiement', 'Disponible immédiatement après la transaction'],
        ['Négociation du prix', 'Généralement fixé par le promoteur, peu de marge de négociation', 'Marge de négociation souvent plus importante selon le vendeur'],
        ['Visibilité avant achat', "Visite d'un logement témoin ou de plans, projection à faire sur le résultat final", 'Visite du bien réel, état constatable immédiatement']
      ];
      var bodyC = '<h1>Immobilier neuf ou ancien en Algérie : les repères pour comparer</h1>'
        + "<p>Il n'y a pas de réponse universelle entre neuf et ancien — ça dépend du budget, du calendrier et de ce que vous recherchez. Voici les points de comparaison qui reviennent le plus souvent.</p>"
        + '<table><thead><tr><th>Critère</th><th>Neuf</th><th>Ancien</th></tr></thead><tbody>'
        + rowsC.map(function (r) { return '<tr><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td><td>' + esc(r[2]) + '</td></tr>'; }).join('')
        + '</tbody></table>';
      res.status(200).send(page({
        path: '/comparatifs/neuf-vs-ancien', title: 'Immobilier neuf ou ancien en Algérie ? | yadra!', description: "Garanties, calendrier, négociation : les repères pour comparer un achat dans le neuf et dans l'ancien en Algérie.", body: bodyC,
        ld: { '@context': 'https://schema.org', '@graph': [breadcrumbLd([{ name: 'Accueil', path: '/' }, { name: 'Neuf vs ancien', path: '/comparatifs/neuf-vs-ancien' }])] }
      }));
      return;
    }
    if (kind === 'comparatif-alger-oran') {
      var allAO = await loadPublishedProjects();
      function statsFor(w) {
        var projs = allAO.filter(function (p) { return p.wilaya === w; });
        var perM2 = [];
        projs.forEach(function (p) { (p.typologies || []).forEach(function (t) { if (t.prix && t.surface) perM2.push(t.prix / t.surface); }); });
        var avg = perM2.length ? Math.round(perM2.reduce(function (a, b) { return a + b; }, 0) / perM2.length) : null;
        return { projects: projs.length, avg: avg };
      }
      var algerS = statsFor('alger'), oranS = statsFor('oran');
      var rowsAO = [
        ['Programmes suivis sur yadra!', String(algerS.projects), String(oranS.projects)],
        ['Prix moyen / m² constaté', algerS.avg ? money(algerS.avg) + '/m²' : 'Données insuffisantes', oranS.avg ? money(oranS.avg) + '/m²' : 'Données insuffisantes'],
        ['Profil', "Capitale, plus forte densité de programmes et de sièges d'entreprises", 'Deuxième ville du pays, grande façade méditerranéenne'],
        ['Dynamique du neuf', 'Nouveaux pôles urbains en expansion continue (périphérie comprise)', 'Développement resserré entre centre-ville et communes côtières']
      ];
      var bodyAO = '<h1>Alger ou Oran : où investir dans le neuf ?</h1>'
        + "<p>Alger et Oran sont les deux marchés du neuf les plus actifs suivis par yadra!. Les chiffres ci-dessous viennent directement de notre catalogue publié — pas d'estimation externe.</p>"
        + '<table><thead><tr><th>Critère</th><th>Alger</th><th>Oran</th></tr></thead><tbody>'
        + rowsAO.map(function (r) { return '<tr><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td><td>' + esc(r[2]) + '</td></tr>'; }).join('')
        + '</tbody></table>';
      res.status(200).send(page({
        path: '/comparatifs/alger-vs-oran', title: 'Alger ou Oran : où investir dans le neuf ? | yadra!', description: "Prix moyen au m², nombre de programmes, profil de chaque marché : le comparatif Alger vs Oran pour l'immobilier neuf, à partir du catalogue yadra!.", body: bodyAO,
        ld: { '@context': 'https://schema.org', '@graph': [breadcrumbLd([{ name: 'Accueil', path: '/' }, { name: 'Alger vs Oran', path: '/comparatifs/alger-vs-oran' }])] }
      }));
      return;
    }
    if (kind === 'guide') {
      var gslug = String(req.query.slug || '');
      var GUIDES = {
        'acheter-depuis-letranger': {
          title: "Acheter un logement neuf en Algérie depuis l'étranger",
          intro: "Suivre un achat immobilier à des milliers de kilomètres du chantier change la manière de s'organiser. Voici les points de vigilance qui reviennent le plus souvent chez les acheteurs de la diaspora.",
          sections: [
            ['Vérifier le promoteur avant tout', "Avant de s'intéresser au logement lui-même, renseignez-vous sur le promoteur : depuis combien d'années il construit, quels projets il a déjà livrés, et si d'anciens acheteurs peuvent témoigner. Un registre de commerce à jour et des références vérifiables sont un minimum. Méfiez-vous d'un promoteur qui pousse à verser un acompte rapidement, avant d'avoir montré la moindre documentation."],
            ['Comprendre le calendrier de paiement', "Un achat sur plan se paie normalement en plusieurs tranches, liées à l'avancement réel des travaux, pas seulement à des dates calendaires fixes. Demandez un échéancier écrit avant de vous engager."],
            ['Suivre le chantier à distance', "Demandez des photos ou vidéos datées à intervalles réguliers. Quand c'est possible, faites constater l'avancement par un proche ou un mandataire sur place plutôt que de vous fier uniquement aux visuels envoyés par le promoteur."],
            ['Les documents à demander avant de signer', "Réunissez au minimum : le titre de propriété du terrain, le permis de construire, les plans détaillés du logement avec sa surface exacte, et un contrat de réservation ou de vente écrit incluant l'échéancier de paiement."],
            ['La procuration, quand on ne peut pas se déplacer', "Une procuration permet de mandater un proche ou un professionnel pour signer certains documents en votre absence. Les modalités exactes se vérifient auprès du consulat d'Algérie de votre lieu de résidence ou d'un notaire."]
          ]
        },
        'financement-credit-immobilier-algerie': {
          title: "Financer l'achat d'un logement neuf en Algérie",
          intro: "Un aperçu des grandes options de financement du neuf en Algérie, pour préparer vos questions avant de contacter votre banque ou le promoteur — ce guide ne remplace pas un conseil bancaire personnalisé.",
          sections: [
            ['Le crédit immobilier bancaire', 'Plusieurs banques publiques et privées proposent des crédits immobiliers en Algérie, dont la CNEP-Banque, historiquement spécialisée sur ce segment. Les conditions varient selon la banque et le profil de l\'emprunteur — comparez plusieurs offres actuelles et chiffrées.'],
            ["L'apport personnel et l'échéancier promoteur", "Au-delà du crédit bancaire, la plupart des promoteurs proposent un paiement échelonné directement lié à l'avancement du chantier. Combiner un apport personnel avec un crédit partiel, ou payer selon l'échéancier du promoteur, sont deux approches courantes."],
            ['Le cas particulier de la diaspora', "Un acquéreur résidant à l'étranger peut mobiliser une épargne en devises ou un financement dans son pays de résidence. Les modalités de transfert de fonds pour un achat immobilier sont encadrées par la réglementation algérienne des changes — à vérifier en amont auprès d'une banque."]
          ]
        },
        'verifier-promoteur-immobilier-algerie': {
          title: 'Comment vérifier un promoteur immobilier en Algérie',
          intro: "Registre de commerce, références clients, avancement du chantier : la méthode pour vérifier un promoteur immobilier en Algérie avant de s'engager.",
          sections: [
            ['Le registre de commerce, la première vérification', "En Algérie, toute société de promotion immobilière doit être inscrite au registre de commerce avec une activité correspondante. Demandez à voir ce document avant tout versement : un promoteur sérieux le transmet sans difficulté."],
            ['Demander et recouper des références clients', "Un promoteur qui a déjà livré des projets peut mettre en relation avec d'anciens acquéreurs, ou au minimum citer des programmes livrés et vérifiables sur place. Recoupez ces références vous-même plutôt que de vous fier uniquement à ce que le promoteur en dit."],
            ["Constater l'avancement réel du chantier", "Le meilleur indicateur reste le chantier lui-même. Si vous ne pouvez pas vous déplacer, demandez des photos ou vidéos datées, prises sous plusieurs angles, à intervalles réguliers, et comparez-les dans le temps."],
            ['Les signaux d\'alerte à ne pas ignorer', "Un acompte important demandé avant toute documentation, un prix nettement inférieur au marché sans justification, une réticence à fournir un contrat écrit détaillant l'échéancier de paiement, aucune référence vérifiable, ou une pression pour signer rapidement."],
            ['Comment yadra! vérifie chaque promoteur avant publication', "Avant qu'un projet apparaisse sur yadra!, nous demandons au promoteur son registre de commerce et des références, que nous contrôlons avant publication. Cette vérification réduit le risque mais ne le supprime pas entièrement : elle s'ajoute aux vérifications de ce guide, elle ne les remplace pas."]
          ]
        }
      };
      var g = GUIDES[gslug];
      if (!g) { res.status(404).send(page({ path: '/guides/' + gslug, noindex: true, body: '<h1>Guide introuvable</h1>' })); return; }
      var bodyG = '<h1>' + esc(g.title) + '</h1><p>' + esc(g.intro) + '</p>'
        + g.sections.map(function (s) { return '<h2>' + esc(s[0]) + '</h2><p>' + esc(s[1]) + '</p>'; }).join('');
      res.status(200).send(page({
        path: '/guides/' + gslug, title: g.title + ' | yadra!', description: g.intro, body: bodyG,
        ld: { '@context': 'https://schema.org', '@graph': [breadcrumbLd([{ name: 'Accueil', path: '/' }, { name: g.title, path: '/guides/' + gslug }]), { '@type': 'Article', headline: g.title, author: { '@type': 'Organization', name: 'yadra!' }, publisher: { '@type': 'Organization', name: 'yadra! by qbm' }, mainEntityOfPage: SITE + '/guides/' + gslug }] }
      }));
      return;
    }
    if (kind === 'lexique') {
      var terms = [
        ['vefa', 'VEFA (Vente en l’État Futur d’Achèvement)', 'Achat d’un logement avant ou pendant sa construction, payé par tranches liées à l’avancement réel des travaux plutôt qu’en une fois. C’est le mode d’achat le plus courant pour un programme neuf en Algérie.'],
        ['sur-plan', 'Achat sur plan', 'Autre nom courant de la VEFA : on achète sur la base de plans et d’un logement témoin, avant que le bien ne soit physiquement visitable.'],
        ['echeancier', 'Échéancier de paiement', 'Calendrier des tranches à verser au promoteur, normalement indexé sur l’avancement du chantier plutôt que sur de simples dates fixes.'],
        ['livraison', 'Livraison', 'Moment où le promoteur remet les clés du logement à l’acquéreur, une fois les travaux achevés et la réception des travaux effectuée.'],
        ['reception-travaux', 'Réception des travaux', 'Constat contradictoire entre le promoteur et l’acquéreur de l’état du logement à la livraison.'],
        ['garantie-decennale', 'Garantie décennale', 'Garantie légale qui couvre pendant dix ans les dommages compromettant la solidité du gros œuvre d’un logement neuf.'],
        ['gros-oeuvre', 'Gros œuvre', 'Ensemble des travaux structurels d’un bâtiment (fondations, murs porteurs, charpente, toiture), par opposition au second œuvre.'],
        ['promesse-vente', 'Contrat de réservation', 'Document écrit qui engage le promoteur et l’acquéreur avant la signature définitive, précisant le bien, son prix et l’échéancier de paiement.'],
        ['permis-construire', 'Permis de construire', 'Autorisation administrative obligatoire avant le début des travaux.'],
        ['titre-propriete', 'Titre de propriété', 'Document attestant que le promoteur est bien propriétaire du terrain ou du bien concerné.'],
        ['acte-authentique', 'Acte authentique', 'Acte de vente définitif signé devant notaire, qui transfère officiellement la propriété du bien à l’acquéreur.'],
        ['procuration', 'Procuration', 'Mandat donné à un proche ou un professionnel pour signer certains documents en l’absence de l’acquéreur.'],
        ['f2-f3-f4', 'F2, F3, F4, F5', 'Nomenclature algérienne désignant le nombre de pièces principales d’un logement : F2 = 2 pièces, F3 = 3 pièces, etc.'],
        ['promoteur-immobilier', 'Promoteur immobilier', 'Société qui conçoit, finance et fait construire un programme immobilier, puis le commercialise.']
      ];
      var bodyL = '<h1>Lexique de l’immobilier neuf en Algérie</h1><p>Les termes qui reviennent le plus souvent dans un achat immobilier neuf en Algérie, expliqués simplement.</p>'
        + '<dl>' + terms.map(function (t) { return '<dt>' + esc(t[1]) + '</dt><dd>' + esc(t[2]) + '</dd>'; }).join('') + '</dl>';
      res.status(200).send(page({
        path: '/lexique', title: "Lexique de l'immobilier neuf en Algérie | yadra!", description: "VEFA, livraison, garantie décennale, échéancier de paiement... les termes de l'immobilier neuf en Algérie expliqués simplement.", body: bodyL,
        ld: { '@context': 'https://schema.org', '@graph': [breadcrumbLd([{ name: 'Accueil', path: '/' }, { name: 'Lexique', path: '/lexique' }]), { '@type': 'DefinedTermSet', name: 'Lexique de l’immobilier neuf en Algérie', url: SITE + '/lexique', hasDefinedTerm: terms.map(function (t) { return { '@type': 'DefinedTerm', '@id': SITE + '/lexique#' + t[0], name: t[1], description: t[2], inDefinedTermSet: SITE + '/lexique' }; }) }] }
      }));
      return;
    }
    res.status(404).send(page({ path: '/', noindex: true, body: '<h1>Page introuvable</h1>' }));
  } catch (err) {
    // Ne jamais laisser un bot sur une erreur brute : page minimale valide,
    // indexable par défaut (le pire cas reste "moins riche", jamais cassé).
    res.status(200).send(page({ path: '/', body: '<h1>yadra!</h1><p>' + esc(DEFAULT_DESC) + '</p>' }));
  }
};

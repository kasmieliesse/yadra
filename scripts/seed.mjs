// One-time seed: creates the schema and loads the 11 demo projects + 8 promoters
// as real starter content. Run with: node scripts/seed.mjs
import { neon, Pool } from '@neondatabase/serverless';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnvLocal() {
  try {
    const text = readFileSync(join(__dirname, '..', '.env.local'), 'utf8');
    text.split('\n').forEach(function (line) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    });
  } catch (e) { /* no .env.local, assume real env */ }
}
loadEnvLocal();

const sql = neon(process.env.DATABASE_URL);

function hashStr(s) { var h = 1779033703 ^ s.length; for (var i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; } return (h ^ h >>> 16) >>> 0; }
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function pickN(seed, pool, n) {
  var rnd = mulberry32(seed), copy = pool.map(function (_, i) { return i; });
  for (var i = copy.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var tmp = copy[i]; copy[i] = copy[j]; copy[j] = tmp; }
  return copy.slice(0, n).map(function (i) { return pool[i]; });
}

var WILAYAS = {
  'alger': { label: 'Alger' }, 'oran': { label: 'Oran' }, 'blida': { label: 'Blida' }, 'constantine': { label: 'Constantine' },
  'setif': { label: 'Sétif' }, 'annaba': { label: 'Annaba' }, 'tizi-ouzou': { label: 'Tizi Ouzou' }
};
var COMMUNE_COORDS = {
  'Hydra': [36.7378, 3.0464], 'Bab Ezzouar': [36.7167, 3.1833], 'Dely Ibrahim': [36.7500, 2.9833],
  'Bir Mourad Raïs': [36.7333, 3.0500], 'El Achour': [36.7500, 2.9500], 'Ouled Fayet': [36.7500, 2.9333],
  'Bir El Djir': [35.7167, -0.5667], 'Es Sénia': [35.6333, -0.6167], 'Canastel': [35.7333, -0.5333], 'Oran Centre': [35.6969, -0.6331],
  'Blida Centre': [36.4700, 2.8300], 'Boufarik': [36.5700, 2.9100], 'Ouled Yaïch': [36.4900, 2.8200],
  'Ali Mendjeli': [36.2400, 6.6500], 'Constantine Centre': [36.3650, 6.6147], 'El Khroub': [36.2617, 6.6981],
  'Akid Lotfi': [35.6989, -0.6244], 'Bouinan': [36.5219, 2.9911]
};

var PRESTATIONS_POOL = ['Ascenseur panoramique', 'Parking sous-sol sécurisé', 'Espaces verts paysagers', 'Sécurité 24h/24', 'Salle de sport', 'Piscine résidentielle', 'Aire de jeux enfants', 'Mosquée de proximité', 'Commerces en rez-de-chaussée', 'Fibre optique', 'Vidéosurveillance', 'Groupe électrogène', 'Conciergerie', 'Terrasses aménagées'];
var POINTSFORTS_POOL = ['Vue dégagée', 'Proche des axes principaux', 'Quartier calme et résidentiel', 'Finitions haut de gamme', 'Livraison clé en main', 'Proche écoles et commerces', 'Exposition ensoleillée', 'Accès sécurisé 24h/24', 'Cadre architectural contemporain', 'Proximité transports en commun'];

var PROMOTERS = [
  { id: 'pr-atlas', name: 'Atlas Promotion', slug: 'atlas-promotion', wilaya: 'alger', verified: true, founded: 2011, desc: "Atlas Promotion conçoit des résidences contemporaines à Alger depuis plus de dix ans, avec une attention particulière portée aux espaces communs et à la qualité des finitions." },
  { id: 'pr-marina', name: 'Marina Développement', slug: 'marina-developpement', wilaya: 'oran', verified: true, founded: 2014, desc: "Marina Développement façonne le littoral oranais avec des programmes résidentiels pensés pour la vue mer et la vie de quartier." },
  { id: 'pr-numidia', name: 'Numidia Immobilier', slug: 'numidia-immobilier', wilaya: 'constantine', verified: true, founded: 2009, desc: "Numidia Immobilier accompagne l'essor de Constantine avec des ensembles résidentiels et mixtes à taille humaine." },
  { id: 'pr-kahina', name: 'Kahina Résidences', slug: 'kahina-residences', wilaya: 'tizi-ouzou', verified: false, founded: 2018, desc: "Jeune promoteur implanté en Kabylie, Kahina Résidences développe des projets à échelle humaine, proches de la nature." },
  { id: 'pr-djazair', name: 'El Djazaïr Capital', slug: 'el-djazair-capital', wilaya: 'alger', verified: true, founded: 2006, desc: "El Djazaïr Capital est l'un des acteurs historiques de la promotion immobilière à Alger, reconnu pour ses programmes haut de gamme." },
  { id: 'pr-aures', name: 'Aurès Habitat', slug: 'aures-habitat', wilaya: 'setif', verified: true, founded: 2016, desc: "Aurès Habitat construit des résidences familiales dans les Hauts Plateaux, avec un fort ancrage local à Sétif et sa région." },
  { id: 'pr-zianide', name: 'Zianide Properties', slug: 'zianide-properties', wilaya: 'annaba', verified: false, founded: 2019, desc: "Zianide Properties propose des programmes résidentiels et des villas sur le littoral est du pays." },
  { id: 'pr-cirta', name: 'Cirta Urbanisme', slug: 'cirta-urbanisme', wilaya: 'blida', verified: true, founded: 2012, desc: "Cirta Urbanisme aménage des quartiers résidentiels complets à Blida, entre vergers et nouvelles infrastructures." }
];

var RAW_PROJECTS = [
  { slug: 'residence-elegance', nom: "Résidence L'Élégance", wilaya: 'alger', commune: 'Hydra', quartier: 'Hydra Centre', promoterId: 'pr-atlas', type: 'Résidence mixte', statut: 'construction', livraison: '2025', featured: true, badge: 'Nouveau', photo: '/assets/projects/residence-elegance.jpg', gallery: ['/assets/projects/residence-elegance-g1.jpg', '/assets/projects/residence-elegance-g2.jpg', '/assets/projects/residence-elegance-g3.jpg'],
    typologies: [{ label: 'F3', surface: 90, prix: 27000000, dispo: 6 }, { label: 'F4', surface: 135, prix: 39000000, dispo: 4 }, { label: 'F5', surface: 180, prix: 50000000, dispo: 2 }],
    description: "Résidence L'Élégance déploie ses immeubles blancs à ossature contemporaine autour d'un grand bassin paysager, palmiers et allées piétonnes, au cœur d'Hydra. Un programme pensé pour une vie de quartier haut de gamme, à deux pas des ambassades et des meilleures écoles de la capitale." },
  { slug: 'terrasses-oran-akid-lotfi', nom: "Les Terrasses d'Oran", wilaya: 'oran', commune: 'Akid Lotfi', quartier: 'Akid Lotfi Nord', promoterId: 'pr-marina', type: 'Appartement', statut: 'livre', livraison: 'Livré — 2024', featured: true, badge: 'Coup de cœur', photo: '/assets/projects/terrasses-oran-akid-lotfi.jpg', gallery: ['/assets/projects/terrasses-oran-akid-lotfi-g1.jpg', '/assets/projects/terrasses-oran-akid-lotfi-g2.jpg', '/assets/projects/terrasses-oran-akid-lotfi-g3.jpg'],
    typologies: [{ label: 'F2', surface: 60, prix: 10000000, dispo: 5 }, { label: 'F3', surface: 95, prix: 15000000, dispo: 7 }, { label: 'F4', surface: 150, prix: 22500000, dispo: 3 }],
    description: "Un ensemble résidentiel livré autour d'un grand bassin central, entre tours d'habitation modernes et jardins suspendus, dans le quartier prisé d'Akid Lotfi à Oran. Piscine, espaces verts et commerces de proximité en font une adresse très recherchée." },
  { slug: 'diamond-tower-constantine', nom: 'Diamond Tower', wilaya: 'constantine', commune: 'Cité Zirout Youcef', quartier: 'Zirout Youcef Sud', promoterId: 'pr-numidia', type: 'Résidence mixte', statut: 'construction', livraison: '2026', featured: true, badge: 'Nouveau', photo: '/assets/projects/diamond-tower-constantine.jpg', gallery: ['/assets/projects/diamond-tower-constantine-g1.jpg', '/assets/projects/diamond-tower-constantine-g2.jpg', '/assets/projects/diamond-tower-constantine-g3.jpg'],
    typologies: [{ label: 'F2', surface: 100, prix: 13000000, dispo: 8 }, { label: 'F3', surface: 140, prix: 17500000, dispo: 6 }, { label: 'F4', surface: 175, prix: 21000000, dispo: 5 }, { label: 'F5', surface: 210, prix: 24000000, dispo: 3 }, { label: 'F6', surface: 250, prix: 27500000, dispo: 1 }],
    description: "Deux tours jumelles signées Numidia Immobilier, repères du nouveau skyline de Constantine à Cité Zirout Youcef. Larges baies vitrées, terrasses filantes et vue panoramique sur les gorges du Rhummel pour un programme résolument vertical." },
  { slug: 'parc-des-pins-bouinan', nom: 'Le Parc des Pins', wilaya: 'blida', commune: 'Bouinan', quartier: 'Bouinan Centre', promoterId: 'pr-cirta', type: 'Appartement', statut: 'livre', livraison: 'Livré — 2024', featured: true, badge: 'Prestige', photo: '/assets/projects/parc-des-pins-bouinan.jpg', gallery: ['/assets/projects/parc-des-pins-bouinan-g1.jpg', '/assets/projects/parc-des-pins-bouinan-g2.jpg', '/assets/projects/parc-des-pins-bouinan-g3.jpg'],
    typologies: [{ label: 'F2', surface: 70, prix: 6300000, dispo: 4 }, { label: 'F3', surface: 100, prix: 8500000, dispo: 6 }, { label: 'F4', surface: 140, prix: 11200000, dispo: 2 }],
    description: "Villas et appartements en bande organisés autour d'un long bassin miroir, entre pins et terrasses privatives, à Bouinan. Le Parc des Pins mise sur l'intimité et le prestige discret, à mi-chemin entre Blida et Alger." },
  { slug: 'jnane-el-bahdja', nom: 'Jnane El Bahdja', wilaya: 'alger', commune: 'Hydra', quartier: 'Hydra Centre', promoterId: 'pr-atlas', type: 'Résidence mixte', statut: 'sur-plan', livraison: 'T4 2028', featured: false, photo: '/assets/projects/jnane-el-bahdja.jpg', gallery: ['/assets/projects/jnane-el-bahdja-g1.jpg', '/assets/projects/jnane-el-bahdja-g2.jpg', '/assets/projects/jnane-el-bahdja-g3.jpg'], prixBase: 29000000,
    description: "Un ensemble résidentiel signé Atlas Promotion au cœur d'Hydra, pensé autour d'un jardin central et de commerces de proximité en rez-de-chaussée. Les appartements profitent d'une double orientation et de larges balcons filants." },
  { slug: 'terrasses-el-achour', nom: "Les Terrasses d'El Achour", wilaya: 'alger', commune: 'El Achour', quartier: 'El Achour', promoterId: 'pr-djazair', type: 'Appartement', statut: 'construction', livraison: 'T2 2027', featured: false, photo: '/assets/projects/terrasses-el-achour.jpg', gallery: ['/assets/projects/terrasses-el-achour-g1.jpg', '/assets/projects/terrasses-el-achour-g2.jpg', '/assets/projects/terrasses-el-achour-g3.jpg'], prixBase: 14700000,
    description: "Face aux collines d'El Achour, cette résidence en cours de construction propose des appartements du F2 au F4 avec terrasses aménagées et vue dégagée sur la baie d'Alger." },
  { slug: 'panorama-bab-ezzouar', nom: 'Panorama Bab Ezzouar', wilaya: 'alger', commune: 'Bab Ezzouar', quartier: 'Bab Ezzouar', promoterId: 'pr-atlas', type: 'Appartement', statut: 'livre', livraison: 'Livré — 2025', featured: false, photo: '/assets/projects/panorama-bab-ezzouar.jpg', gallery: ['/assets/projects/panorama-bab-ezzouar-g1.jpg', '/assets/projects/panorama-bab-ezzouar-g2.jpg', '/assets/projects/panorama-bab-ezzouar-g3.jpg'], prixBase: 13700000,
    description: "Déjà livrée et habitée, cette résidence proche du pôle universitaire et de la nouvelle gare offre un accès rapide aux transports et aux commerces." },
  { slug: 'jardins-canastel', nom: 'Les Jardins de Canastel', wilaya: 'oran', commune: 'Canastel', quartier: 'Canastel', promoterId: 'pr-marina', type: 'Résidence mixte', statut: 'construction', livraison: 'T3 2027', featured: false, photo: '/assets/projects/jardins-canastel.jpg', gallery: ['/assets/projects/jardins-canastel-g1.jpg', '/assets/projects/jardins-canastel-g2.jpg', '/assets/projects/jardins-canastel-g3.jpg'], prixBase: 16600000,
    description: "Sur les hauteurs de Canastel, ce programme mêle résidentiel et commerces de proximité avec une vue imprenable sur la baie d'Oran." },
  { slug: 'oran-sky-residence', nom: 'Oran Sky Résidence', wilaya: 'oran', commune: 'Bir El Djir', quartier: 'Bir El Djir', promoterId: 'pr-marina', type: 'Appartement', statut: 'sur-plan', livraison: 'T4 2028', featured: false, photo: '/assets/projects/oran-sky-residence.jpg', gallery: ['/assets/projects/oran-sky-residence-g1.jpg', '/assets/projects/oran-sky-residence-g2.jpg', '/assets/projects/oran-sky-residence-g3.jpg'], prixBase: 14700000,
    description: "Proche du nouveau pôle urbain de Bir El Djir, cette résidence propose des typologies du F2 au F5 avec parking sous-sol et espaces verts." },
  { slug: 'vergers-boufarik', nom: 'Les Vergers de Boufarik', wilaya: 'blida', commune: 'Boufarik', quartier: 'Boufarik Centre', promoterId: 'pr-cirta', type: 'Appartement', statut: 'construction', livraison: 'T2 2027', featured: false, photo: '/assets/projects/vergers-boufarik.jpg', gallery: ['/assets/projects/vergers-boufarik-g1.jpg', '/assets/projects/vergers-boufarik-g2.jpg', '/assets/projects/vergers-boufarik-g3.jpg'], prixBase: 7800000,
    description: "Un quartier résidentiel complet aux portes de Boufarik, entouré d'espaces verts, avec école et commerces intégrés au programme." },
  { slug: 'cirta-panorama', nom: 'Cirta Panorama', wilaya: 'constantine', commune: 'Ali Mendjeli', quartier: 'Ali Mendjeli', promoterId: 'pr-numidia', type: 'Résidence mixte', statut: 'construction', livraison: 'T4 2027', featured: false, photo: '/assets/projects/cirta-panorama.jpg', gallery: ['/assets/projects/cirta-panorama-g1.jpg', '/assets/projects/cirta-panorama-g2.jpg', '/assets/projects/cirta-panorama-g3.jpg'], prixBase: 9800000,
    description: "Dans la nouvelle ville d'Ali Mendjeli, un programme mixte associant logements et commerces, à proximité des grands équipements universitaires." }
];

function mkTypologies(seedStr, type, prixBase) {
  var rnd = mulberry32(hashStr(seedStr + '-typo'));
  var defs = [['F2', 58, 0.62], ['F3', 78, 0.8], ['F4', 98, 1.0], ['F5', 118, 1.22]];
  var count = type === 'Duplex' ? 2 : (2 + Math.floor(rnd() * 3));
  var chosen = defs.slice(0, Math.min(defs.length, count));
  return chosen.map(function (d) {
    var surf = d[1] + Math.floor(rnd() * 8) - 4;
    var prix = Math.round((prixBase * d[2]) / 50000) * 50000;
    return { label: d[0], surface: surf, prix: prix, dispo: 2 + Math.floor(rnd() * 10) };
  });
}

async function main() {
  const schema = readFileSync(join(__dirname, '..', 'sql', 'schema.sql'), 'utf8');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query(schema);
  await pool.end();
  console.log('Schema ready.');

  for (const p of PROMOTERS) {
    await sql`INSERT INTO promoters (id, slug, name, wilaya, verified, founded, description)
      VALUES (${p.id}, ${p.slug}, ${p.name}, ${p.wilaya}, ${p.verified}, ${p.founded}, ${p.desc})
      ON CONFLICT (id) DO NOTHING`;
  }
  console.log('Promoters seeded:', PROMOTERS.length);

  let count = 0;
  for (const raw of RAW_PROJECTS) {
    const seed = hashStr(raw.slug);
    const rndGeo = mulberry32(seed + 7);
    const base = COMMUNE_COORDS[raw.commune] || [36.5, 3];
    const lat = base[0] + (rndGeo() - 0.5) * 0.014;
    const lng = base[1] + (rndGeo() - 0.5) * 0.014;
    const typologies = raw.typologies || mkTypologies(raw.slug, raw.type, raw.prixBase);
    const prestations = pickN(seed + 1, PRESTATIONS_POOL, 5 + Math.floor(mulberry32(seed + 2)() * 4));
    const pointsForts = pickN(seed + 3, POINTSFORTS_POOL, 4);
    const id = 'proj-' + raw.slug;

    await sql`INSERT INTO projects (id, slug, nom, wilaya, commune, quartier, promoter_id, type, statut, livraison, description, photo, gallery, typologies, prestations, points_forts, lat, lng, featured, badge, status)
      VALUES (${id}, ${raw.slug}, ${raw.nom}, ${raw.wilaya}, ${raw.commune}, ${raw.quartier}, ${raw.promoterId}, ${raw.type}, ${raw.statut}, ${raw.livraison}, ${raw.description}, ${raw.photo}, ${JSON.stringify(raw.gallery || [])}::jsonb, ${JSON.stringify(typologies)}::jsonb, ${JSON.stringify(prestations)}::jsonb, ${JSON.stringify(pointsForts)}::jsonb, ${lat}, ${lng}, ${!!raw.featured}, ${raw.badge || null}, 'publie')
      ON CONFLICT (id) DO NOTHING`;
    count++;
  }
  console.log('Projects seeded:', count);
}

main().then(function () { console.log('Done.'); process.exit(0); }).catch(function (err) { console.error(err); process.exit(1); });

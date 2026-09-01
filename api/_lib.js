const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

const SESSION_COOKIE = 'yadra_session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64');
}

function signSession(payload) {
  const secret = process.env.SESSION_SECRET;
  const body = b64url(JSON.stringify({ ...payload, exp: Date.now() + SESSION_MAX_AGE * 1000 }));
  const sig = b64url(crypto.createHmac('sha256', secret).update(body).digest());
  return body + '.' + sig;
}

function verifySession(token) {
  if (!token) return null;
  const secret = process.env.SESSION_SECRET;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = b64url(crypto.createHmac('sha256', secret).update(body).digest());
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  let payload;
  try { payload = JSON.parse(b64urlDecode(body).toString('utf8')); } catch (e) { return null; }
  if (!payload.exp || payload.exp < Date.now()) return null;
  return payload;
}

function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;
  header.split(';').forEach(function (part) {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  });
  return out;
}

function getSessionUser(req) {
  const cookies = parseCookies(req);
  return verifySession(cookies[SESSION_COOKIE]);
}

function setSessionCookie(res, payload) {
  const token = signSession(payload);
  res.setHeader('Set-Cookie', SESSION_COOKIE + '=' + encodeURIComponent(token) + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=' + SESSION_MAX_AGE);
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', SESSION_COOKIE + '=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (e) { return {}; }
  }
  return new Promise(function (resolve) {
    let data = '';
    req.on('data', function (chunk) { data += chunk; });
    req.on('end', function () {
      try { resolve(data ? JSON.parse(data) : {}); } catch (e) { resolve({}); }
    });
  });
}

function isAdminEmail(email) {
  const list = (process.env.ADMIN_EMAILS || '').split(',').map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean);
  return list.indexOf(String(email || '').toLowerCase()) !== -1;
}

function uid(prefix) {
  return prefix + '-' + Date.now().toString(36) + crypto.randomBytes(4).toString('hex');
}

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function shapeProject(row, promotersById) {
  const typologies = row.typologies || [];
  const prices = typologies.map(function (t) { return Number(t.prix) || 0; });
  const surfaces = typologies.map(function (t) { return Number(t.surface) || 0; });
  const promoter = promotersById[row.promoter_id] || null;
  return {
    id: row.id,
    slug: row.slug,
    nom: row.nom,
    wilaya: row.wilaya,
    commune: row.commune,
    quartier: row.quartier,
    promoterId: row.promoter_id,
    promoter: promoter,
    verified: promoter ? promoter.verified : false,
    type: row.type,
    statut: row.statut,
    livraison: row.livraison,
    description: row.description,
    photo: row.photo,
    gallery: row.gallery || [],
    typologies: typologies,
    prixMin: prices.length ? Math.min.apply(null, prices) : 0,
    prixMax: prices.length ? Math.max.apply(null, prices) : 0,
    surfaceMin: surfaces.length ? Math.min.apply(null, surfaces) : 0,
    surfaceMax: surfaces.length ? Math.max.apply(null, surfaces) : 0,
    prestations: row.prestations || [],
    pointsForts: row.points_forts || [],
    adresse: [row.quartier, row.commune, row.wilaya].filter(Boolean).join(', '),
    lat: row.lat,
    lng: row.lng,
    featured: row.featured,
    badge: row.badge,
    status: row.status
  };
}

function shapePromoter(p) {
  return { id: p.id, slug: p.slug, name: p.name, wilaya: p.wilaya, verified: p.verified, founded: p.founded, desc: p.description };
}

module.exports = {
  sql,
  bcrypt,
  getSessionUser,
  setSessionCookie,
  clearSessionCookie,
  readBody,
  isAdminEmail,
  uid,
  slugify,
  shapeProject,
  shapePromoter
};

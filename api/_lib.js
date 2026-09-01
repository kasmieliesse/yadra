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

async function sendEmail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) { console.error('RESEND_API_KEY missing, email not sent:', subject); return; }
  const from = process.env.RESEND_FROM_EMAIL || 'yadra! <onboarding@resend.dev>';
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: Array.isArray(to) ? to : [to], subject, html })
    });
    if (!res.ok) { console.error('Resend error', res.status, await res.text()); }
  } catch (err) {
    console.error('Resend request failed', err);
  }
}

function emailShell(title, bodyHtml) {
  return '<div style="font-family:-apple-system,\'Segoe UI\',sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#F4F1EC;">'
    + '<div style="text-align:center;margin-bottom:24px;"><span style="font-family:Georgia,serif;font-size:26px;color:#18140F;">yadra!</span></div>'
    + '<div style="background:#fff;border-radius:14px;padding:28px;border:1px solid #E5E0D8;">'
    + '<h1 style="font-size:19px;color:#18140F;margin:0 0 14px;">' + title + '</h1>'
    + bodyHtml
    + '</div>'
    + '<p style="text-align:center;color:#8A8378;font-size:12px;margin-top:20px;">yadra! — marketplace immobilier en Algérie</p>'
    + '</div>';
}

function adminNotifyHtml(user) {
  return emailShell('Nouvelle inscription en attente', ''
    + '<p style="color:#4A443A;font-size:14px;line-height:1.6;">Une nouvelle inscription attend votre validation.</p>'
    + '<table style="width:100%;font-size:14px;color:#18140F;margin:16px 0;">'
    + '<tr><td style="padding:4px 0;color:#8A8378;">Nom</td><td style="padding:4px 0;">' + user.name + '</td></tr>'
    + '<tr><td style="padding:4px 0;color:#8A8378;">Email</td><td style="padding:4px 0;">' + user.email + '</td></tr>'
    + '<tr><td style="padding:4px 0;color:#8A8378;">Téléphone</td><td style="padding:4px 0;">' + (user.phone || '—') + '</td></tr>'
    + '<tr><td style="padding:4px 0;color:#8A8378;">Type de compte</td><td style="padding:4px 0;">' + (user.type === 'promoteur' ? 'Promoteur' + (user.company ? ' — ' + user.company : '') : 'Acquéreur') + '</td></tr>'
    + '</table>'
    + '<a href="https://yadra.fr/admin" style="display:inline-block;background:#A85E3E;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-size:14px;">Examiner dans l\'administration</a>');
}

function userApprovedHtml(user) {
  return emailShell('Votre compte yadra! est activé', ''
    + '<p style="color:#4A443A;font-size:14px;line-height:1.6;">Bonjour ' + user.name.split(' ')[0] + ',</p>'
    + '<p style="color:#4A443A;font-size:14px;line-height:1.6;">Votre compte ' + (user.type === 'promoteur' ? 'promoteur' : 'acquéreur') + ' a été validé. Vous pouvez dès maintenant vous connecter.</p>'
    + '<a href="https://yadra.fr/connexion" style="display:inline-block;background:#A85E3E;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-size:14px;">Se connecter</a>');
}

function userRejectedHtml(user) {
  return emailShell('Votre inscription yadra!', ''
    + '<p style="color:#4A443A;font-size:14px;line-height:1.6;">Bonjour ' + user.name.split(' ')[0] + ',</p>'
    + '<p style="color:#4A443A;font-size:14px;line-height:1.6;">Votre demande d\'inscription n\'a pas été retenue pour le moment. Pour toute question, vous pouvez nous contacter directement.</p>'
    + '<a href="https://wa.me/33670131501" style="display:inline-block;background:#25D366;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-size:14px;">Nous contacter sur WhatsApp</a>');
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
  shapePromoter,
  sendEmail,
  emailShell,
  adminNotifyHtml,
  userApprovedHtml,
  userRejectedHtml
};

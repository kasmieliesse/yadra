const { sql, bcrypt, getSessionUser, setSessionCookie, clearSessionCookie, readBody, isAdminEmail, uid, slugify } = require('./_lib');

module.exports = async function (req, res) {
  try {
    if (req.method === 'GET') {
      const session = getSessionUser(req);
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json({ user: session });
      return;
    }
    if (req.method !== 'POST') { res.status(405).json({ error: 'method not allowed' }); return; }

    const body = await readBody(req);
    const action = body.action;

    if (action === 'logout') {
      clearSessionCookie(res);
      res.status(200).json({ ok: true });
      return;
    }

    if (action === 'register') {
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      const name = String(body.name || '').trim();
      const phone = String(body.phone || '').trim();
      const type = body.type === 'promoteur' ? 'promoteur' : 'acquereur';
      if (!email || !password || !name) { res.status(400).json({ error: 'Champs requis manquants.' }); return; }
      const existing = await sql`SELECT id FROM users WHERE email = ${email}`;
      if (existing.length) { res.status(409).json({ error: 'Un compte existe déjà avec cet email.' }); return; }

      const passwordHash = await bcrypt.hash(password, 10);
      const userId = uid('user');
      let promoterId = null;

      if (type === 'promoteur') {
        const company = String(body.company || '').trim() || (name + ' Immobilier');
        promoterId = uid('pr');
        let slug = slugify(company);
        const slugClash = await sql`SELECT id FROM promoters WHERE slug = ${slug}`;
        if (slugClash.length) slug = slug + '-' + promoterId.slice(-4);
        await sql`INSERT INTO promoters (id, slug, name, wilaya, verified, founded, description)
          VALUES (${promoterId}, ${slug}, ${company}, 'alger', false, ${new Date().getFullYear()}, 'Nouveau promoteur inscrit sur yadra!.')`;
      }

      await sql`INSERT INTO users (id, email, password_hash, name, phone, type, promoter_id)
        VALUES (${userId}, ${email}, ${passwordHash}, ${name}, ${phone}, ${type}, ${promoterId})`;

      const session = { id: userId, email: email, name: name, phone: phone, type: type, promoterId: promoterId, isAdmin: isAdminEmail(email) };
      setSessionCookie(res, session);
      res.status(200).json({ user: session });
      return;
    }

    if (action === 'login') {
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      const rows = await sql`SELECT * FROM users WHERE email = ${email}`;
      const user = rows[0];
      if (!user) { res.status(401).json({ error: 'Email ou mot de passe incorrect.' }); return; }
      const ok = await bcrypt.compare(password, user.password_hash);
      if (!ok) { res.status(401).json({ error: 'Email ou mot de passe incorrect.' }); return; }
      const session = { id: user.id, email: user.email, name: user.name, phone: user.phone, type: user.type, promoterId: user.promoter_id, isAdmin: isAdminEmail(user.email) };
      setSessionCookie(res, session);
      res.status(200).json({ user: session });
      return;
    }

    res.status(400).json({ error: 'unknown action' });
  } catch (err) {
    res.status(500).json({ error: 'auth failed', detail: String(err && err.message || err) });
  }
};

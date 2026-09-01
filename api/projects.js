const { sql, shapeProject, shapePromoter, getSessionUser, readBody, uid, slugify } = require('./_lib');

async function promotersById() {
  const rows = await sql`SELECT id, slug, name, wilaya, verified, founded, description FROM promoters`;
  const map = {};
  rows.forEach(function (p) { map[p.id] = shapePromoter(p); });
  return map;
}

module.exports = async function (req, res) {
  try {
    const session = getSessionUser(req);

    if (req.method === 'GET') {
      const map = await promotersById();
      let rows;
      if (req.query.admin === '1') {
        if (!session || !session.isAdmin) { res.status(403).json({ error: 'interdit' }); return; }
        rows = await sql`SELECT * FROM projects ORDER BY created_at DESC`;
      } else if (req.query.mine === '1') {
        if (!session || session.type !== 'promoteur' || !session.promoterId) { res.status(403).json({ error: 'interdit' }); return; }
        rows = await sql`SELECT * FROM projects WHERE promoter_id = ${session.promoterId} ORDER BY created_at DESC`;
      } else {
        res.status(400).json({ error: 'paramètre mine ou admin requis' });
        return;
      }
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json({ projects: rows.map(function (r) { return shapeProject(r, map); }) });
      return;
    }

    if (req.method === 'POST') {
      if (!session || session.type !== 'promoteur' || !session.promoterId) { res.status(403).json({ error: 'interdit' }); return; }
      const body = await readBody(req);
      const status = body.status === 'attente' ? 'attente' : 'brouillon';
      const nom = String(body.nom || '').trim() || '(sans titre)';
      const id = body.id && String(body.id) || uid('proj');

      const existing = body.id ? await sql`SELECT id, promoter_id FROM projects WHERE id = ${id}` : [];
      if (existing.length && existing[0].promoter_id !== session.promoterId) { res.status(403).json({ error: 'interdit' }); return; }

      let slug = body.slug ? slugify(body.slug) : slugify(nom);
      if (!existing.length) {
        const clash = await sql`SELECT id FROM projects WHERE wilaya = ${body.wilaya} AND slug = ${slug}`;
        if (clash.length) slug = slug + '-' + id.slice(-4);
      }

      const typologies = JSON.stringify(Array.isArray(body.typologies) ? body.typologies : []);
      const prestations = JSON.stringify(Array.isArray(body.prestations) ? body.prestations : []);
      const pointsForts = JSON.stringify(Array.isArray(body.pointsForts) ? body.pointsForts : []);

      if (existing.length) {
        await sql`UPDATE projects SET
          slug=${slug}, nom=${nom}, wilaya=${body.wilaya}, commune=${body.commune}, quartier=${body.quartier},
          type=${body.type}, statut=${body.statut}, livraison=${body.livraison}, description=${body.description},
          typologies=${typologies}::jsonb, prestations=${prestations}::jsonb, points_forts=${pointsForts}::jsonb,
          status=${status}
          WHERE id=${id}`;
      } else {
        await sql`INSERT INTO projects (id, slug, nom, wilaya, commune, quartier, promoter_id, type, statut, livraison, description, typologies, prestations, points_forts, status)
          VALUES (${id}, ${slug}, ${nom}, ${body.wilaya}, ${body.commune}, ${body.quartier}, ${session.promoterId}, ${body.type}, ${body.statut}, ${body.livraison}, ${body.description}, ${typologies}::jsonb, ${prestations}::jsonb, ${pointsForts}::jsonb, ${status})`;
      }
      res.status(200).json({ ok: true, id: id });
      return;
    }

    if (req.method === 'PATCH') {
      if (!session) { res.status(401).json({ error: 'auth required' }); return; }
      const body = await readBody(req);
      const id = String(body.id || '');
      const status = String(body.status || '');
      if (!id || !status) { res.status(400).json({ error: 'id et status requis' }); return; }
      const rows = await sql`SELECT promoter_id, status FROM projects WHERE id = ${id}`;
      if (!rows.length) { res.status(404).json({ error: 'introuvable' }); return; }
      const owns = session.type === 'promoteur' && session.promoterId === rows[0].promoter_id;
      if (session.isAdmin) {
        await sql`UPDATE projects SET status = ${status} WHERE id = ${id}`;
      } else if (owns && (status === 'brouillon' || status === 'attente')) {
        await sql`UPDATE projects SET status = ${status} WHERE id = ${id}`;
      } else {
        res.status(403).json({ error: 'interdit' });
        return;
      }
      res.status(200).json({ ok: true });
      return;
    }

    if (req.method === 'DELETE') {
      if (!session) { res.status(401).json({ error: 'auth required' }); return; }
      const id = String(req.query.id || '');
      if (!id) { res.status(400).json({ error: 'id requis' }); return; }
      const rows = await sql`SELECT promoter_id, status FROM projects WHERE id = ${id}`;
      if (!rows.length) { res.status(404).json({ error: 'introuvable' }); return; }
      const owns = session.type === 'promoteur' && session.promoterId === rows[0].promoter_id;
      if (!session.isAdmin && !(owns && rows[0].status !== 'publie')) { res.status(403).json({ error: 'interdit' }); return; }
      await sql`DELETE FROM projects WHERE id = ${id}`;
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: 'method not allowed' });
  } catch (err) {
    res.status(500).json({ error: 'projects failed', detail: String(err && err.message || err) });
  }
};

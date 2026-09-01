const { sql, getSessionUser, readBody, uid } = require('./_lib');

function shapeLead(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    projectName: row.nom,
    promoterId: row.promoter_id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    message: row.message,
    status: row.status,
    date: row.created_at
  };
}

module.exports = async function (req, res) {
  try {
    if (req.method === 'POST') {
      const body = await readBody(req);
      const projectId = String(body.projectId || '');
      const name = String(body.name || '').trim();
      if (!projectId || !name) { res.status(400).json({ error: 'Champs requis manquants.' }); return; }
      const session = getSessionUser(req);
      const id = uid('lead');
      await sql`INSERT INTO leads (id, project_id, user_id, name, phone, email, message)
        VALUES (${id}, ${projectId}, ${session ? session.id : null}, ${name}, ${body.phone || null}, ${body.email || null}, ${body.message || null})`;
      res.status(201).json({ ok: true, id: id });
      return;
    }

    if (req.method === 'GET') {
      const session = getSessionUser(req);
      if (!session) { res.status(401).json({ error: 'auth required' }); return; }
      let rows;
      if (session.isAdmin) {
        rows = await sql`SELECT leads.*, projects.nom, projects.promoter_id FROM leads
          JOIN projects ON projects.id = leads.project_id ORDER BY leads.created_at DESC`;
      } else if (session.type === 'promoteur' && session.promoterId) {
        rows = await sql`SELECT leads.*, projects.nom, projects.promoter_id FROM leads
          JOIN projects ON projects.id = leads.project_id
          WHERE projects.promoter_id = ${session.promoterId} ORDER BY leads.created_at DESC`;
      } else {
        rows = await sql`SELECT leads.*, projects.nom, projects.promoter_id FROM leads
          JOIN projects ON projects.id = leads.project_id
          WHERE leads.user_id = ${session.id} ORDER BY leads.created_at DESC`;
      }
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json({ leads: rows.map(shapeLead) });
      return;
    }

    if (req.method === 'PATCH') {
      const session = getSessionUser(req);
      if (!session) { res.status(401).json({ error: 'auth required' }); return; }
      const body = await readBody(req);
      const id = String(body.id || '');
      const status = String(body.status || '');
      if (!id || !status) { res.status(400).json({ error: 'id et status requis' }); return; }
      const owner = await sql`SELECT projects.promoter_id FROM leads JOIN projects ON projects.id = leads.project_id WHERE leads.id = ${id}`;
      if (!owner.length) { res.status(404).json({ error: 'introuvable' }); return; }
      const allowed = session.isAdmin || (session.type === 'promoteur' && session.promoterId === owner[0].promoter_id);
      if (!allowed) { res.status(403).json({ error: 'interdit' }); return; }
      await sql`UPDATE leads SET status = ${status} WHERE id = ${id}`;
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: 'method not allowed' });
  } catch (err) {
    res.status(500).json({ error: 'leads failed', detail: String(err && err.message || err) });
  }
};

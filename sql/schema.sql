-- yadra! schema

CREATE TABLE IF NOT EXISTS promoters (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  wilaya TEXT NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT false,
  founded INT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  type TEXT NOT NULL DEFAULT 'acquereur', -- acquereur | promoteur | admin
  promoter_id TEXT REFERENCES promoters(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  nom TEXT NOT NULL,
  wilaya TEXT NOT NULL,
  commune TEXT,
  quartier TEXT,
  promoter_id TEXT REFERENCES promoters(id),
  type TEXT,
  statut TEXT,
  livraison TEXT,
  description TEXT,
  photo TEXT,
  gallery JSONB NOT NULL DEFAULT '[]',
  typologies JSONB NOT NULL DEFAULT '[]',
  prestations JSONB NOT NULL DEFAULT '[]',
  points_forts JSONB NOT NULL DEFAULT '[]',
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  featured BOOLEAN NOT NULL DEFAULT false,
  badge TEXT,
  status TEXT NOT NULL DEFAULT 'publie', -- brouillon | attente | publie | refuse
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(wilaya, slug)
);

CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'Nouveau',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS favorites (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_projects_promoter ON projects(promoter_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_leads_project ON leads(project_id);
CREATE INDEX IF NOT EXISTS idx_leads_user ON leads(user_id);

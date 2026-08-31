-- yadra! — schéma Postgres (Neon)
-- À exécuter une fois dans l'éditeur SQL de Neon (ou via `psql "$DATABASE_URL" -f db/schema.sql`)

create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  email text not null unique,
  password_hash text not null,
  email_verified boolean not null default false,
  verify_token text,
  verify_token_expires timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_users_email on users (lower(email));
create index if not exists idx_users_verify_token on users (verify_token);

-- Toutes les demandes entrantes : intérêt projet, contact général, candidature promoteur.
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('project_inquiry','general_contact','promoter_application')),
  project_id text,
  project_name text,
  name text not null,
  email text,
  phone text,
  message text,
  status text not null default 'nouveau' check (status in ('nouveau','contacte','traite','archive')),
  created_at timestamptz not null default now()
);

create index if not exists idx_leads_created on leads (created_at desc);
create index if not exists idx_leads_type on leads (type);

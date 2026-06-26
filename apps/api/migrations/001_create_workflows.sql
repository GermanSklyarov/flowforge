create extension if not exists pgcrypto;

create table if not exists workflows (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'draft',
  version integer not null default 1,
  definition jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workflows_status_check check (status in ('draft', 'active', 'archived')),
  constraint workflows_version_check check (version > 0)
);

create index if not exists workflows_status_idx on workflows (status);
create index if not exists workflows_updated_at_idx on workflows (updated_at desc);


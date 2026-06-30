create table if not exists workflow_executions (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references workflows (id) on delete cascade,
  status text not null,
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  error text,
  queued_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workflow_executions_status_check check (
    status in ('queued', 'running', 'succeeded', 'failed', 'canceled')
  )
);

create index if not exists workflow_executions_workflow_id_idx
  on workflow_executions (workflow_id, created_at desc);

create table if not exists workflow_node_executions (
  id uuid primary key default gen_random_uuid(),
  execution_id uuid not null references workflow_executions (id) on delete cascade,
  node_id text not null,
  node_type text not null,
  status text not null,
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  error text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workflow_node_executions_status_check check (
    status in ('queued', 'running', 'succeeded', 'failed', 'skipped')
  )
);

create index if not exists workflow_node_executions_execution_id_idx
  on workflow_node_executions (execution_id, created_at asc);

create table projects (
  id uuid primary key,
  name text not null,
  api_key_hash text not null unique,
  created_at timestamptz not null default now()
);

create table model_pricing (
  model text primary key,
  input_per_mtok numeric not null,
  output_per_mtok numeric not null
);

create table traces (
  id uuid primary key,
  project_id uuid not null references projects (id) on delete cascade,
  name text not null,
  status text not null check (status in ('running', 'success', 'error')),
  input jsonb,
  output jsonb,
  metadata jsonb not null default '{}',
  step_count int not null default 0,
  total_tokens int not null default 0,
  total_cost numeric(12, 6) not null default 0,
  latency_ms int,
  parent_trace_id uuid references traces (id) on delete set null,
  forked_from_step_index int,
  provider text not null check (provider in ('simulated', 'live', 'sdk')),
  created_at timestamptz not null,
  ended_at timestamptz
);
create index traces_project_created on traces (project_id, created_at desc);
create index traces_parent on traces (parent_trace_id);

create table steps (
  id uuid primary key,
  trace_id uuid not null references traces (id) on delete cascade,
  parent_step_id uuid,
  idx int not null,
  type text not null check (type in ('llm', 'tool', 'span')),
  name text not null,
  input jsonb,
  output jsonb,
  model text,
  prompt_tokens int not null default 0,
  completion_tokens int not null default 0,
  cost numeric(12, 6) not null default 0,
  started_at timestamptz not null,
  ended_at timestamptz,
  error text,
  metadata jsonb not null default '{}',
  unique (trace_id, idx)
);

create table usage_daily (
  day date primary key,
  live_cost numeric(12, 6) not null default 0,
  live_runs int not null default 0
);

create table rate_limits (
  ip_hash text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (ip_hash, window_start)
);

-- Server-only access with the service role; no policies means anon/authenticated see nothing.
alter table projects enable row level security;
alter table model_pricing enable row level security;
alter table traces enable row level security;
alter table steps enable row level security;
alter table usage_daily enable row level security;
alter table rate_limits enable row level security;

create function hit_rate_limit(p_ip_hash text, p_window timestamptz, p_max int)
returns boolean language sql set search_path = public as $$
  insert into rate_limits as r (ip_hash, window_start, count)
  values (p_ip_hash, p_window, 1)
  on conflict (ip_hash, window_start) do update set count = r.count + 1
  returning count <= p_max;
$$;

create function add_live_usage(p_day date, p_cost numeric)
returns void language sql set search_path = public as $$
  insert into usage_daily as u (day, live_cost, live_runs)
  values (p_day, p_cost, 1)
  on conflict (day) do update set live_cost = u.live_cost + excluded.live_cost, live_runs = u.live_runs + 1;
$$;

revoke execute on function hit_rate_limit(text, timestamptz, int) from public, anon, authenticated;
revoke execute on function add_live_usage(date, numeric) from public, anon, authenticated;

insert into model_pricing (model, input_per_mtok, output_per_mtok) values
  ('sim-1', 1, 5),
  ('claude-haiku-4-5', 1, 5),
  ('claude-haiku-4-5-20251001', 1, 5),
  ('gpt-4o-mini', 0.15, 0.6);

insert into projects (id, name, api_key_hash) values
  ('00000000-0000-4000-8000-000000000001', 'Demo project', encode(sha256('rt_demo_public_9f4c2a7e'::bytea), 'hex'));

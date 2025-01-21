-- Create hook type enum
create type hook_type as enum ('email', 'notification', 'webhook');

-- Workflows table
create table workflows (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  created_by uuid references profiles(id) not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  is_active boolean default true
);

-- Workflow steps table
create table workflow_steps (
  id uuid primary key default uuid_generate_v4(),
  workflow_id uuid references workflows(id) on delete cascade not null,
  step_order integer not null,
  description text not null,
  is_fixed boolean default false,
  created_at timestamptz default now()
);

-- Step hooks table
create table step_hooks (
  id uuid primary key default uuid_generate_v4(),
  step_id uuid references workflow_steps(id) on delete cascade not null,
  hook_type hook_type not null,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

-- Indexes
create index workflow_steps_workflow_id_idx on workflow_steps(workflow_id);
create index workflow_steps_order_idx on workflow_steps(workflow_id, step_order);
create index step_hooks_step_id_idx on step_hooks(step_id);

-- Enable RLS
alter table workflows enable row level security;
alter table workflow_steps enable row level security;
alter table step_hooks enable row level security;

-- RLS policies
create policy "users can view workflows"
  on workflows for select
  to authenticated
  using (true);

create policy "users can create workflows"
  on workflows for insert
  to authenticated
  with check (created_by = auth.uid());

create policy "users can view workflow steps"
  on workflow_steps for select
  to authenticated
  using (true);

create policy "users can view step hooks"
  on step_hooks for select
  to authenticated
  using (true); 
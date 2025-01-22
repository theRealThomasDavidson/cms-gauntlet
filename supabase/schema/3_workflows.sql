-- Drop existing objects if they exist
drop table if exists workflow_stage_hooks cascade;
drop table if exists workflow_stages cascade;
drop table if exists workflows cascade;
drop type if exists hook_type cascade;

-- Create hook type enum
create type hook_type as enum ('email', 'notification', 'webhook', 'assignment');

-- Create workflows table
create table workflows (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  org_id uuid references organizations(id) not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  is_active boolean default true
);

-- Create workflow stages table (doubly-linked list)
create table workflow_stages (
  id uuid primary key default uuid_generate_v4(),
  workflow_id uuid references workflows(id) on delete cascade not null,
  name text not null,
  description text,
  next_stage_id uuid references workflow_stages(id),
  prev_stage_id uuid references workflow_stages(id),
  is_start boolean default false,
  is_end boolean default false,
  is_other boolean default false,
  created_at timestamptz default now(),
  -- Prevent circular references
  constraint no_self_reference check (id != next_stage_id and id != prev_stage_id),
  -- Add unique constraint for composite foreign key
  unique (workflow_id, id)
);

-- Create workflow stage hooks table
create table workflow_stage_hooks (
  id uuid primary key default uuid_generate_v4(),
  stage_id uuid references workflow_stages(id) on delete cascade not null,
  hook_type hook_type not null,
  config jsonb not null default '{}'::jsonb,
  is_active boolean default true,
  created_at timestamptz default now(),
  -- Add hook configuration validation
  constraint valid_hook_config check (
    hook_type != 'notification' or (
      config ? 'target_type' and
      config->>'target_type' in ('specific_user', 'role', 'ticket_creator', 'org_admins') and
      (
        (config->>'target_type' = 'specific_user' and config ? 'target_user_id') or
        (config->>'target_type' = 'role' and config ? 'target_role') or
        config->>'target_type' in ('ticket_creator', 'org_admins')
      ) and
      config ? 'message'
    )
  )
);

-- Create unique partial indexes for workflow stage constraints
create unique index unique_start_per_workflow 
  on workflow_stages (workflow_id) 
  where is_start = true;

create unique index unique_end_per_workflow 
  on workflow_stages (workflow_id) 
  where is_end = true;

create unique index unique_other_per_workflow 
  on workflow_stages (workflow_id) 
  where is_other = true;

-- Create indexes
create index workflow_org_idx on workflows(org_id);
create index workflow_stages_workflow_idx on workflow_stages(workflow_id);
create index workflow_stages_next_idx on workflow_stages(next_stage_id);
create index workflow_stages_prev_idx on workflow_stages(prev_stage_id);
create index workflow_stage_hooks_stage_idx on workflow_stage_hooks(stage_id);

-- Enable RLS
alter table workflows enable row level security;
alter table workflow_stages enable row level security;
alter table workflow_stage_hooks enable row level security;

-- RLS Policies for workflows
create policy "org members can view workflows"
  on workflows for select
  to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.auth_id = auth.uid()
      and p.org_id = workflows.org_id
      and p.role in ('admin', 'agent', 'customer')
    )
  );

create policy "admins and agents can create workflows"
  on workflows for insert
  to authenticated
  with check (
    exists (
      select 1 from profiles p
      where p.auth_id = auth.uid()
      and p.org_id = workflows.org_id
      and p.role in ('admin', 'agent')
    )
  );

create policy "admins and agents can update workflows"
  on workflows for update
  to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.auth_id = auth.uid()
      and p.org_id = workflows.org_id
      and p.role in ('admin', 'agent')
    )
  );

-- RLS Policies for workflow stages
create policy "org members can view workflow stages"
  on workflow_stages for select
  to authenticated
  using (
    exists (
      select 1 from workflows w
      join profiles p on p.org_id = w.org_id
      where p.auth_id = auth.uid()
      and w.id = workflow_stages.workflow_id
      and p.role in ('admin', 'agent', 'customer')
    )
  );

create policy "admins and agents can manage workflow stages"
  on workflow_stages for all
  to authenticated
  using (
    exists (
      select 1 from workflows w
      join profiles p on p.org_id = w.org_id
      where p.auth_id = auth.uid()
      and w.id = workflow_stages.workflow_id
      and p.role in ('admin', 'agent')
    )
  );

-- RLS Policies for hooks
create policy "org members can view stage hooks"
  on workflow_stage_hooks for select
  to authenticated
  using (
    exists (
      select 1 from workflow_stages ws
      join workflows w on w.id = ws.workflow_id
      join profiles p on p.org_id = w.org_id
      where p.auth_id = auth.uid()
      and ws.id = workflow_stage_hooks.stage_id
      and p.role in ('admin', 'agent', 'customer')
    )
  );

create policy "admins and agents can manage stage hooks"
  on workflow_stage_hooks for all
  to authenticated
  using (
    exists (
      select 1 from workflow_stages ws
      join workflows w on w.id = ws.workflow_id
      join profiles p on p.org_id = w.org_id
      where p.auth_id = auth.uid()
      and ws.id = workflow_stage_hooks.stage_id
      and p.role in ('admin', 'agent')
    )
  );

-- Function to get workflow stages without recursion
create or replace function get_workflow_stages(workflow_uuid uuid)
returns jsonb as $$
declare
  result jsonb;
begin
  with recursive stage_chain as (
    -- Start with the first stage
    select 
      id,
      workflow_id,
      name,
      description,
      next_stage_id,
      prev_stage_id,
      is_start,
      is_end,
      is_other,
      created_at,
      1 as level
    from workflow_stages
    where workflow_id = workflow_uuid
    and is_start = true
    
    union all
    
    -- Get subsequent stages
    select 
      ws.id,
      ws.workflow_id,
      ws.name,
      ws.description,
      ws.next_stage_id,
      ws.prev_stage_id,
      ws.is_start,
      ws.is_end,
      ws.is_other,
      ws.created_at,
      sc.level + 1
    from workflow_stages ws
    join stage_chain sc on ws.id = sc.next_stage_id
    where level < 100  -- Prevent infinite recursion
  )
  select jsonb_agg(
    jsonb_build_object(
      'id', id,
      'name', name,
      'description', description,
      'is_start', is_start,
      'is_end', is_end,
      'is_other', is_other,
      'created_at', created_at,
      'level', level
    )
    order by level
  )
  into result
  from stage_chain;
  
  return result;
end;
$$ language plpgsql security definer;

-- Function to get stage hooks
create or replace function get_stage_hooks(stage_uuid uuid)
returns jsonb as $$
declare
  result jsonb;
begin
  select jsonb_agg(
    jsonb_build_object(
      'id', h.id,
      'hook_type', h.hook_type,
      'config', h.config,
      'is_active', h.is_active,
      'created_at', h.created_at
    )
  )
  into result
  from workflow_stage_hooks h
  where h.stage_id = stage_uuid
  and h.is_active = true;
  
  return result;
end;
$$ language plpgsql security definer;

-- Function to get default workflow
create or replace function get_default_workflow(org_uuid uuid)
returns uuid as $$
declare
  workflow_id uuid;
begin
  select id into workflow_id
  from workflows
  where org_id = org_uuid
  and is_active = true
  order by created_at asc
  limit 1;
  
  return workflow_id;
end;
$$ language plpgsql security definer;

-- Function to send workflow notifications
create or replace function send_workflow_notification(
  p_hook_id uuid,
  p_ticket_id uuid,
  p_user_id uuid
)
returns void as $$
declare
  v_hook workflow_stage_hooks;
  v_stage workflow_stages;
  v_workflow workflows;
  v_ticket tickets;
  v_notification_text text;
  v_target_users uuid[];
begin
  -- Get hook details
  select * into v_hook
  from workflow_stage_hooks
  where id = p_hook_id;

  -- Get stage and workflow details
  select s.*, w.* into v_stage, v_workflow
  from workflow_stages s
  join workflows w on w.id = s.workflow_id
  where s.id = v_hook.stage_id;

  -- Get ticket details
  select * into v_ticket
  from tickets
  where id = p_ticket_id;

  -- Replace placeholders in message
  v_notification_text := replace(v_hook.config->>'message', '{ticket_id}', p_ticket_id::text);
  v_notification_text := replace(v_notification_text, '{ticket_title}', v_ticket.title);
  v_notification_text := replace(v_notification_text, '{stage_name}', v_stage.name);

  -- Determine target users based on notification type
  case v_hook.config->>'target_type'
    when 'specific_user' then
      v_target_users := array[(v_hook.config->>'target_user_id')::uuid];
    when 'role' then
      select array_agg(id) into v_target_users
      from profiles
      where role = (v_hook.config->>'target_role')::user_role
      and org_id = v_workflow.org_id;
    when 'ticket_creator' then
      v_target_users := array[v_ticket.created_by];
    when 'org_admins' then
      select array_agg(id) into v_target_users
      from profiles
      where role = 'admin'
      and org_id = v_workflow.org_id;
  end case;

  -- Insert notifications for each target user
  insert into notifications (user_id, message, ticket_id)
  select unnest(v_target_users), v_notification_text, p_ticket_id;
end;
$$ language plpgsql security definer;

-- Grant execute permissions
grant execute on function get_workflow_stages(uuid) to authenticated;
grant execute on function get_stage_hooks(uuid) to authenticated;
grant execute on function get_default_workflow(uuid) to authenticated;
grant execute on function send_workflow_notification(uuid, uuid, uuid) to authenticated; 
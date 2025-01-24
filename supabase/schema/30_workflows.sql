-- Drop existing objects if they exist
drop table if exists workflow_stage_hooks cascade;
drop table if exists workflow_stages cascade;
drop table if exists workflows cascade;
drop type if exists hook_type cascade;

-- Create hook type enum
create type hook_type as enum ('webhook', 'notification');

-- Create workflows table
create table workflows (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  org_id uuid references organizations(id) not null,
  created_by uuid references profiles(id),
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
drop table if exists webhook_configs cascade;
-- Create webhook config table
create table webhook_configs (
  id uuid primary key default uuid_generate_v4(),
  stage_id uuid references workflow_stages(id) on delete cascade not null,
  name text not null,
  url text not null,
  method text not null default 'POST',
  headers jsonb default '{}'::jsonb,
  template jsonb not null default '{}'::jsonb,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  -- Basic validation
  constraint valid_method check (method in ('GET', 'POST', 'PUT', 'PATCH'))
);
drop table if exists webhook_logs;
-- Create webhook logs table
create table webhook_logs (
  id uuid primary key default uuid_generate_v4(),
  webhook_id uuid references webhook_configs(id) on delete set null,
  ticket_id uuid not null,
  status_code int,
  response_body text,
  error_message text,
  duration_ms int,
  created_at timestamptz default now()
);

-- Create indexes
create index webhook_configs_stage_idx on webhook_configs(stage_id);
create index webhook_logs_webhook_idx on webhook_logs(webhook_id);
create index webhook_logs_ticket_idx on webhook_logs(ticket_id);
create index webhook_logs_created_idx on webhook_logs(created_at);

-- Enable RLS
alter table webhook_configs enable row level security;
alter table webhook_logs enable row level security;

-- RLS Policies for webhook configs
create policy "org members can view webhook configs"
  on webhook_configs for select
  to authenticated
  using (
    exists (
      select 1 from workflow_stages ws
      join workflows w on w.id = ws.workflow_id
      join profiles p on p.org_id = w.org_id
      where p.auth_id = auth.uid()
      and ws.id = webhook_configs.stage_id
    )
  );

create policy "admins can manage webhook configs"
  on webhook_configs for all
  to authenticated
  using (
    exists (
      select 1 from workflow_stages ws
      join workflows w on w.id = ws.workflow_id
      join profiles p on p.org_id = w.org_id
      where p.auth_id = auth.uid()
      and ws.id = webhook_configs.stage_id
      and p.role = 'admin'
    )
  );

-- RLS Policies for webhook logs
create policy "org members can view webhook logs"
  on webhook_logs for select
  to authenticated
  using (
    exists (
      select 1 from webhook_configs wc
      join workflow_stages ws on ws.id = wc.stage_id
      join workflows w on w.id = ws.workflow_id
      join profiles p on p.org_id = w.org_id
      where p.auth_id = auth.uid()
      and wc.id = webhook_logs.webhook_id
    )
  );

-- Function to get workflow stages
drop function if exists get_workflow_stages;
create or replace function get_workflow_stages(workflow_uuid uuid)
returns table (
  id uuid,
  name text,
  description text,
  is_start boolean,
  is_end boolean,
  next_stage_id uuid,
  prev_stage_id uuid,
  created_at timestamptz
) security definer
as $$
begin
  return query
  select 
    ws.id, ws.name, ws.description, ws.is_start, ws.is_end,
    ws.next_stage_id, ws.prev_stage_id, ws.created_at
  from workflow_stages ws
  join workflows w on w.id = ws.workflow_id
  where ws.workflow_id = workflow_uuid
  and exists (
    select 1 from profiles p 
    where p.auth_id = auth.uid()
    and p.org_id = w.org_id
  )
  order by 
    case when ws.is_start then 0 else 1 end,
    ws.created_at;
end;
$$ language plpgsql;

-- Grant execute permission to authenticated users
grant execute on function get_workflow_stages(uuid) to authenticated;

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

-- Function to get webhook configs for a stage
create or replace function get_stage_webhooks(stage_uuid uuid)
returns jsonb as $$
declare
  result jsonb;
  v_workflow_id uuid;
begin
  select jsonb_agg(
    jsonb_build_object(
      'id', wc.id,
      'stage_id', wc.stage_id,
      'hook_type', wc.hook_type,
      'config', wc.config,
      'is_active', wc.is_active,
      'created_at', wc.created_at
    )
  )
  into result
  from workflow_stage_hooks wc
  where wc.stage_id = stage_uuid;
  
  -- Return empty array instead of null if no webhooks found
  return coalesce(result, '[]'::jsonb);
end;
$$ language plpgsql security definer;

-- Create RPC function to get active workflows
create or replace function get_active_workflows()
returns setof workflows
language sql
security definer
as $$
  select *
  from workflows
  where is_active = true
  order by created_at desc;
$$;

-- Grant execute permission to authenticated users
grant execute on function get_active_workflows() to authenticated;

-- Grant execute permissions
grant execute on function get_workflow_stages(uuid) to authenticated;
grant execute on function get_stage_hooks(uuid) to authenticated;
grant execute on function get_default_workflow(uuid) to authenticated;
grant execute on function get_stage_webhooks(uuid) to authenticated;

-- Function to create a workflow
create or replace function create_workflow(
  p_name text,
  p_description text,
  p_auth_id uuid
)
returns workflows
language plpgsql
security definer
as $$
declare
  v_workflow workflows;
  v_org_id uuid;
begin
  -- Get org_id from profiles
  select org_id into v_org_id
  from profiles
  where auth_id = p_auth_id;

  if v_org_id is null then
    raise exception 'User not associated with an organization';
  end if;

  insert into workflows (name, description, org_id, is_active)
  values (p_name, p_description, v_org_id, true)
  returning * into v_workflow;
  
  return v_workflow;
end;
$$;

-- Grant execute permission to authenticated users
grant execute on function create_workflow(text, text, uuid) to authenticated;

-- Function to get user profile
create or replace function get_user_profile(p_auth_id uuid)
returns table (
  id uuid,
  org_id uuid
)
language plpgsql
security definer
as $$
begin
  return query
  select profiles.id, profiles.org_id
  from profiles
  where auth_id = p_auth_id;
end;
$$;

-- Grant execute permission to authenticated users
grant execute on function get_user_profile(uuid) to authenticated;

-- Function to create a workflow stage
create or replace function create_workflow_stage(
  p_workflow_id uuid,
  p_name text,
  p_description text,
  p_is_start boolean default false,
  p_is_end boolean default false,
  p_is_other boolean default false
) returns workflow_stages as $$
declare
  v_stage workflow_stages;
begin
  -- Check if user has permission to create stages for this workflow
  if not exists (
    select 1 from workflows w
    join profiles p on p.org_id = w.org_id
    where p.auth_id = auth.uid()
    and w.id = p_workflow_id
    and p.role in ('admin', 'agent')
  ) then
    raise exception 'Permission denied';
  end if;

  -- Create the stage
  insert into workflow_stages (
    workflow_id,
    name,
    description,
    is_start,
    is_end,
    is_other
  ) values (
    p_workflow_id,
    p_name,
    p_description,
    p_is_start,
    p_is_end,
    p_is_other
  )
  returning * into v_stage;

  return v_stage;
end;
$$ language plpgsql security definer;

-- Grant execute permission to authenticated users
grant execute on function create_workflow_stage(uuid, text, text, boolean, boolean, boolean) to authenticated;

-- Workflow CRUD Functions
create or replace function update_workflow(
  p_id uuid,
  p_name text,
  p_description text,
  p_is_active boolean
) returns workflows as $$
declare
  v_workflow workflows;
begin
  -- Check if user has permission to update this workflow
  if not exists (
    select 1 from workflows w
    join profiles p on p.org_id = w.org_id
    where p.auth_id = auth.uid()
    and w.id = p_id
    and p.role in ('admin', 'agent')
  ) then
    raise exception 'Permission denied';
  end if;

  update workflows
  set 
    name = p_name,
    description = p_description,
    is_active = p_is_active,
    updated_at = now()
  where id = p_id
  returning * into v_workflow;
  
  return v_workflow;
end;
$$ language plpgsql security definer;

create or replace function delete_workflow(
  p_id uuid
) returns void as $$
begin
  delete from workflows where id = p_id;
end;
$$ language plpgsql security definer;

-- Workflow Stage CRUD Functions
create or replace function update_workflow_stage(
  p_id uuid,
  p_name text,
  p_description text,
  p_is_start boolean,
  p_is_end boolean,
  p_is_other boolean,
  p_next_stage_id uuid,
  p_prev_stage_id uuid,
  p_org_id uuid,
  p_role text
) returns workflow_stages as $$
declare
  v_stage workflow_stages;
  v_workflow_org_id uuid;
begin
  -- Get the workflow's org_id
  select w.org_id into v_workflow_org_id
  from workflow_stages ws
  join workflows w on w.id = ws.workflow_id
  where ws.id = p_id;

  -- Check if user has permission (belongs to same org and has correct role)
  if v_workflow_org_id != p_org_id or p_role not in ('admin', 'agent') then
    raise exception 'Permission denied';
  end if;

  update workflow_stages
  set 
    name = p_name,
    description = p_description,
    is_start = p_is_start,
    is_end = p_is_end,
    is_other = p_is_other,
    next_stage_id = p_next_stage_id,
    prev_stage_id = p_prev_stage_id
  where id = p_id
  returning * into v_stage;
  
  return v_stage;
end;
$$ language plpgsql security definer;

-- Function to delete a stage and update surrounding links
create or replace function delete_workflow_stage(
  p_stage_id uuid,
  p_org_id uuid,
  p_role text
) returns void as $$
declare
  v_workflow_org_id uuid;
  v_workflow_id uuid;
  v_prev_stage_id uuid;
  v_next_stage_id uuid;
  v_is_start boolean;
  v_next_is_end boolean;
begin
  -- Get the workflow's org_id and surrounding stage IDs
  select w.org_id, w.id, ws.prev_stage_id, ws.next_stage_id, ws.is_start
  into v_workflow_org_id, v_workflow_id, v_prev_stage_id, v_next_stage_id, v_is_start
  from workflow_stages ws
  join workflows w on w.id = ws.workflow_id
  where ws.id = p_stage_id;

  -- Check if user has permission (belongs to same org and has correct role)
  if v_workflow_org_id != p_org_id or p_role not in ('admin', 'agent') then
    raise exception 'Permission denied';
  end if;

  -- If this is the start stage, make the next stage the start stage
  if v_is_start and v_next_stage_id is not null then
    update workflow_stages
    set 
      is_start = true,
      prev_stage_id = null
    where id = v_next_stage_id;
  end if;

  -- Update the links between surrounding stages
  if v_prev_stage_id is not null then
    update workflow_stages
    set next_stage_id = v_next_stage_id
    where id = v_prev_stage_id;
  end if;

  if v_next_stage_id is not null then
    update workflow_stages
    set prev_stage_id = v_prev_stage_id
    where id = v_next_stage_id;
  end if;

  -- Delete the stage
  delete from workflow_stages where id = p_stage_id;

  -- If this was the last stage, create a default "New Ticket" stage
  if not exists (select 1 from workflow_stages where workflow_id = v_workflow_id) then
    insert into workflow_stages (
      workflow_id,
      name,
      description,
      is_start,
      is_end,
      is_other,
      next_stage_id,
      prev_stage_id
    ) values (
      v_workflow_id,
      'New Ticket',
      'Initial stage when a ticket is created',
      true,
      true,
      false,
      null,
      null
    );
  end if;
end;
$$ language plpgsql security definer;

-- Function to move a stage up or down
create or replace function move_workflow_stage(
  p_stage_id uuid,
  p_direction int, -- -1 for up, 1 for down
  p_org_id uuid,
  p_role text
) returns void as $$
declare
  v_workflow_org_id uuid;
  v_current workflow_stages;
  v_other workflow_stages;
  v_temp_next_id uuid;
  v_temp_prev_id uuid;
begin
  -- Get the workflow's org_id and stage details
  select w.org_id into v_workflow_org_id
  from workflow_stages ws
  join workflows w on w.id = ws.workflow_id
  where ws.id = p_stage_id;

  -- Check if user has permission
  if v_workflow_org_id != p_org_id or p_role not in ('admin', 'agent') then
    raise exception 'Permission denied';
  end if;

  -- Get current stage
  select * into v_current
  from workflow_stages
  where id = p_stage_id;

  -- Get the stage we're swapping with
  if p_direction = -1 then
    select * into v_other
    from workflow_stages
    where id = v_current.prev_stage_id;
  else
    select * into v_other
    from workflow_stages
    where id = v_current.next_stage_id;
  end if;

  -- If no stage to swap with, do nothing
  if v_other is null then
    return;
  end if;

  -- Store temporary values
  v_temp_next_id := v_current.next_stage_id;
  v_temp_prev_id := v_current.prev_stage_id;

  -- First clear all links for both stages
  update workflow_stages
  set next_stage_id = null,
      prev_stage_id = null
  where id in (v_current.id, v_other.id);

  -- Then set the new links one at a time
  if p_direction = -1 then
    -- Moving up
    update workflow_stages
    set prev_stage_id = v_other.prev_stage_id,
        next_stage_id = v_other.id
    where id = v_current.id;

    update workflow_stages
    set prev_stage_id = v_current.id,
        next_stage_id = v_temp_next_id
    where id = v_other.id;

    -- Update surrounding stages if they exist
    if v_other.prev_stage_id is not null then
      update workflow_stages
      set next_stage_id = v_current.id
      where id = v_other.prev_stage_id;
    end if;

    if v_temp_next_id is not null then
      update workflow_stages
      set prev_stage_id = v_other.id
      where id = v_temp_next_id;
    end if;
  else
    -- Moving down
    update workflow_stages
    set prev_stage_id = v_other.id,
        next_stage_id = v_other.next_stage_id
    where id = v_current.id;

    update workflow_stages
    set prev_stage_id = v_temp_prev_id,
        next_stage_id = v_current.id
    where id = v_other.id;

    -- Update surrounding stages if they exist
    if v_temp_prev_id is not null then
      update workflow_stages
      set next_stage_id = v_other.id
      where id = v_temp_prev_id;
    end if;

    if v_other.next_stage_id is not null then
      update workflow_stages
      set prev_stage_id = v_current.id
      where id = v_other.next_stage_id;
    end if;
  end if;

  -- Handle start/end flags
  update workflow_stages
  set 
    is_start = case
      when id = v_current.id then v_other.is_start
      when id = v_other.id then v_current.is_start
      else is_start
    end,
    is_end = case
      when id = v_current.id then v_other.is_end
      when id = v_other.id then v_current.is_end
      else is_end
    end
  where id in (v_current.id, v_other.id);
end;
$$ language plpgsql security definer;

-- Grant execute permissions
grant execute on function delete_workflow_stage(uuid, uuid, text) to authenticated;
grant execute on function move_workflow_stage(uuid, int, uuid, text) to authenticated;

-- Workflow Stage Hook CRUD Functions
create or replace function create_workflow_stage_hook(
  p_stage_id uuid,
  p_hook_type hook_type,
  p_config jsonb,
  p_is_active boolean default true
) returns workflow_stage_hooks as $$
declare
  v_hook workflow_stage_hooks;
begin
  insert into workflow_stage_hooks (
    stage_id,
    hook_type,
    config,
    is_active
  ) values (
    p_stage_id,
    p_hook_type,
    p_config,
    p_is_active
  )
  returning * into v_hook;
  
  return v_hook;
end;
$$ language plpgsql security definer;

create or replace function update_workflow_stage_hook(
  p_id uuid,
  p_hook_type hook_type,
  p_config jsonb,
  p_is_active boolean
) returns workflow_stage_hooks as $$
declare
  v_hook workflow_stage_hooks;
begin
  update workflow_stage_hooks
  set 
    hook_type = p_hook_type,
    config = p_config,
    is_active = p_is_active
  where id = p_id
  returning * into v_hook;
  
  return v_hook;
end;
$$ language plpgsql security definer;

create or replace function delete_workflow_stage_hook(
  p_id uuid
) returns void as $$
begin
  delete from workflow_stage_hooks where id = p_id;
end;
$$ language plpgsql security definer;

-- Grant execute permissions for all new functions
grant execute on function update_workflow(uuid, text, text, boolean) to authenticated;
grant execute on function delete_workflow(uuid) to authenticated;
grant execute on function update_workflow_stage(uuid, text, text, boolean, boolean, boolean, uuid, uuid, uuid, text) to authenticated;
grant execute on function create_workflow_stage_hook(uuid, hook_type, jsonb, boolean) to authenticated;
grant execute on function update_workflow_stage_hook(uuid, hook_type, jsonb, boolean) to authenticated;
grant execute on function delete_workflow_stage_hook(uuid) to authenticated;

-- Function to update workflow stage links
create or replace function update_workflow_stage_links(
  p_stage_id uuid,
  p_next_stage_id uuid,
  p_prev_stage_id uuid
) returns workflow_stages as $$
declare
  v_stage workflow_stages;
  v_workflow_id uuid;
begin
  -- Get the workflow_id for this stage
  select workflow_id into v_workflow_id
  from workflow_stages
  where id = p_stage_id;

  -- Check if user has permission to update stages for this workflow
  if not exists (
    select 1 from workflows w
    join profiles p on p.org_id = w.org_id
    where p.auth_id = auth.uid()
    and w.id = v_workflow_id
    and p.role in ('admin', 'agent')
  ) then
    raise exception 'Permission denied';
  end if;

  update workflow_stages
  set 
    next_stage_id = p_next_stage_id,
    prev_stage_id = p_prev_stage_id
  where id = p_stage_id
  returning * into v_stage;
  
  return v_stage;
end;
$$ language plpgsql security definer;

-- Grant execute permission
grant execute on function update_workflow_stage_links(uuid, uuid, uuid) to authenticated;

drop function if exists  get_workflow_by_id;
-- Function to get a workflow by ID
create or replace function get_workflow_by_id(workflow_uuid uuid)
returns table (
  id uuid,
  name text,
  description text,
  org_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  is_active boolean
) security definer
as $$
begin
  return query
  select w.id, w.name, w.description, w.org_id, w.created_at, w.updated_at, w.is_active
  from workflows w
  where w.id = workflow_uuid
  and exists (
    select 1 from profiles p 
    where p.auth_id = auth.uid()
    and p.org_id = w.org_id
  );
end;
$$ language plpgsql;

-- Grant execute permission to authenticated users
grant execute on function get_workflow_by_id(uuid) to authenticated;

-- Function to get profiles by organization ID
create or replace function get_org_profiles(p_org_id uuid)
returns table (
  id uuid,
  email text,
  name text,
  role text
) security definer
as $$
begin
  return query
  select 
    p.id,
    p.email,
    p.name,
    p.role::text
  from profiles p
  where p.org_id = p_org_id
  and exists (
    select 1 from profiles caller
    where caller.auth_id = auth.uid()
    and caller.org_id = p_org_id
  )
  order by p.name;
end;
$$ language plpgsql;

-- Grant execute permission to authenticated users
grant execute on function get_org_profiles(uuid) to authenticated;

-- Function to get a profile by ID
create or replace function get_profile_by_id(p_profile_id uuid)
returns table (
  id uuid,
  name text,
  email text,
  role text
) security definer
as $$
begin
  return query
  select 
    p.id,
    p.name,
    p.email,
    p.role::text
  from profiles p
  where p.id = p_profile_id;
end;
$$ language plpgsql;

-- Grant execute permission to authenticated users
grant execute on function get_profile_by_id(uuid) to authenticated; 
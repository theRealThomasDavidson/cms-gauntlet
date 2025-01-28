-- Drop existing objects if they exist
drop view if exists agent_tickets cascade;
drop view if exists workflow_stage_stats cascade;
drop view if exists customer_tickets cascade;
drop view if exists ticket_details cascade;
drop table if exists ticket_attachments cascade;
drop table if exists ticket_comments cascade;
drop table if exists ticket_history cascade;
drop table if exists tickets cascade;
drop type if exists ticket_priority cascade;
drop type if exists ticket_status cascade;
drop index if exists tickets_org_idx;
drop index if exists tickets_workflow_idx;
drop index if exists tickets_stage_idx;
drop index if exists tickets_created_by_idx;
drop index if exists tickets_org_workflow_idx;
drop index if exists tickets_org_stage_idx;
drop index if exists tickets_workflow_stage_idx;
drop index if exists tickets_latest_history_idx;
drop index if exists tickets_updated_at_idx;
drop index if exists tickets_org_updated_idx;
drop index if exists ticket_history_ticket_idx;
drop index if exists ticket_history_stage_idx;
drop index if exists ticket_history_changed_at_idx;
drop index if exists ticket_history_assigned_idx;
drop index if exists ticket_history_priority_idx;
drop index if exists ticket_comments_ticket_idx;
drop index if exists ticket_comments_created_at_idx;
drop index if exists ticket_comments_internal_idx;
drop index if exists ticket_attachments_ticket_idx;
drop index if exists ticket_attachments_uploaded_at_idx;
drop index if exists agent_tickets_org_workflow_idx;
drop index if exists agent_tickets_priority_idx;
drop index if exists agent_tickets_assigned_to_idx;
drop index if exists workflow_stage_stats_org_idx;
drop index if exists workflow_stage_stats_workflow_idx;
drop function if exists refresh_ticket_stats cascade;

-- Step 1: Create base types
create type ticket_priority as enum ('low', 'medium', 'high', 'urgent');
create type ticket_status as enum ('open', 'in_progress', 'resolved', 'closed', 'on_hold');

-- Step 2: Create all tables first
create table tickets (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references organizations(id) not null,
  workflow_id uuid references workflows(id),
  current_stage_id uuid references workflow_stages(id),
  latest_history_id uuid,
  title text not null,
  description text,
  status ticket_status not null default 'open',
  priority ticket_priority not null default 'medium',
  created_by uuid references profiles(id) not null,
  assigned_to uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table ticket_history (
  id uuid primary key default uuid_generate_v4(),
  ticket_id uuid references tickets(id) on delete cascade not null,
  title text,
  description text,
  priority ticket_priority not null default 'low',
  assigned_to uuid references profiles(id),
  workflow_stage_id uuid references workflow_stages(id),
  changed_by uuid references profiles(id) not null,
  changed_at timestamptz default now(),
  previous_history_id uuid references ticket_history(id),
  changes jsonb not null
);

create table ticket_comments (
  id uuid primary key default uuid_generate_v4(),
  ticket_id uuid references tickets(id) on delete cascade not null,
  content text not null,
  created_by uuid references profiles(id) not null,
  created_at timestamptz default now(),
  is_internal boolean default false
);

create table ticket_attachments (
  id uuid primary key default uuid_generate_v4(),
  ticket_id uuid references tickets(id) on delete cascade not null,
  file_name text not null,
  file_type text not null,
  file_size integer not null,
  storage_path text not null,
  uploaded_by uuid references profiles(id) not null,
  uploaded_at timestamptz default now()
);

-- Step 3: Add foreign key constraints that depend on multiple tables
alter table tickets 
  add constraint fk_latest_history 
  foreign key (latest_history_id) 
  references ticket_history(id);

-- Step 4: Create indexes
create index tickets_org_idx on tickets(org_id);
create index tickets_workflow_idx on tickets(workflow_id);
create index tickets_stage_idx on tickets(current_stage_id);
create index tickets_created_by_idx on tickets(created_by);
create index tickets_org_workflow_idx on tickets(org_id, workflow_id);
create index tickets_org_stage_idx on tickets(org_id, current_stage_id);
create index tickets_workflow_stage_idx on tickets(workflow_id, current_stage_id);
create index tickets_latest_history_idx on tickets(latest_history_id);
create index tickets_updated_at_idx on tickets(updated_at desc);
create index tickets_org_updated_idx on tickets(org_id, updated_at desc);

create index ticket_history_ticket_idx on ticket_history(ticket_id);
create index ticket_history_stage_idx on ticket_history(workflow_stage_id);
create index ticket_history_changed_at_idx on ticket_history(changed_at);
create index ticket_history_assigned_idx on ticket_history(assigned_to);
create index ticket_history_priority_idx on ticket_history(priority);

create index ticket_comments_ticket_idx on ticket_comments(ticket_id);
create index ticket_comments_created_at_idx on ticket_comments(created_at);
create index ticket_comments_internal_idx on ticket_comments(ticket_id) where is_internal = true;

create index ticket_attachments_ticket_idx on ticket_attachments(ticket_id);
create index ticket_attachments_uploaded_at_idx on ticket_attachments(uploaded_at);

-- Step 5: Enable RLS on all tables
alter table tickets enable row level security;
alter table ticket_history enable row level security;
alter table ticket_comments enable row level security;
alter table ticket_attachments enable row level security;

-- Step 6: Drop views since we use RPC functions instead
drop view if exists ticket_details cascade;
drop view if exists agent_tickets cascade;
drop view if exists workflow_stage_stats cascade;
drop view if exists customer_tickets cascade;

-- Step 7: Drop existing policies
drop policy if exists "admins_full_access" on tickets;
drop policy if exists "agents_org_tickets" on tickets;
drop policy if exists "users_assigned_tickets" on tickets;
drop policy if exists "agent_full_history" on ticket_history;
drop policy if exists "user_limited_history" on ticket_history;
drop policy if exists "view_external_comments" on ticket_comments;
drop policy if exists "view_internal_comments" on ticket_comments;
drop policy if exists "create_external_comments" on ticket_comments;
drop policy if exists "create_internal_comments" on ticket_comments;
drop policy if exists "manage_own_comments" on ticket_comments;
drop policy if exists "view_attachments" on ticket_attachments;
drop policy if exists "upload_attachments" on ticket_attachments;
drop policy if exists "manage_attachments" on ticket_attachments;

-- Step 8: Create RLS policies (moved after views)
create policy "admins_full_access"
  on tickets for all
  to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.auth_id = auth.uid()
      and p.org_id = tickets.org_id
      and p.role = 'admin'
    )
  );

create policy "agents_org_tickets"
  on tickets for select
  to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.auth_id = auth.uid()
      and p.org_id = tickets.org_id
      and p.role = 'agent'
    )
  );

create policy "users_assigned_tickets"
  on tickets for select
  to authenticated
  using (
    exists (
      select 1 from profiles p
      join ticket_history h on h.ticket_id = tickets.id
      where p.auth_id = auth.uid()
      and (
        tickets.created_by = p.id
        or
        h.assigned_to = p.id
      )
    )
  );

create policy "agent_full_history"
  on ticket_history for select
  using (
    exists (
      select 1 from profiles p
      where p.auth_id = auth.uid()
      and p.role in ('admin', 'agent')
    )
  );

create policy "user_limited_history"
  on ticket_history for select
  to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.auth_id = auth.uid()
      and ticket_history.assigned_to = p.id
    )
  );

create policy "view_external_comments"
  on ticket_comments for select
  to authenticated
  using (
    exists (
      select 1 from tickets t
      join profiles p on p.org_id = t.org_id
      join ticket_history h on h.ticket_id = t.id
      where t.id = ticket_comments.ticket_id
      and not is_internal
      and (
        t.created_by = p.id
        or h.assigned_to = p.id
        or p.role in ('admin', 'agent')
      )
    )
  );

create policy "view_internal_comments"
  on ticket_comments for select
  to authenticated
  using (
    exists (
      select 1 from tickets t
      join profiles p on p.org_id = t.org_id
      where t.id = ticket_comments.ticket_id
      and p.role in ('admin', 'agent')
      and is_internal
    )
  );

create policy "create_external_comments"
  on ticket_comments for insert
  to authenticated
  with check (
    not is_internal
    and exists (
      select 1 from tickets t
      join profiles p on p.org_id = t.org_id
      where t.id = ticket_comments.ticket_id
    )
  );

create policy "create_internal_comments"
  on ticket_comments for insert
  to authenticated
  with check (
    is_internal
    and exists (
      select 1 from tickets t
      join profiles p on p.org_id = t.org_id
      where t.id = ticket_comments.ticket_id
      and p.role in ('admin', 'agent')
      and ticket_comments.created_by = p.id
    )
  );

create policy "manage_own_comments"
  on ticket_comments for update
  to authenticated
  using (
    exists (
      select 1 from tickets t
      join profiles p on p.org_id = t.org_id
      where t.id = ticket_comments.ticket_id
      and (
        (ticket_comments.created_by = p.id and not is_internal)
        or p.role in ('admin', 'agent')
      )
    )
  );

create policy "view_attachments"
  on ticket_attachments for select
  to authenticated
  using (
    exists (
      select 1 from tickets t
      join profiles p on p.org_id = t.org_id
      where t.id = ticket_attachments.ticket_id
    )
  );

create policy "upload_attachments"
  on ticket_attachments for insert
  to authenticated
  with check (
    exists (
      select 1 from tickets t
      join profiles p on p.org_id = t.org_id
      join ticket_history h on h.ticket_id = t.id
      where t.id = ticket_attachments.ticket_id
      and (
        t.created_by = p.id
        or h.assigned_to = p.id
        or p.role in ('admin', 'agent')
      )
    )
  );

create policy "manage_attachments"
  on ticket_attachments for delete
  to authenticated
  using (
    exists (
      select 1 from tickets t
      join profiles p on p.org_id = t.org_id
      where t.id = ticket_attachments.ticket_id
      and (p.role in ('admin', 'agent') or uploaded_by = p.id)
    )
  );

create policy "create_ticket_history"
  on ticket_history for insert
  to authenticated
  with check (
    exists (
      select 1 from tickets t
      join profiles p on p.org_id = t.org_id
      where t.id = ticket_history.ticket_id
      and (
        p.role in ('admin', 'agent')
        or (p.role = 'customer' and t.created_by = p.id)
      )
      and ticket_history.changed_by = p.id
    )
  );

create policy "create_tickets"
  on tickets for insert
  with check (
    exists (
      select 1 from profiles p
      where p.auth_id = auth.uid()
      and p.id = tickets.created_by
      and p.org_id = tickets.org_id
      and (
        -- If a workflow is specified, verify it belongs to the org
        (tickets.workflow_id is null) or
        exists (
          select 1 from workflows w
          where w.id = tickets.workflow_id
          and w.org_id = p.org_id
        )
      )
      and (
        -- If a stage is specified, verify it belongs to the workflow
        (tickets.current_stage_id is null) or
        exists (
          select 1 from workflow_stages ws
          where ws.id = tickets.current_stage_id
          and ws.workflow_id = tickets.workflow_id
        )
      )
    )
  );

-- Remove refresh function since we don't need it anymore
drop function if exists refresh_ticket_stats cascade;
drop function if exists update_ticket_data(uuid, text, text, ticket_status, ticket_priority, uuid, jsonb, text[], text);

-- Recreate the function with fixed status handling
create or replace function update_ticket_data(
  p_ticket_id uuid,
  p_title text,
  p_description text,
  p_status ticket_status,
  p_priority ticket_priority,
  p_assigned_to uuid,
  p_change_reason text default null
)
returns uuid as $$
declare
  v_old_history ticket_history;
  v_new_history_id uuid;
  v_profile_id uuid;
begin
  -- Get profile ID from auth ID
  select id into v_profile_id
  from profiles
  where auth_id = auth.uid();

  if v_profile_id is null then
    raise exception 'Profile not found';
  end if;

  -- Get current state
  select * into v_old_history
  from ticket_history
  where id = (
    select latest_history_id
    from tickets
    where id = p_ticket_id
  );

  -- Create history entry
  insert into ticket_history (
    ticket_id,
    title,
    description,
    priority,
    assigned_to,
    changed_by,
    changes
  ) values (
    p_ticket_id,
    p_title,
    p_description,
    p_priority,
    p_assigned_to,
    v_profile_id,
    jsonb_build_object('change_reason', p_change_reason)
  ) returning id into v_new_history_id;

  -- Update ticket
  update tickets 
  set latest_history_id = v_new_history_id,
      status = p_status
  where id = p_ticket_id;

  return v_new_history_id;
end;
$$ language plpgsql security definer;

-- Grant execute permissions
grant execute on function update_ticket_data(
  uuid,    -- p_ticket_id
  text,    -- p_title
  text,    -- p_description
  ticket_status,  -- p_status
  ticket_priority,  -- p_priority
  uuid,    -- p_assigned_to
  text     -- p_change_reason
) to authenticated;

-- Function to create a new ticket without workflow assignment
create or replace function create_ticket(
  p_title text,
  p_description text,
  p_priority ticket_priority,
  p_org_id uuid
) returns uuid as $$
declare
  v_ticket_id uuid;
  v_history_id uuid;
begin
  -- Verify user belongs to organization
  if not exists (
    select 1 from profiles
    where auth_id = auth.uid()
    and org_id = p_org_id
  ) then
    raise exception 'User does not belong to specified organization';
  end if;

  -- Create ticket
  insert into tickets (
    org_id,
    title,
    description,
    priority,
    created_by
  ) values (
    p_org_id,
    p_title,
    p_description,
    p_priority,
    (select id from profiles where auth_id = auth.uid())
  ) returning id into v_ticket_id;

  -- Create initial history entry
  insert into ticket_history (
    ticket_id,
    title,
    description,
    priority,
    changed_by,
    changes
  ) values (
    v_ticket_id,
    p_title,
    p_description,
    p_priority,
    (select id from profiles where auth_id = auth.uid()),
    jsonb_build_object(
      'action', 'created',
      'title', p_title,
      'description', p_description,
      'priority', p_priority
    )
  ) returning id into v_history_id;

  -- Update ticket with history reference
  update tickets
  set latest_history_id = v_history_id
  where id = v_ticket_id;

  return v_ticket_id;
end;
$$ language plpgsql security definer;

-- Function to assign a ticket to a workflow
create or replace function assign_ticket_to_workflow(
  p_ticket_id uuid,
  p_workflow_id uuid,
  p_initial_stage_id uuid,
  p_reason text default 'Initial workflow assignment'
) returns uuid as $$
declare
  v_history_id uuid;
  v_org_id uuid;
begin
  -- Get organization ID from ticket
  select org_id into v_org_id
  from tickets
  where id = p_ticket_id;

  -- Verify user has permission
  if not exists (
    select 1 from profiles
    where auth_id = auth.uid()
    and org_id = v_org_id
    and role in ('admin', 'agent')
  ) then
    raise exception 'Only admins and agents can assign workflows';
  end if;

  -- Verify workflow belongs to organization
  if not exists (
    select 1 from workflows
    where id = p_workflow_id
    and org_id = v_org_id
  ) then
    raise exception 'Workflow does not belong to ticket''s organization';
  end if;

  -- Verify stage belongs to workflow
  if not exists (
    select 1 from workflow_stages
    where id = p_initial_stage_id
    and workflow_id = p_workflow_id
  ) then
    raise exception 'Stage does not belong to specified workflow';
  end if;

  -- Create history entry for workflow assignment
  insert into ticket_history (
    ticket_id,
    title,
    description,
    priority,
    workflow_stage_id,
    changed_by,
    changes,
    previous_history_id
  ) 
  select
    t.id,
    h.title,
    h.description,
    h.priority,
    p_initial_stage_id,
    (select id from profiles where auth_id = auth.uid()),
    jsonb_build_object(
      'action', 'workflow_assigned',
      'workflow_id', p_workflow_id,
      'initial_stage_id', p_initial_stage_id,
      'reason', p_reason
    ),
    t.latest_history_id
  from tickets t
  join ticket_history h on h.id = t.latest_history_id
  where t.id = p_ticket_id
  returning id into v_history_id;

  -- Update ticket with workflow and stage
  update tickets
  set workflow_id = p_workflow_id,
      current_stage_id = p_initial_stage_id,
      latest_history_id = v_history_id
  where id = p_ticket_id;

  return v_history_id;
end;
$$ language plpgsql security definer;

-- Function to get tickets by workflow
create or replace function get_tickets_by_workflow(
  p_workflow_id uuid
) returns table (
  id uuid,
  org_id uuid,
  workflow_id uuid,
  current_stage_id uuid,
  title text,
  description text,
  priority ticket_priority,
  assigned_to uuid,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  workflow_name text,
  stage_name text,
  comment_count bigint,
  attachment_count bigint
) security definer as $$
begin
  -- Verify user has permission to view workflow
  if not exists (
    select 1 from workflows w
    join profiles p on p.org_id = w.org_id
    where w.id = p_workflow_id
    and p.auth_id = auth.uid()
  ) then
    raise exception 'User does not have permission to view this workflow''s tickets';
  end if;

  return query
  select 
    t.id,
    t.org_id,
    t.workflow_id,
    t.current_stage_id,
    h.title,
    h.description,
    h.priority,
    h.assigned_to,
    t.created_by,
    t.created_at,
    t.updated_at,
    w.name as workflow_name,
    ws.name as stage_name,
    (select count(*) from ticket_comments tc where tc.ticket_id = t.id) as comment_count,
    (select count(*) from ticket_attachments ta where ta.ticket_id = t.id) as attachment_count
  from tickets t
  join ticket_history h on h.id = t.latest_history_id
  left join workflows w on w.id = t.workflow_id
  left join workflow_stages ws on ws.id = t.current_stage_id
  where t.workflow_id = p_workflow_id
  order by t.updated_at desc;
end;
$$ language plpgsql;

-- Temporarily disable role check for unassigned tickets
create or replace function get_unassigned_tickets(
  p_org_id uuid
) returns table (
  id uuid,
  org_id uuid,
  workflow_id uuid,
  current_stage_id uuid,
  title text,
  description text,
  priority ticket_priority,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz
) as $$
begin
  return query
  select 
    t.id,
    t.org_id,
    t.workflow_id,
    t.current_stage_id,
    t.title,
    t.description,
    t.priority,
    t.created_by,
    t.created_at,
    t.updated_at
  from tickets t
  where t.org_id = p_org_id
  and t.workflow_id is null
  order by t.updated_at desc;
end;
$$ language plpgsql security definer;


-- Grant execute permissions
-- Grant execute permissions
grant execute on function get_unassigned_tickets(uuid) to authenticated;

-- Grant execute permissions
grant execute on function create_ticket(text, text, ticket_priority, uuid) to authenticated;
grant execute on function assign_ticket_to_workflow(uuid, uuid, uuid, text) to authenticated;
grant execute on function get_tickets_by_workflow(uuid) to authenticated;
grant execute on function get_unassigned_tickets(uuid) to authenticated;

-- Function to get ticket details with all related data
create or replace function get_ticket_details(
  p_ticket_id uuid
) returns table (
  ticket_id uuid,
  title text,
  description text,
  priority ticket_priority,
  status ticket_status,
  workflow_stage_id uuid,
  stage_name text,
  assigned_to uuid,
  changed_by uuid,
  changed_at timestamptz
) security definer as $$
begin
  -- Verify user has permission to view ticket
  if not exists (
    select 1 from tickets t
    join profiles p on p.org_id = t.org_id
    where t.id = p_ticket_id
    and p.auth_id = auth.uid()
    and (
      p.role in ('admin', 'agent')
      or t.created_by = p.id
      or exists (
        select 1 from ticket_history h
        where h.ticket_id = t.id
        and h.assigned_to = p.id
      )
    )
  ) then
    raise exception 'User does not have permission to view this ticket';
  end if;

  return query
  select 
    t.id as ticket_id,
    h.title,
    h.description,
    h.priority,
    t.status,
    h.workflow_stage_id,
    ws.name as stage_name,
    h.assigned_to,
    h.changed_by,
    h.changed_at
  from tickets t
  join ticket_history h on h.id = t.latest_history_id
  left join workflow_stages ws on ws.id = h.workflow_stage_id
  where t.id = p_ticket_id;
end;
$$ language plpgsql;

-- Function to get ticket history
create or replace function get_ticket_history(
  p_ticket_id uuid
) returns table (
  id uuid,
  title text,
  description text,
  priority ticket_priority,
  assigned_to uuid,
  workflow_stage_id uuid,
  changed_by uuid,
  changed_at timestamptz,
  changes jsonb
) security definer as $$
begin
  -- Verify user has permission to view ticket
  if not exists (
    select 1 from tickets t
    join profiles p on p.org_id = t.org_id
    where t.id = p_ticket_id
    and p.auth_id = auth.uid()
    and (
      p.role in ('admin', 'agent')
      or t.created_by = p.id
      or exists (
        select 1 from ticket_history h
        where h.ticket_id = t.id
        and h.assigned_to = p.id
      )
    )
  ) then
    raise exception 'User does not have permission to view this ticket';
  end if;

  return query
  select 
    h.id,
    h.title,
    h.description,
    h.priority,
    h.assigned_to,
    h.workflow_stage_id,
    h.changed_by,
    h.changed_at,
    h.changes
  from ticket_history h
  where h.ticket_id = p_ticket_id
  order by h.changed_at desc;
end;
$$ language plpgsql;

-- Function to get ticket comments
create or replace function get_ticket_comments(
  p_ticket_id uuid
) returns table (
  id uuid,
  content text,
  created_by uuid,
  created_at timestamptz,
  is_internal boolean,
  edited_at timestamptz
) security definer as $$
begin
  -- Verify user has permission to view ticket
  if not exists (
    select 1 from tickets t
    join profiles p on p.org_id = t.org_id
    where t.id = p_ticket_id
    and p.auth_id = auth.uid()
    and (
      p.role in ('admin', 'agent')
      or t.created_by = p.id
      or exists (
        select 1 from ticket_history h
        where h.ticket_id = t.id
        and h.assigned_to = p.id
      )
    )
  ) then
    raise exception 'User does not have permission to view this ticket';
  end if;

  return query
  select 
    c.id,
    c.content,
    c.created_by,
    c.created_at,
    c.is_internal,
    c.edited_at
  from ticket_comments c
  where c.ticket_id = p_ticket_id
  and (
    not c.is_internal 
    or exists (
      select 1 from profiles p
      where p.auth_id = auth.uid()
      and p.role in ('admin', 'agent')
    )
  )
  order by c.created_at asc;
end;
$$ language plpgsql;

-- Function to get ticket attachments
create or replace function get_ticket_attachments(
  p_ticket_id uuid
) returns table (
  id uuid,
  file_name text,
  file_type text,
  file_size bigint,
  storage_path text,
  uploaded_by uuid,
  uploaded_at timestamptz
) security definer as $$
begin
  -- Verify user has permission to view ticket
  if not exists (
    select 1 from tickets t
    join profiles p on p.org_id = t.org_id
    where t.id = p_ticket_id
    and p.auth_id = auth.uid()
    and (
      p.role in ('admin', 'agent')
      or t.created_by = p.id
      or exists (
        select 1 from ticket_history h
        where h.ticket_id = t.id
        and h.assigned_to = p.id
      )
    )
  ) then
    raise exception 'User does not have permission to view this ticket';
  end if;

  return query
  select 
    a.id,
    a.file_name,
    a.file_type,
    a.file_size,
    a.storage_path,
    a.uploaded_by,
    a.uploaded_at
  from ticket_attachments a
  where a.ticket_id = p_ticket_id
  order by a.uploaded_at desc;
end;
$$ language plpgsql;

-- Grant execute permissions
grant execute on function get_ticket_details(uuid) to authenticated;
grant execute on function get_ticket_history(uuid) to authenticated;
grant execute on function get_ticket_comments(uuid) to authenticated;
grant execute on function get_ticket_attachments(uuid) to authenticated;

-- Function to get agent tickets with filters
create or replace function get_agent_tickets(
  p_org_id uuid default null,
  p_priority ticket_priority default null,
  p_assigned_to uuid default null,
  p_stage_id uuid default null
) returns table (
  id uuid,
  org_id uuid,
  workflow_id uuid,
  current_stage_id uuid,
  title text,
  description text,
  priority ticket_priority,
  assigned_to uuid,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  workflow_name text,
  stage_name text,
  comment_count bigint,
  attachment_count bigint
) security definer as $$
begin
  -- Verify user is admin or agent
  if not exists (
    select 1 from profiles p
    where p.auth_id = auth.uid()
    and p.role in ('admin', 'agent')
  ) then
    raise exception 'Only admins and agents can view agent tickets';
  end if;

  return query
  select 
    t.id,
    t.org_id,
    t.workflow_id,
    t.current_stage_id,
    h.title,
    h.description,
    h.priority,
    h.assigned_to,
    t.created_by,
    t.created_at,
    t.updated_at,
    w.name as workflow_name,
    ws.name as stage_name,
    (select count(*) from ticket_comments tc where tc.ticket_id = t.id) as comment_count,
    (select count(*) from ticket_attachments ta where ta.ticket_id = t.id) as attachment_count
  from tickets t
  join ticket_history h on h.id = t.latest_history_id
  left join workflows w on w.id = t.workflow_id
  left join workflow_stages ws on ws.id = t.current_stage_id
  join profiles p on p.auth_id = auth.uid()
  where (p_org_id is null or t.org_id = p_org_id)
  and (p_priority is null or h.priority = p_priority)
  and (p_assigned_to is null or h.assigned_to = p_assigned_to)
  and (p_stage_id is null or t.current_stage_id = p_stage_id)
  and t.org_id = p.org_id
  order by t.updated_at desc;
end;
$$ language plpgsql;

-- Function to get customer tickets
create or replace function get_customer_tickets(
) returns table (
  id uuid,
  title text,
  priority ticket_priority,
  stage_name text,
  assigned_to_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  public_comment_count bigint
) security definer as $$
begin
  return query
  select 
    t.id,
    h.title,
    h.priority,
    ws.name as stage_name,
    h.assigned_to as assigned_to_id,
    t.created_at,
    t.updated_at,
    (
      select count(*) 
      from ticket_comments tc 
      where tc.ticket_id = t.id 
      and not tc.is_internal
    ) as public_comment_count
  from tickets t
  join ticket_history h on h.id = t.latest_history_id
  left join workflow_stages ws on ws.id = t.current_stage_id
  join profiles p on p.auth_id = auth.uid()
  where t.created_by = p.id
  or h.assigned_to = p.id
  order by t.updated_at desc;
end;
$$ language plpgsql;

-- Function to get workflow stage stats
create or replace function get_workflow_stage_stats(
  p_org_id uuid
) returns table (
  stage_id uuid,
  workflow_id uuid,
  stage_name text,
  ticket_count bigint,
  avg_hours_in_stage float,
  high_priority_count bigint
) security definer as $$
begin
  -- Verify user belongs to org
  if not exists (
    select 1 from profiles p
    where p.auth_id = auth.uid()
    and p.org_id = p_org_id
  ) then
    raise exception 'User does not belong to specified organization';
  end if;

  return query
  select 
    ws.id as stage_id,
    ws.workflow_id,
    ws.name as stage_name,
    count(t.id) as ticket_count,
    avg(extract(epoch from (now() - t.created_at)))/3600 as avg_hours_in_stage,
    count(t.id) filter (where h.priority in ('high', 'urgent')) as high_priority_count
  from workflow_stages ws
  join workflows w on w.id = ws.workflow_id
  left join tickets t on t.current_stage_id = ws.id
  left join ticket_history h on h.id = t.latest_history_id
  where w.org_id = p_org_id
  group by ws.id, ws.workflow_id, ws.name;
end;
$$ language plpgsql;

-- Grant execute permissions
grant execute on function get_agent_tickets(uuid, ticket_priority, uuid, uuid) to authenticated;
grant execute on function get_customer_tickets() to authenticated;
grant execute on function get_workflow_stage_stats(uuid) to authenticated;

-- After the table definitions, add these grants
GRANT SELECT, UPDATE ON tickets TO authenticated;
GRANT SELECT ON workflow_stages TO authenticated;
GRANT INSERT ON ticket_history TO authenticated;

-- If using RLS (Row Level Security), also add policies
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

-- Policy for viewing tickets
CREATE POLICY "Users can view tickets in their org" ON tickets
  FOR SELECT USING (
    org_id IN (
      SELECT org_id FROM profiles
      WHERE id = auth.uid()
    )
  );

-- Policy for updating tickets
CREATE POLICY "Users can update tickets in their org" ON tickets
  FOR UPDATE USING (
    org_id IN (
      SELECT org_id FROM profiles
      WHERE id = auth.uid()
    )
  );

-- Add these policies
CREATE POLICY "Users can update tickets in their org" ON tickets
  FOR UPDATE USING (
    org_id IN (
      SELECT org_id FROM profiles
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert ticket history" ON ticket_history
  FOR INSERT WITH CHECK (
    ticket_id IN (
      SELECT t.id FROM tickets t
      JOIN profiles p ON p.org_id = t.org_id
      WHERE p.id = auth.uid()
    )
  ); 
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
  title text not null,
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

-- Step 6: Create views and functions first (moved up)
create view ticket_details as
select 
  h.id as history_id,
  h.ticket_id,
  h.title,
  h.description,
  h.priority,
  h.assigned_to,
  h.workflow_stage_id,
  h.changed_by,
  h.changed_at,
  ws.name as stage_name,
  p_assigned.name as assigned_to_name,
  p_assigned.role as assigned_to_role
from ticket_history h
join workflow_stages ws on ws.id = h.workflow_stage_id
left join profiles p_assigned on p_assigned.id = h.assigned_to;

create view agent_tickets as
select 
  t.id,
  t.org_id,
  t.workflow_id,
  t.current_stage_id,
  td.title,
  td.description,
  td.priority,
  td.assigned_to,
  t.created_by,
  t.created_at,
  t.updated_at,
  w.name as workflow_name,
  td.stage_name,
  td.assigned_to_name,
  p_created.name as created_by_name,
  (
    select count(*) 
    from ticket_comments tc 
    where tc.ticket_id = t.id
  ) as comment_count,
  (
    select count(*) 
    from ticket_attachments ta 
    where ta.ticket_id = t.id
  ) as attachment_count
from tickets t
join ticket_details td on td.history_id = t.latest_history_id
LEFT JOIN workflows w on w.id = t.workflow_id
join profiles p_created on p_created.id = t.created_by;

create view workflow_stage_stats as
select 
  ws.id as stage_id,
  ws.workflow_id,
  ws.name as stage_name,
  w.org_id,
  count(t.id) as ticket_count,
  avg(extract(epoch from (now() - t.created_at)))/3600 as avg_hours_in_stage,
  (
    select count(*) 
    from tickets t2 
    join ticket_history h2 on h2.id = t2.latest_history_id
    where t2.current_stage_id = ws.id 
    and h2.priority in ('high', 'urgent')
  ) as high_priority_count
from workflow_stages ws
join workflows w on w.id = ws.workflow_id
left join tickets t on t.current_stage_id = ws.id
group by ws.id, ws.workflow_id, ws.name, w.org_id;

create view customer_tickets as
select 
  t.id,
  td.title,
  td.priority,
  td.stage_name,
  case 
    when td.assigned_to_role in ('admin', 'agent') then 'Support Team'
    else td.assigned_to_name
  end as assigned_to_display,
  t.created_at,
  t.updated_at,
  (
    select count(*) 
    from ticket_comments tc 
    where tc.ticket_id = t.id 
    and not tc.is_internal
  ) as public_comment_count
from tickets t
join ticket_details td on td.history_id = t.latest_history_id
where exists (
  select 1 from profiles p
  where p.auth_id = auth.uid()
  and (
    t.created_by = p.id
    or td.assigned_to = p.id
  )
);

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
      join ticket_details td on td.ticket_id = tickets.id
      where p.auth_id = auth.uid()
      and (
        tickets.created_by = p.id
        or
        td.assigned_to = p.id
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
      join ticket_details td on td.ticket_id = t.id
      where t.id = ticket_comments.ticket_id
      and not is_internal
      and (
        t.created_by = p.id
        or td.assigned_to = p.id
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
      join ticket_details td on td.ticket_id = t.id
      where t.id = ticket_attachments.ticket_id
      and (
        t.created_by = p.id
        or td.assigned_to = p.id
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
  to authenticated
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

-- Function to update ticket history
create or replace function update_ticket_history()
returns trigger as $$
declare
  old_history ticket_history;
  new_history_id uuid;
  changes jsonb;
begin
  -- Get the current state
  select * into old_history 
  from ticket_history 
  where id = old.latest_history_id;

  -- Calculate what changed
  changes = jsonb_build_object(
    'title', case when new.title != old_history.title then jsonb_build_object('old', old_history.title, 'new', new.title) else null end,
    'description', case when new.description != old_history.description then jsonb_build_object('old', old_history.description, 'new', new.description) else null end,
    'status', case when new.status != old_history.status then jsonb_build_object('old', old_history.status, 'new', new.status) else null end,
    'priority', case when new.priority != old_history.priority then jsonb_build_object('old', old_history.priority, 'new', new.priority) else null end,
    'assigned_to', case when new.assigned_to != old_history.assigned_to then jsonb_build_object('old', old_history.assigned_to, 'new', new.assigned_to) else null end,
    'custom_fields', case when new.custom_fields != old_history.custom_fields then jsonb_build_object('old', old_history.custom_fields, 'new', new.custom_fields) else null end,
    'tags', case when new.tags != old_history.tags then jsonb_build_object('old', old_history.tags, 'new', new.tags) else null end
  );

  -- Only create history if something changed
  if changes != '{}'::jsonb then
    insert into ticket_history (
      ticket_id,
      previous_state_id,
      title,
      description,
      status,
      priority,
      assigned_to,
      custom_fields,
      tags,
      changed_by,
      changes
    ) values (
      old.id,
      old.latest_history_id,
      new.title,
      new.description,
      new.status,
      new.priority,
      new.assigned_to,
      new.custom_fields,
      new.tags,
      auth.uid(),
      changes
    ) returning id into new_history_id;

    -- Update ticket with new latest history
    update tickets 
    set latest_history_id = new_history_id
    where id = old.id;
  end if;

  return new;
end;
$$ language plpgsql security definer;

-- Function to update ticket data
create or replace function update_ticket_data(
  p_ticket_id uuid,
  p_title text,
  p_description text,
  p_status ticket_status,
  p_priority ticket_priority,
  p_assigned_to uuid,
  p_custom_fields jsonb default '{}'::jsonb,
  p_tags text[] default '{}'::text[],
  p_change_reason text default null
)
returns uuid as $$
declare
  v_old_history ticket_history;
  v_new_history_id uuid;
  v_changes jsonb;
begin
  -- Get current state
  select * into v_old_history
  from ticket_history
  where id = (
    select latest_history_id
    from tickets
    where id = p_ticket_id
  );

  -- Calculate changes
  v_changes = jsonb_build_object(
    'title', case when p_title != v_old_history.title then jsonb_build_object('old', v_old_history.title, 'new', p_title) else null end,
    'description', case when p_description != v_old_history.description then jsonb_build_object('old', v_old_history.description, 'new', p_description) else null end,
    'status', case when p_status != v_old_history.status then jsonb_build_object('old', v_old_history.status, 'new', p_status) else null end,
    'priority', case when p_priority != v_old_history.priority then jsonb_build_object('old', v_old_history.priority, 'new', p_priority) else null end,
    'assigned_to', case when p_assigned_to != v_old_history.assigned_to then jsonb_build_object('old', v_old_history.assigned_to, 'new', p_assigned_to) else null end,
    'custom_fields', case when p_custom_fields != v_old_history.custom_fields then jsonb_build_object('old', v_old_history.custom_fields, 'new', p_custom_fields) else null end,
    'tags', case when p_tags != v_old_history.tags then jsonb_build_object('old', v_old_history.tags, 'new', p_tags) else null end
  );

  -- Only create history if something changed
  if v_changes != '{}'::jsonb then
    insert into ticket_history (
      ticket_id,
      previous_state_id,
      title,
      description,
      status,
      priority,
      assigned_to,
      custom_fields,
      tags,
      changed_by,
      change_reason,
      changes
    ) values (
      p_ticket_id,
      v_old_history.id,
      p_title,
      p_description,
      p_status,
      p_priority,
      p_assigned_to,
      p_custom_fields,
      p_tags,
      auth.uid(),
      p_change_reason,
      v_changes
    ) returning id into v_new_history_id;

    -- Update ticket reference
    update tickets 
    set latest_history_id = v_new_history_id
    where id = p_ticket_id;

    return v_new_history_id;
  end if;

  return v_old_history.id;
end;
$$ language plpgsql security definer;

-- Create trigger for history updates
create trigger update_ticket_history
after update on ticket_history
for each row
execute function update_ticket_history();

-- Grant execute permissions
grant execute on function update_ticket_data(uuid, text, text, ticket_status, ticket_priority, uuid, jsonb, text[], text) to authenticated; 
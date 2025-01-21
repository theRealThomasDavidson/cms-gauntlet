-- Drop existing objects if they exist
drop materialized view if exists agent_tickets cascade;
drop materialized view if exists workflow_stage_stats cascade;
drop view if exists customer_tickets cascade;
drop table if exists ticket_attachments cascade;
drop table if exists ticket_comments cascade;
drop table if exists ticket_history cascade;
drop table if exists tickets cascade;
drop type if exists ticket_priority cascade;
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

-- Step 2: Create all tables first
create table tickets (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references organizations(id) not null,
  workflow_id uuid references workflows(id),
  current_stage_id uuid references workflow_stages(id),
  latest_history_id uuid,
  created_by uuid references profiles(id) not null,
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


-- Step 6: Create RLS policies
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
      where p.auth_id = auth.uid()
      and (
        -- User created the ticket
        tickets.created_by = p.id
        or
        -- User is assigned to the ticket (check latest history directly)
        exists (
          select 1 from ticket_history h
          where h.ticket_id = tickets.id
          and h.assigned_to = p.id
          order by h.changed_at desc
          limit 1
        )
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
      where t.id = ticket_comments.ticket_id
      and p.auth_id = auth.uid()
      and not is_internal
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
      and p.auth_id = auth.uid()
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
      and p.auth_id = auth.uid()
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
      and p.auth_id = auth.uid()
      and p.role in ('admin', 'agent')
    )
  );

create policy "manage_own_comments"
  on ticket_comments for update
  to authenticated
  using (
    created_by = (
      select id from profiles
      where auth_id = auth.uid()
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
      and p.auth_id = auth.uid()
    )
  );

create policy "upload_attachments"
  on ticket_attachments for insert
  to authenticated
  with check (
    exists (
      select 1 from tickets t
      join profiles p on p.org_id = t.org_id
      where t.id = ticket_attachments.ticket_id
      and p.auth_id = auth.uid()
      and (
        t.created_by = p.id
        or exists (
          select 1 from ticket_history h
          where h.ticket_id = t.id
          and h.assigned_to = p.id
        )
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
      and p.auth_id = auth.uid()
      and (p.role in ('admin', 'agent') or uploaded_by = p.id)
    )
  );

create policy "create_ticket_history"
  on ticket_history for insert
  to authenticated
  with check (
    exists (
      select 1 from profiles p
      where p.auth_id = auth.uid()
      and (
        p.role in ('admin', 'agent')
        or p.id = changed_by
      )
    )
  );

create policy "create_tickets"
  on tickets for insert
  to authenticated
  with check (
    created_by = (
      select id from profiles
      where auth_id = auth.uid()
      limit 1
    )
  );

-- Step 7: Create views and functions
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

create materialized view agent_tickets as
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

create index agent_tickets_org_workflow_idx on agent_tickets(org_id, workflow_id);
create index agent_tickets_priority_idx on agent_tickets(priority);
create index agent_tickets_assigned_to_idx on agent_tickets(assigned_to);

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

create materialized view workflow_stage_stats as
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

create index workflow_stage_stats_org_idx on workflow_stage_stats(org_id);
create index workflow_stage_stats_workflow_idx on workflow_stage_stats(workflow_id);

-- Step 8: Create refresh function
create function refresh_ticket_stats()
returns void as $$
begin
  refresh materialized view concurrently workflow_stage_stats;
  refresh materialized view concurrently agent_tickets;
end;
$$ language plpgsql;

-- Step 9: Schedule refresh
select cron.schedule(
  'refresh_ticket_stats',
  '*/5 * * * *',
  $$select refresh_ticket_stats()$$
); 
# Database Schema Design

## Core Tables

### Organizations
```sql
create table organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  created_at timestamptz default now(),
  is_active boolean default true,
  is_default boolean default false
);

create index organizations_name_idx on organizations(name);

-- RLS Policies
alter table organizations enable row level security;

create policy "authenticated users can view organizations"
  on organizations for select
  to authenticated
  using (true);

create policy "admins can manage organizations"
  on organizations for all
  to authenticated
  using (exists (
    select 1 from profiles
    where auth_id = auth.uid()
    and role = 'admin'
  ));

-- Function to get or create default organization
create or replace function get_or_create_default_org()
returns uuid as $$
declare
  v_org_id uuid;
begin
  -- Try to get existing default org
  select id into v_org_id
  from organizations
  where is_default = true;
  
  -- Create if none exists
  if v_org_id is null then
    insert into organizations (name, is_default)
    values ('Default Organization', true)
    returning id into v_org_id;
  end if;
  
  return v_org_id;
end;
$$ language plpgsql;

-- Function to check if the user is an admin
create or replace function is_admin()
returns boolean as $$
begin
  return exists (
    select 1 from profiles
    where auth_id = auth.uid()
    and role = 'admin'
  );
end;
$$ language plpgsql;
```

### Profiles
```sql
create table profiles (
  id uuid primary key default uuid_generate_v4(),
  auth_id uuid not null references auth.users(id),
  username text not null unique,
  name text not null,
  email text not null,
  role user_role not null default 'customer',
  org_id uuid references organizations(id),
  teams uuid[] default '{}',
  created_at timestamptz default now(),
  last_active timestamptz,
  preferences jsonb default '{}'::jsonb,
  
  constraint profiles_auth_id_key unique (auth_id)
);

create index profiles_auth_id_idx on profiles(auth_id);
create index profiles_email_idx on profiles(email);
create index profiles_org_id_idx on profiles(org_id);
create index profiles_role_idx on profiles(role);
create index profiles_username_idx on profiles(username);

-- RLS Policies
alter table profiles enable row level security;

create policy "users can view profiles in their org"
  on profiles for select
  to authenticated
  using (
    org_id in (
      select org_id from profiles
      where auth_id = auth.uid()
    )
  );

create policy "users can update own profile"
  on profiles for update
  to authenticated
  using (auth_id = auth.uid())
  with check (auth_id = auth.uid());

create policy "admins can update any profile"
  on profiles for update
  to authenticated
  using (exists (
    select 1 from profiles
    where auth_id = auth.uid()
    and role = 'admin'
  ));

-- Function to handle new user creation
create or replace function handle_new_user()
returns trigger as $$
declare
  v_default_org_id uuid;
begin
  -- Get default org
  v_default_org_id := get_or_create_default_org();
  
  -- Create profile
  insert into public.profiles (auth_id, username, name, email, org_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    v_default_org_id
  );
  
  return new;
end;
$$ language plpgsql;

-- Function to change user role
create or replace function change_role(user_id uuid, new_role user_role)
returns void as $$
begin
  update profiles
  set role = new_role
  where auth_id = user_id;
end;
$$ language plpgsql;

-- Function to delete user
create or replace function delete_user(email text)
returns text as $$
declare
  v_user_id uuid;
  v_username text;
begin
  -- Get user info
  select auth.users.id, profiles.username
  into v_user_id, v_username
  from auth.users
  join public.profiles on profiles.auth_id = auth.users.id
  where auth.users.email = delete_user.email;

  -- Delete profile first
  delete from public.profiles where auth_id = v_user_id;
  
  -- Delete auth user
  delete from auth.users where id = v_user_id;

  return format('User %s deleted', v_username);
end;
$$ language plpgsql;
```

## Workflow Management

### Workflows
```sql
create table workflows (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id),
  name text not null,
  description text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index workflows_org_idx on workflows(org_id);
create index workflows_active_idx on workflows(org_id) where is_active = true;

-- RLS Policies
alter table workflows enable row level security;

create policy "org members can view workflows"
  on workflows for select
  to authenticated
  using (
    org_id in (
      select org_id from profiles
      where auth_id = auth.uid()
    )
  );

create policy "admins and agents can manage workflows"
  on workflows for all
  to authenticated
  using (
    exists (
      select 1 from profiles
      where auth_id = auth.uid()
      and role in ('admin', 'agent')
      and org_id = workflows.org_id
    )
  );
```

### Workflow Stages
```sql
create table workflow_stages (
  id uuid primary key default uuid_generate_v4(),
  workflow_id uuid not null references workflows(id) on delete cascade,
  name text not null,
  description text,
  is_start boolean default false,
  is_end boolean default false,
  is_other boolean default false,
  next_stage_id uuid references workflow_stages(id),
  prev_stage_id uuid references workflow_stages(id),
  created_at timestamptz default now(),
  
  constraint no_self_reference check (id <> next_stage_id and id <> prev_stage_id),
  constraint workflow_stages_workflow_id_id_key unique (workflow_id, id)
);

create unique index unique_start_per_workflow on workflow_stages(workflow_id) where is_start = true;
create unique index unique_end_per_workflow on workflow_stages(workflow_id) where is_end = true;
create unique index unique_other_per_workflow on workflow_stages(workflow_id) where is_other = true;

-- RLS Policies
alter table workflow_stages enable row level security;

create policy "org members can view stages"
  on workflow_stages for select
  to authenticated
  using (
    exists (
      select 1 from workflows w
      join profiles p on p.org_id = w.org_id
      where p.auth_id = auth.uid()
      and w.id = workflow_stages.workflow_id
    )
  );

create policy "admins and agents can manage stages"
  on workflow_stages for all
  to authenticated
  using (
    exists (
      select 1 from workflows w
      join profiles p on p.org_id = w.org_id
      where p.auth_id = auth.uid()
      and p.role in ('admin', 'agent')
      and w.id = workflow_stages.workflow_id
    )
  );

-- Function to get workflow stages
create or replace function get_workflow_stages(p_workflow_id uuid)
returns table (
  id uuid,
  name text,
  description text,
  is_start boolean,
  is_end boolean,
  next_stage_id uuid,
  prev_stage_id uuid
) as $$
begin
  return query
  select
    ws.id,
    ws.name,
    ws.description,
    ws.is_start,
    ws.is_end,
    ws.next_stage_id,
    ws.prev_stage_id
  from workflow_stages ws
  where ws.workflow_id = p_workflow_id
  order by 
    ws.is_start desc,
    ws.created_at asc;
end;
$$ language plpgsql;
```

### Stage Hooks
```sql
create table workflow_stage_hooks (
  id uuid primary key default uuid_generate_v4(),
  stage_id uuid not null references workflow_stages(id) on delete cascade,
  hook_type hook_type not null,
  config jsonb not null default '{}',
  is_active boolean default true,
  created_at timestamptz default now(),
  
  constraint valid_hook_config check (
    hook_type <> 'notification' or (
      config ? 'target_type' and
      config->>'target_type' = any(array['specific_user', 'role', 'ticket_creator', 'org_admins']) and
      ((config->>'target_type' = 'specific_user' and config ? 'target_user_id') or
       (config->>'target_type' = 'role' and config ? 'target_role') or
       config->>'target_type' = any(array['ticket_creator', 'org_admins'])) and
      config ? 'message'
    )
  )
);

create index workflow_stage_hooks_stage_idx on workflow_stage_hooks(stage_id);

-- RLS Policies
alter table workflow_stage_hooks enable row level security;

create policy "org members can view hooks"
  on workflow_stage_hooks for select
  to authenticated
  using (
    exists (
      select 1 from workflow_stages ws
      join workflows w on w.id = ws.workflow_id
      join profiles p on p.org_id = w.org_id
      where p.auth_id = auth.uid()
      and ws.id = workflow_stage_hooks.stage_id
    )
  );

create policy "admins and agents can manage hooks"
  on workflow_stage_hooks for all
  to authenticated
  using (
    exists (
      select 1 from workflow_stages ws
      join workflows w on w.id = ws.workflow_id
      join profiles p on p.org_id = w.org_id
      where p.auth_id = auth.uid()
      and p.role in ('admin', 'agent')
      and ws.id = workflow_stage_hooks.stage_id
    )
  );

-- Function to get stage hooks
create or replace function get_stage_hooks(p_stage_id uuid)
returns table (
  id uuid,
  hook_type hook_type,
  config jsonb,
  is_active boolean
) as $$
begin
  return query
  select
    wsh.id,
    wsh.hook_type,
    wsh.config,
    wsh.is_active
  from workflow_stage_hooks wsh
  where wsh.stage_id = p_stage_id
  and wsh.is_active = true;
end;
$$ language plpgsql;
```

## Ticket System

### Tickets
```sql
create table tickets (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id),
  workflow_id uuid references workflows(id),
  current_stage_id uuid references workflow_stages(id),
  latest_history_id uuid references ticket_history(id),
  created_by uuid not null references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index tickets_org_idx on tickets(org_id);
create index tickets_workflow_idx on tickets(workflow_id);
create index tickets_stage_idx on tickets(current_stage_id);
create index tickets_created_by_idx on tickets(created_by);
create index tickets_latest_history_idx on tickets(latest_history_id);
create index tickets_org_workflow_idx on tickets(org_id, workflow_id);
create index tickets_org_stage_idx on tickets(org_id, current_stage_id);
create index tickets_workflow_stage_idx on tickets(workflow_id, current_stage_id);
create index tickets_updated_at_idx on tickets(updated_at desc);
create index tickets_org_updated_idx on tickets(org_id, updated_at desc);

-- Function to create ticket
create or replace function create_ticket(
  p_org_id uuid,
  p_title text,
  p_description text,
  p_priority ticket_priority,
  p_workflow_id uuid default null
) returns uuid as $$
declare
  v_ticket_id uuid;
  v_history_id uuid;
  v_workflow_id uuid;
  v_start_stage_id uuid;
begin
  -- Get workflow ID if not provided
  if p_workflow_id is null then
    select id into v_workflow_id
    from workflows
    where org_id = p_org_id
      and is_active = true
    order by created_at asc
    limit 1;
  else
    v_workflow_id := p_workflow_id;
  end if;

  -- Get start stage
  select id into v_start_stage_id
  from workflow_stages
  where workflow_id = v_workflow_id
    and is_start = true;

  -- Create ticket
  insert into tickets (
    org_id,
    workflow_id,
    current_stage_id,
    created_by
  ) values (
    p_org_id,
    v_workflow_id,
    v_start_stage_id,
    auth.uid()
  ) returning id into v_ticket_id;

  -- Create initial history
  insert into ticket_history (
    ticket_id,
    title,
    description,
    priority,
    workflow_stage_id,
    changed_by,
    changes
  ) values (
    v_ticket_id,
    p_title,
    p_description,
    p_priority,
    v_start_stage_id,
    auth.uid(),
    jsonb_build_object(
      'title', p_title,
      'description', p_description,
      'priority', p_priority,
      'workflow_stage_id', v_start_stage_id
    )
  ) returning id into v_history_id;

  -- Update ticket with latest history
  update tickets
  set latest_history_id = v_history_id
  where id = v_ticket_id;

  return v_ticket_id;
end;
$$ language plpgsql;
```

### Ticket History
```sql
create table ticket_history (
  id uuid primary key default uuid_generate_v4(),
  ticket_id uuid not null references tickets(id) on delete cascade,
  title text not null,
  description text,
  priority ticket_priority not null default 'low',
  assigned_to uuid references profiles(id),
  workflow_stage_id uuid references workflow_stages(id),
  changed_by uuid not null references profiles(id),
  changed_at timestamptz default now(),
  previous_history_id uuid references ticket_history(id),
  changes jsonb not null
);

create index ticket_history_ticket_idx on ticket_history(ticket_id);
create index ticket_history_stage_idx on ticket_history(workflow_stage_id);
create index ticket_history_changed_at_idx on ticket_history(changed_at);
create index ticket_history_assigned_idx on ticket_history(assigned_to);
create index ticket_history_priority_idx on ticket_history(priority);

-- Function to update ticket
create or replace function update_ticket(
  p_ticket_id uuid,
  p_title text default null,
  p_description text default null,
  p_priority ticket_priority default null,
  p_assigned_to uuid default null,
  p_stage_id uuid default null
) returns uuid as $$
declare
  v_history_id uuid;
  v_changes jsonb;
begin
  -- Build changes object
  v_changes := '{}'::jsonb;
  if p_title is not null then
    v_changes := v_changes || jsonb_build_object('title', p_title);
  end if;
  if p_description is not null then
    v_changes := v_changes || jsonb_build_object('description', p_description);
  end if;
  if p_priority is not null then
    v_changes := v_changes || jsonb_build_object('priority', p_priority);
  end if;
  if p_assigned_to is not null then
    v_changes := v_changes || jsonb_build_object('assigned_to', p_assigned_to);
  end if;
  if p_stage_id is not null then
    v_changes := v_changes || jsonb_build_object('workflow_stage_id', p_stage_id);
  end if;

  -- Create history entry
  insert into ticket_history (
    ticket_id,
    title,
    description,
    priority,
    assigned_to,
    workflow_stage_id,
    changed_by,
    previous_history_id,
    changes
  )
  select
    t.id,
    coalesce(p_title, h.title),
    coalesce(p_description, h.description),
    coalesce(p_priority, h.priority),
    coalesce(p_assigned_to, h.assigned_to),
    coalesce(p_stage_id, h.workflow_stage_id),
    auth.uid(),
    t.latest_history_id,
    v_changes
  from tickets t
  join ticket_history h on h.id = t.latest_history_id
  where t.id = p_ticket_id
  returning id into v_history_id;

  -- Update ticket
  update tickets
  set
    current_stage_id = coalesce(p_stage_id, current_stage_id),
    latest_history_id = v_history_id,
    updated_at = now()
  where id = p_ticket_id;

  return v_history_id;
end;
$$ language plpgsql;
```

### Comments
```sql
create table ticket_comments (
  id uuid primary key default uuid_generate_v4(),
  ticket_id uuid not null references tickets(id) on delete cascade,
  content text not null,
  created_by uuid not null references profiles(id),
  created_at timestamptz default now(),
  is_internal boolean default false
);

create index ticket_comments_ticket_idx on ticket_comments(ticket_id);
create index ticket_comments_created_at_idx on ticket_comments(created_at);
create index ticket_comments_internal_idx on ticket_comments(ticket_id) where is_internal = true;

-- Function to create comment notification
create or replace function create_comment_notification()
returns trigger as $$
begin
  -- Create notifications for ticket creator and assignee
  insert into notifications (
    user_id,
    type,
    title,
    content,
    link,
    expires_at
  )
  select
    user_id,
    'comment',
    format('New comment on ticket #%s', new.ticket_id),
    substring(new.content from 1 for 100),
    format('/tickets/%s', new.ticket_id),
    now() + interval '7 days'
  from (
    select created_by as user_id from tickets where id = new.ticket_id
    union
    select assigned_to from tickets where id = new.ticket_id and assigned_to is not null
  ) users
  where user_id != new.created_by;
  
  return new;
end;
$$ language plpgsql;
```

### Attachments
```sql
create table ticket_attachments (
  id uuid primary key default uuid_generate_v4(),
  ticket_id uuid not null references tickets(id) on delete cascade,
  file_name text not null,
  file_type text not null,
  file_size integer not null,
  storage_path text not null,
  uploaded_by uuid not null references profiles(id),
  uploaded_at timestamptz default now()
);

create index ticket_attachments_ticket_idx on ticket_attachments(ticket_id);
create index ticket_attachments_uploaded_at_idx on ticket_attachments(uploaded_at);
```

## Views

### Customer Tickets View
```sql
create view customer_tickets as
select 
  id,
  title,
  priority,
  stage_name,
  assigned_to_display,
  created_at,
  updated_at,
  public_comment_count
from tickets;
```

### Ticket Details View
```sql
create view ticket_details as
select
  ticket_id,
  history_id,
  title,
  description,
  priority,
  workflow_stage_id,
  stage_name,
  assigned_to,
  assigned_to_name,
  assigned_to_role,
  changed_by,
  changed_at
from tickets;
```

## Materialized Views

### Agent Tickets View
```sql
create materialized view agent_tickets as
select
  t.id,
  t.org_id,
  h.title,
  h.priority,
  ws.name as stage_name,
  p.name as assigned_to_name,
  t.created_at,
  t.updated_at,
  count(tc.id) filter (where not tc.is_internal) as public_comment_count,
  count(tc.id) filter (where tc.is_internal) as internal_comment_count
from tickets t
join ticket_history h on h.id = t.latest_history_id
left join workflow_stages ws on ws.id = t.current_stage_id
left join profiles p on p.id = h.assigned_to
left join ticket_comments tc on tc.ticket_id = t.id
group by t.id, t.org_id, h.title, h.priority, ws.name, p.name, t.created_at, t.updated_at;

create unique index agent_tickets_id_idx on agent_tickets(id);
create index agent_tickets_org_idx on agent_tickets(org_id);
```

### Workflow Stage Stats
```sql
create materialized view workflow_stage_stats as
select
  ws.id as stage_id,
  ws.workflow_id,
  ws.name as stage_name,
  count(t.id) as ticket_count,
  avg(extract(epoch from (now() - t.updated_at))) as avg_time_in_stage
from workflow_stages ws
left join tickets t on t.current_stage_id = ws.id
group by ws.id, ws.workflow_id, ws.name;

create unique index workflow_stage_stats_id_idx on workflow_stage_stats(stage_id);
create index workflow_stage_stats_workflow_idx on workflow_stage_stats(workflow_id);
```

## Scheduled Tasks

### Materialized View Refresh
```sql
-- Function to refresh materialized views
create or replace function refresh_ticket_stats()
returns void as $$
begin
  refresh materialized view concurrently agent_tickets;
  refresh materialized view concurrently workflow_stage_stats;
end;
$$ language plpgsql;

-- Schedule refresh every 5 minutes
select cron.schedule('*/5 * * * *', $$
  select refresh_ticket_stats();
$$);
``` 
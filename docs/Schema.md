# Database Schema Design

## Authentication & Users

### Decisions Made
1. Using Supabase built-in auth
2. GitHub OAuth enabled
3. No 2FA requirement
4. Separating auth from profile data

### Tables

```sql
-- This is managed by Supabase Auth
auth.users (
  id uuid references auth.users primary key,
  email text,
  -- other Supabase auth fields
)

-- Our custom profile data
profiles (
  id uuid primary key default uuid_generate_v4(),
  auth_id uuid references auth.users not null,
  role user_role not null,
  name text not null,
  teams uuid[] default '{}',
  created_at timestamptz default now(),
  last_active timestamptz,
  preferences jsonb default '{}'::jsonb,
  
  constraint valid_role check (role in ('customer', 'agent', 'admin'))
)
```

## Tickets System

### Tables

```sql
-- Ticket priority enum
create type ticket_priority as enum ('low', 'medium', 'high', 'urgent');

-- Tickets table (main reference)
create table tickets (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references organizations(id) not null,
  workflow_id uuid references workflows(id) not null,
  current_stage_id uuid references workflow_stages(id) not null,
  latest_history_id uuid,
  created_by uuid references profiles(id) not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  -- Ensure stage belongs to workflow
  constraint valid_stage_workflow foreign key (workflow_id, current_stage_id) 
    references workflow_stages(workflow_id, id)
);

-- Ticket history for tracking all changes
create table ticket_history (
  id uuid primary key default uuid_generate_v4(),
  ticket_id uuid references tickets(id) on delete cascade not null,
  title text not null,
  description text,
  priority ticket_priority not null default 'low',
  assigned_to uuid references profiles(id),
  workflow_stage_id uuid references workflow_stages(id) not null,
  changed_by uuid references profiles(id) not null,
  changed_at timestamptz default now(),
  previous_history_id uuid references ticket_history(id),
  changes jsonb not null -- Records what changed in this revision
);

-- Add foreign key for latest_history_id after both tables exist
alter table tickets 
  add constraint fk_latest_history 
  foreign key (latest_history_id) 
  references ticket_history(id);

-- Comments on tickets
create table ticket_comments (
  id uuid primary key default uuid_generate_v4(),
  ticket_id uuid references tickets(id) on delete cascade not null,
  content text not null,
  created_by uuid references profiles(id) not null,
  created_at timestamptz default now(),
  is_internal boolean default false -- For agent-only comments
);

-- Attachments
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

### Indexes
```sql
-- Core ticket access patterns
create index tickets_org_idx on tickets(org_id);
create index tickets_workflow_idx on tickets(workflow_id);
create index tickets_stage_idx on tickets(current_stage_id);
create index tickets_created_by_idx on tickets(created_by);

-- Composite indexes for common queries
create index tickets_org_workflow_idx on tickets(org_id, workflow_id);
create index tickets_org_stage_idx on tickets(org_id, current_stage_id);
create index tickets_workflow_stage_idx on tickets(workflow_id, current_stage_id);

-- History and timeline queries
create index ticket_history_ticket_idx on ticket_history(ticket_id);
create index ticket_history_stage_idx on ticket_history(workflow_stage_id);
create index ticket_history_changed_at_idx on ticket_history(changed_at);
create index ticket_history_assigned_idx on ticket_history(assigned_to);

-- Comment management
create index ticket_comments_ticket_idx on ticket_comments(ticket_id);
create index ticket_comments_created_at_idx on ticket_comments(created_at);
create index ticket_comments_internal_idx on ticket_comments(ticket_id) where is_internal = true;

-- Attachment organization
create index ticket_attachments_ticket_idx on ticket_attachments(ticket_id);
create index ticket_attachments_uploaded_at_idx on ticket_attachments(uploaded_at);
```

### Functions

```sql
-- Create ticket with initial history
create function create_ticket(
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
  -- Get workflow ID if not provided (earliest active workflow)
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
      'type', 'created',
      'fields', jsonb_build_object(
        'title', p_title,
        'description', p_description,
        'priority', p_priority,
        'stage', v_start_stage_id
      )
    )
  ) returning id into v_history_id;

  -- Update ticket with latest history
  update tickets
  set latest_history_id = v_history_id
  where id = v_ticket_id;

  return v_ticket_id;
end;
$$ language plpgsql security definer;

-- Get ticket details with latest state
create function get_ticket_details(p_ticket_id uuid)
returns json as $$
declare
  v_result json;
begin
  select json_build_object(
    'ticket', json_build_object(
      'id', t.id,
      'title', h.title,
      'description', h.description,
      'priority', h.priority,
      'currentStage', json_build_object(
        'id', ws.id,
        'name', ws.name,
        'description', ws.description
      ),
      'workflow', json_build_object(
        'id', w.id,
        'name', w.name
      ),
      'assignedTo', case when h.assigned_to is not null then
        json_build_object(
          'id', p.id,
          'name', p.name,
          'email', p.email
        )
      end,
      'createdBy', json_build_object(
        'id', cp.id,
        'name', cp.name
      ),
      'createdAt', t.created_at,
      'updatedAt', t.updated_at
    ),
    'comments', (
      select json_agg(json_build_object(
        'id', c.id,
        'content', c.content,
        'isInternal', c.is_internal,
        'createdBy', json_build_object(
          'id', cp.id,
          'name', cp.name
        ),
        'createdAt', c.created_at
      ))
      from ticket_comments c
      join profiles cp on cp.id = c.created_by
      where c.ticket_id = t.id
      and (
        not c.is_internal
        or exists (
          select 1 from profiles
          where auth_id = auth.uid()
          and role in ('admin', 'agent')
        )
      )
    ),
    'attachments', (
      select json_agg(json_build_object(
        'id', a.id,
        'fileName', a.file_name,
        'fileType', a.file_type,
        'fileSize', a.file_size,
        'uploadedBy', json_build_object(
          'id', up.id,
          'name', up.name
        ),
        'uploadedAt', a.uploaded_at
      ))
      from ticket_attachments a
      join profiles up on up.id = a.uploaded_by
      where a.ticket_id = t.id
    ),
    'history', (
      select json_agg(json_build_object(
        'id', h.id,
        'changes', h.changes,
        'changedBy', json_build_object(
          'id', cp.id,
          'name', cp.name
        ),
        'changedAt', h.changed_at
      ))
      from ticket_history h
      join profiles cp on cp.id = h.changed_by
      where h.ticket_id = t.id
      order by h.changed_at desc
    )
  ) into v_result
  from tickets t
  join ticket_history h on h.id = t.latest_history_id
  join workflow_stages ws on ws.id = t.current_stage_id
  join workflows w on w.id = t.workflow_id
  join profiles cp on cp.id = t.created_by
  left join profiles p on p.id = h.assigned_to
  where t.id = p_ticket_id;

  return v_result;
end;
$$ language plpgsql security definer;

-- List organization tickets with filtering
create function list_org_tickets(
  p_org_id uuid,
  p_filters jsonb default '{}'
) returns json as $$
declare
  v_result json;
  v_where text := 'where t.org_id = $1';
  v_params text[] := array[p_org_id::text];
  v_param_num int := 2;
begin
  -- Build where clause from filters
  if p_filters ? 'priority' then
    v_where := v_where || format(
      ' and h.priority = any($%s::ticket_priority[])',
      v_param_num
    );
    v_params := v_params || (p_filters->>'priority')::text[];
    v_param_num := v_param_num + 1;
  end if;

  -- Add more filter conditions as needed

  -- Execute dynamic query
  return query execute format('
    select json_build_object(
      ''tickets'', json_agg(json_build_object(
        ''id'', t.id,
        ''title'', h.title,
        ''priority'', h.priority,
        ''currentStage'', json_build_object(
          ''id'', ws.id,
          ''name'', ws.name
        ),
        ''assignedTo'', case when h.assigned_to is not null then
          json_build_object(
            ''id'', p.id,
            ''name'', p.name
          )
        end,
        ''createdAt'', t.created_at,
        ''updatedAt'', t.updated_at
      )),
      ''pagination'', json_build_object(
        ''total'', count(*) over(),
        ''page'', 1,
        ''perPage'', 20
      )
    )
    from tickets t
    join ticket_history h on h.id = t.latest_history_id
    join workflow_stages ws on ws.id = t.current_stage_id
    left join profiles p on p.id = h.assigned_to
    %s
  ', v_where) using v_params;
end;
$$ language plpgsql security definer;

### RLS Policies
```sql
-- Enable RLS on all ticket-related tables
alter table tickets enable row level security;
alter table ticket_history enable row level security;
alter table ticket_comments enable row level security;
alter table ticket_attachments enable row level security;

-- Ticket Visibility Policies
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
      join ticket_history h on h.assigned_to = p.id
      where p.auth_id = auth.uid()
      and h.ticket_id = tickets.id
      and h.id = tickets.latest_history_id
    )
    or
    created_by = (
      select id from profiles
      where auth_id = auth.uid()
    )
  );

-- Ticket History Policies
create policy "agent_full_history"
  on ticket_history for select
  to authenticated
  using (
    exists (
      select 1 from profiles p
      join tickets t on t.org_id = p.org_id
      where p.auth_id = auth.uid()
      and t.id = ticket_history.ticket_id
      and p.role in ('admin', 'agent')
    )
  );

create policy "user_limited_history"
  on ticket_history for select
  to authenticated
  using (
    exists (
      select 1 from tickets t
      join profiles p on p.org_id = t.org_id
      where t.id = ticket_history.ticket_id
      and p.auth_id = auth.uid()
      and p.role = 'customer'
      and (
        t.created_by = p.id
        or exists (
          select 1 from ticket_history h
          where h.ticket_id = t.id
          and h.assigned_to = p.id
        )
      )
    )
  );

-- Comment Policies
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

-- Attachment Policies
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
```

## Knowledge Base

### Required Tables
```sql
-- Articles table
create table articles (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  content text not null,
  categories text[] default '{}',
  tags text[] default '{}',
  author uuid references profiles(id) not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  version integer default 1
);

-- Article versions for version control
create table article_versions (
  id uuid primary key default uuid_generate_v4(),
  article_id uuid references articles(id) on delete cascade not null,
  content text not null,
  created_at timestamptz default now(),
  created_by uuid references profiles(id) not null
);

-- Categories for organization
create table categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  parent_id uuid references categories(id),
  created_at timestamptz default now()
);

-- Function to update article timestamp and version
create or replace function update_article_version()
returns trigger as $$
begin
  new.updated_at = now();
  new.version = old.version + 1;
  return new;
end;
$$ language plpgsql;

create trigger update_article_version
before update on articles
for each row
execute function update_article_version();
```

### Indexes
```sql
-- For article queries
create index articles_categories_idx using gin(categories);
create index articles_tags_idx using gin(tags);
create index article_versions_article_id_idx on article_versions(article_id);
create index categories_parent_id_idx on categories(parent_id);
```

## Notifications

### Decisions Made
1. Using Supabase real-time for ticket updates
2. 30-day retention policy for notifications
3. Real-time notifications for:
   - Ticket assignees
   - Ticket creators (users)

### Required Tables
```sql
-- Notification types enum
create type notification_type as enum (
  'ticket_created',
  'ticket_assigned',
  'ticket_updated',
  'ticket_commented',
  'ticket_resolved',
  'ticket_closed'
);

-- Notifications table
create table notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) not null,
  type notification_type not null,
  content jsonb not null,
  read boolean default false,
  created_at timestamptz default now(),
  expires_at timestamptz default (now() + interval '30 days')
);

-- Trigger function for ticket notifications
create or replace function create_ticket_notification()
returns trigger as $$
begin
  -- New ticket notification
  if TG_OP = 'INSERT' then
    insert into notifications (user_id, type, content)
    values (
      new.created_by,
      'ticket_created',
      jsonb_build_object(
        'ticket_id', new.id,
        'title', new.title
      )
    );
  
  -- Ticket assignment notification
  elsif TG_OP = 'UPDATE' and new.assigned_to is distinct from old.assigned_to then
    insert into notifications (user_id, type, content)
    values (
      new.assigned_to,
      'ticket_assigned',
      jsonb_build_object(
        'ticket_id', new.id,
        'title', new.title
      )
    );
  
  -- Status change notification
  elsif TG_OP = 'UPDATE' and new.status is distinct from old.status then
    insert into notifications (user_id, type, content)
    values (
      new.created_by,
      case new.status
        when 'resolved' then 'ticket_resolved'
        when 'closed' then 'ticket_closed'
        else 'ticket_updated'
      end,
      jsonb_build_object(
        'ticket_id', new.id,
        'title', new.title,
        'old_status', old.status,
        'new_status', new.status
      )
    );
  end if;
  
  return new;
end;
$$ language plpgsql;

-- Trigger for ticket notifications
create trigger ticket_notifications
after insert or update on tickets
for each row
execute function create_ticket_notification();

-- Trigger function for comment notifications
create or replace function create_comment_notification()
returns trigger as $$
begin
  -- Don't notify for internal comments
  if new.is_internal then
    return new;
  end if;

  -- Get the ticket creator and assignee
  insert into notifications (user_id, type, content)
  select 
    user_id,
    'ticket_commented',
    jsonb_build_object(
      'ticket_id', new.ticket_id,
      'comment_id', new.id,
      'commenter', new.created_by
    )
  from (
    select created_by as user_id from tickets where id = new.ticket_id
    union
    select assigned_to from tickets where id = new.ticket_id and assigned_to is not null
  ) users
  where user_id != new.created_by;  -- Don't notify the commenter
  
  return new;
end;
$$ language plpgsql;

-- Trigger for comment notifications
create trigger comment_notifications
after insert on ticket_comments
for each row
execute function create_comment_notification();

-- Enable real-time for notifications
alter publication supabase_realtime add table notifications;

-- Automated cleanup function
create or replace function cleanup_old_notifications()
returns void as $$
begin
  delete from notifications
  where expires_at < now();
end;
$$ language plpgsql;

-- Run cleanup daily
create extension if not exists pg_cron;
select cron.schedule('0 0 * * *', $$
  select cleanup_old_notifications();
$$);
```

### Indexes
```sql
-- For notification queries
create index notifications_user_id_idx on notifications(user_id);
create index notifications_created_at_idx on notifications(created_at);
create index notifications_expires_at_idx on notifications(expires_at);
```

### RLS Policies
```sql
-- Enable RLS
alter table notifications enable row level security;

-- Users can only see their own notifications
create policy "users_own_notifications"
  on notifications
  for all
  to authenticated
  using (
    user_id = (
      select id from profiles
      where auth_id = auth.uid()
    )
  );
```

## Organizations & Invites

### Required Tables
```sql
-- Organizations table
create table organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  created_at timestamptz default now(),
  created_by uuid references profiles(id) not null
);

-- Organization members with org-specific roles
create table org_members (
  org_id uuid references organizations(id) not null,
  user_id uuid references profiles(id) not null,
  org_role text not null check (org_role in ('org_admin', 'org_agent', 'org_customer')),
  added_at timestamptz default now(),
  added_by uuid references profiles(id) not null,
  primary key (org_id, user_id)
);

-- Invite codes for initial admin setup
create table admin_invite_codes (
  code text primary key,
  created_at timestamptz default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references profiles(id)
);

-- Organization invites
create table org_invites (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references organizations(id) not null,
  email text not null,
  role user_role not null,
  created_at timestamptz default now(),
  expires_at timestamptz not null,
  created_by uuid references profiles(id) not null,
  used_at timestamptz,
  used_by uuid references profiles(id)
);

-- Modified profile creation trigger to use env var for initial admin
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (auth_id, name, role, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    case 
      when new.email = current_setting('app.initial_admin_email', true) then 'admin'
      else 'customer'
    end,
    new.email
  );
  return new;
end;
$$ language plpgsql security definer;

-- Note: Set the following environment variable in Supabase:
-- app.initial_admin_email = 'your-admin@email.com'
```

### RLS Policies
```sql
-- Organizations
alter table organizations enable row level security;

-- Allow customers to create orgs
create policy "create_org"
  on organizations
  for insert
  to authenticated
  with check (
    exists (
      select 1 from profiles
      where profiles.auth_id = auth.uid()
      and (profiles.role = 'admin' or profiles.role = 'customer')
    )
  );

-- Creator automatically becomes org_admin
create or replace function handle_new_org()
returns trigger as $$
begin
  insert into org_members (org_id, user_id, org_role, added_by)
  values (new.id, new.created_by, 'org_admin', new.created_by);
  return new;
end;
$$ language plpgsql;

create trigger on_org_created
  after insert on organizations
  for each row
  execute function handle_new_org();

-- Org members can view their org
create policy "view_own_org"
  on organizations
  for select
  to authenticated
  using (
    exists (
      select 1 from org_members
      where org_members.org_id = organizations.id
      and org_members.user_id = (
        select id from profiles
        where auth_id = auth.uid()
      )
    )
  );

-- Only org admins can modify their org
create policy "manage_own_org"
  on organizations
  for update
  to authenticated
  using (
    exists (
      select 1 from org_members
      where org_members.org_id = organizations.id
      and org_members.user_id = (
        select id from profiles
        where auth_id = auth.uid()
      )
      and org_members.org_role = 'org_admin'
    )
  );
```

## Environment Setup

### Required Environment Variables
```sql
-- Set up initial admin email
ALTER DATABASE postgres 
SET "app.initial_admin_email" = 'your-admin@email.com';

-- Note: Replace 'your-admin@email.com' with the actual admin email
-- This needs to be run once during initial setup
-- The handle_new_user() trigger will use this to identify the admin user during signup
```

### Views and Materialized Views
```sql
-- Agent view of tickets with full details
create materialized view agent_tickets as
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
  p_assigned.name as assigned_to_name,
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
join ticket_history h on h.id = t.latest_history_id
join workflows w on w.id = t.workflow_id
join workflow_stages ws on ws.id = t.current_stage_id
left join profiles p_assigned on p_assigned.id = h.assigned_to
join profiles p_created on p_created.id = t.created_by;

create index agent_tickets_org_workflow_idx on agent_tickets(org_id, workflow_id);
create index agent_tickets_priority_idx on agent_tickets(priority);
create index agent_tickets_assigned_to_idx on agent_tickets(assigned_to);

-- Customer view of tickets (limited details)
create view customer_tickets as
select 
  t.id,
  h.title,
  h.priority,
  ws.name as stage_name,
  case 
    when p_assigned.role in ('admin', 'agent') then 'Support Team'
    else p_assigned.name
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
join ticket_history h on h.id = t.latest_history_id
join workflow_stages ws on ws.id = t.current_stage_id
left join profiles p_assigned on p_assigned.id = h.assigned_to
where exists (
  select 1 from profiles p
  where p.auth_id = auth.uid()
  and (
    t.created_by = p.id
    or h.assigned_to = p.id
  )
);

-- Workflow stage statistics
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

-- Additional indexes for common queries
create index tickets_latest_history_idx on tickets(latest_history_id);
create index ticket_history_priority_idx on ticket_history(priority);
create index tickets_updated_at_idx on tickets(updated_at desc);
create index tickets_org_updated_idx on tickets(org_id, updated_at desc);
create index tickets_workflow_priority_idx on tickets(workflow_id, (
  select priority from ticket_history 
  where id = tickets.latest_history_id
));

-- Refresh strategy for materialized views
create function refresh_ticket_stats()
returns void as $$
begin
  refresh materialized view concurrently workflow_stage_stats;
  refresh materialized view concurrently agent_tickets;
end;
$$ language plpgsql;

-- Set up periodic refresh (every 5 minutes)
select cron.schedule(
  'refresh_ticket_stats',
  '*/5 * * * *',
  $$select refresh_ticket_stats()$$
);
``` 
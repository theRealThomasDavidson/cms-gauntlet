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

## Tickets

### Required Tables
```sql
-- Enum for ticket status
create type ticket_status as enum ('new', 'open', 'pending', 'resolved', 'closed');
create type ticket_priority as enum ('low', 'medium', 'high', 'urgent');

-- Main tickets table (simplified to just reference latest state)
create table tickets (
  id uuid primary key default uuid_generate_v4(),
  latest_history_id uuid,
  created_at timestamptz default now(),
  created_by uuid references profiles(id) not null
);

-- Ticket history with complete state snapshots
create table ticket_history (
  id uuid primary key default uuid_generate_v4(),
  ticket_id uuid references tickets(id) on delete cascade not null,
  previous_state_id uuid references ticket_history(id),
  title text not null,
  description text not null,
  status ticket_status not null default 'new',
  priority ticket_priority not null default 'low',
  assigned_to uuid references profiles(id),
  custom_fields jsonb default '{}'::jsonb,
  tags text[] default '{}',
  changed_by uuid references profiles(id) not null,
  changed_at timestamptz default now(),
  change_reason text,
  changes jsonb not null -- Stores what actually changed in this revision
);

-- Comments table for ticket discussions
create table ticket_comments (
  id uuid primary key default uuid_generate_v4(),
  ticket_id uuid references tickets(id) on delete cascade not null,
  content text not null,
  created_by uuid references profiles(id) not null,
  created_at timestamptz default now(),
  is_internal boolean default false
);

-- Tags table for better organization and searching
create table tags (
  id uuid primary key default uuid_generate_v4(),
  name text unique not null,
  description text,
  created_at timestamptz default now()
);

-- Add foreign key constraint after both tables exist
alter table tickets 
add constraint fk_latest_history 
foreign key (latest_history_id) 
references ticket_history(id);

-- Function to create initial history entry
create or replace function create_initial_ticket_history()
returns trigger as $$
declare
  history_id uuid;
begin
  -- Create initial history entry
  insert into ticket_history (
    ticket_id,
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
    new.id,
    '', -- These will be provided in the next update
    '',
    'new',
    'low',
    null,
    '{}'::jsonb,
    '{}',
    new.created_by,
    '{}'::jsonb
  ) returning id into history_id;

  -- Update ticket with the history reference
  update tickets 
  set latest_history_id = history_id
  where id = new.id;

  return new;
end;
$$ language plpgsql security definer;

-- Function to update history
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

### RLS Policies
```sql
-- Tickets visibility
alter table tickets enable row level security;

-- Admins can see all tickets
create policy "admins_all_tickets"
  on tickets
  for all
  to authenticated
  using (exists (
    select 1 from profiles
    where profiles.auth_id = auth.uid()
    and profiles.role = 'admin'
  ));

-- Agents can see tickets assigned to their teams
create policy "agents_team_tickets"
  on tickets
  for all
  to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.auth_id = auth.uid()
      and profiles.role = 'agent'
      and (
        tickets.assigned_to = profiles.id
        or tickets.assigned_to = any(profiles.teams)
      )
    )
  );

-- Customers can only see their own tickets
create policy "customers_own_tickets"
  on tickets
  for all
  to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.auth_id = auth.uid()
      and profiles.role = 'customer'
      and tickets.created_by = profiles.id
    )
  );
```

### Indexes
```sql
-- For ticket queries
create index tickets_status_idx on tickets(status);
create index tickets_priority_idx on tickets(priority);
create index tickets_assigned_to_idx on tickets(assigned_to);
create index tickets_created_by_idx on tickets(created_by);
create index tickets_tags_idx using gin(tags);

-- For comments
create index ticket_comments_ticket_id_idx on ticket_comments(ticket_id);
```

### Open Questions

#### Ticket Assignment
1. Should we track assignment history?
2. Do we need SLA tracking fields?
3. Should we add ticket categories separate from tags?

#### Custom Fields
1. Should we validate custom_fields structure?
2. Do we need predefined custom field types?

#### Row Level Security (RLS)
1. Customer Data Access:
   - Should customers only see their own tickets?
   - What about shared organization tickets?
   - Can customers see other customers' public comments?

#### Team Management
1. Team Structure:
   - Can users belong to multiple teams?
   - Do we need team hierarchies?
   - Should team permissions be granular or role-based?

#### Profile Data
1. Organization Structure:
   - Do we need organization/company grouping?
   - Should customers be grouped by organization?
   - How does this affect ticket visibility?

2. Agent Specialization:
   - Do we need to track agent skills/specialties?
   - Should this affect ticket routing?

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
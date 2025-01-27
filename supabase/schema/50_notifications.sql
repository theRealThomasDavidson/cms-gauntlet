 -- Drop existing objects if they exist
drop table if exists notification_logs cascade;
drop table if exists notification_rules cascade;
drop table if exists notification_templates cascade;
drop type if exists notification_type cascade;
drop type if exists notification_status cascade;

-- Create enums
create type notification_type as enum (
  'ticket_created',
  'ticket_updated',
  'ticket_stage_changed',
  'ticket_assigned',
  'ticket_commented',
  'ticket_priority_changed'
);

create type notification_status as enum (
  'pending',
  'sent',
  'failed',
  'cancelled'
);

-- Create notification templates table
create table notification_templates (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references organizations(id),
  name text ,
  description text,
  subject_template text ,
  body_template text not null,
  notification_type notification_type ,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references profiles(id) ,
  -- Ensure unique template names within an org
  unique(org_id, name)
);

-- Create notification rules table
create table notification_rules (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references organizations(id) not null,
  workflow_id uuid references workflows(id),
  stage_id uuid references workflow_stages(id),
  template_id uuid references notification_templates(id) not null,
  notification_type notification_type not null,
  -- Who should receive the notification
  notify_creator boolean default false,
  notify_assignee boolean default false,
  notify_org_admins boolean default false,
  notify_specific_users uuid[] default array[]::uuid[],
  notify_roles user_role[] default array[]::user_role[],
  -- When should the notification be sent
  conditions jsonb default '{}'::jsonb,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references profiles(id) not null,
  -- Validate that at least one notification target is selected
  constraint at_least_one_target check (
    notify_creator or 
    notify_assignee or 
    notify_org_admins or 
    array_length(notify_specific_users, 1) > 0 or
    array_length(notify_roles, 1) > 0
  )
);

-- Create notification logs table
create table notification_logs (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references organizations(id) not null,
  rule_id uuid references notification_rules(id),
  template_id uuid references notification_templates(id),
  ticket_id uuid references tickets(id) not null,
  recipient_id uuid references profiles(id),
  recipient_role user_role,
  notification_type notification_type not null,
  status notification_status not null default 'pending',
  subject text not null,
  body text not null,
  error_message text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  sent_at timestamptz,
  external_id text,
  -- Ensure either recipient_id or recipient_role is set
  constraint notification_target_check check (
    (recipient_id is not null and recipient_role is null) or
    (recipient_id is null and recipient_role is not null)
  )
);
drop table if exists notification_reads;
-- Create notification_reads table
create table notification_reads (
  id uuid primary key default uuid_generate_v4(),
  notification_id uuid references notification_logs(id) on delete cascade not null,
  user_id uuid references profiles(id) not null,
  read_at timestamptz default now(),
  created_at timestamptz default now(),
  -- Ensure one read status per user per notification
  unique(notification_id, user_id)
);

-- Create index for faster lookups
create index notification_reads_user_idx on notification_reads(user_id);
create index notification_reads_notification_idx on notification_reads(notification_id);

-- Create indexes
create index notification_templates_org_idx on notification_templates(org_id);
create index notification_rules_org_idx on notification_rules(org_id);
create index notification_rules_workflow_idx on notification_rules(workflow_id);
create index notification_rules_stage_idx on notification_rules(stage_id);
create index notification_logs_org_idx on notification_logs(org_id);
create index notification_logs_ticket_idx on notification_logs(ticket_id);
create index notification_logs_status_idx on notification_logs(status);
create index notification_logs_created_idx on notification_logs(created_at);

-- Enable RLS
alter table notification_templates enable row level security;
alter table notification_rules enable row level security;
alter table notification_logs enable row level security;
alter table notification_reads enable row level security;

-- RLS Policies

-- Notification Templates policies
create policy "org members can view notification templates"
  on notification_templates for select
  to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.auth_id = auth.uid()
      and p.org_id = notification_templates.org_id
    )
  );

create policy "admins can manage notification templates"
  on notification_templates for all
  to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.auth_id = auth.uid()
      and p.org_id = notification_templates.org_id
      and p.role = 'admin'
    )
  );

-- Notification Rules policies
create policy "org members can view notification rules"
  on notification_rules for select
  to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.auth_id = auth.uid()
      and p.org_id = notification_rules.org_id
    )
  );

create policy "admins can manage notification rules"
  on notification_rules for all
  to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.auth_id = auth.uid()
      and p.org_id = notification_rules.org_id
      and p.role = 'admin'
    )
  );

-- Notification Logs policies
create policy "users can view their notification logs"
  on notification_logs for select
  to authenticated
  using (
    -- Can see notifications meant for them specifically
    recipient_id = (select id from profiles where auth_id = auth.uid())
    -- Can see notifications meant for their role
    or recipient_role = (select role from profiles where auth_id = auth.uid())
    -- Admins can see all notifications for their org
    or exists (
      select 1 from profiles p
      where p.auth_id = auth.uid()
      and p.org_id = notification_logs.org_id
      and p.role = 'admin'
    )
  );

-- Notification Reads policies
create policy "users can view their notification reads"
  on notification_reads for select
  to authenticated
  using (user_id = (select id from profiles where auth_id = auth.uid()));

create policy "users can mark notifications as read"
  on notification_reads for insert
  to authenticated
  with check (
    user_id = (select id from profiles where auth_id = auth.uid())
    and exists (
      select 1 from notification_logs n
      where n.id = notification_id
      and (
        -- Can mark if it's meant for them specifically
        n.recipient_id = user_id
        -- Or if it's meant for their role
        or n.recipient_role = (select role from profiles where id = user_id)
      )
    )
  );

-- Helper Functions

-- Function to get notification recipients for a ticket
create or replace function get_notification_recipients(
  p_ticket_id uuid,
  p_rule_id uuid
)
returns setof uuid
language plpgsql
security definer
as $$
declare
  v_rule notification_rules;
  v_ticket_creator uuid;
  v_ticket_assignee uuid;
begin
  -- Get the rule
  select * into v_rule
  from notification_rules
  where id = p_rule_id;

  -- Get ticket details
  select 
    t.created_by,
    h.assigned_to
  into 
    v_ticket_creator,
    v_ticket_assignee
  from tickets t
  join ticket_history h on h.id = t.latest_history_id
  where t.id = p_ticket_id;

  -- Return creator if configured
  if v_rule.notify_creator then
    return next v_ticket_creator;
  end if;

  -- Return assignee if configured and assigned
  if v_rule.notify_assignee and v_ticket_assignee is not null then
    return next v_ticket_assignee;
  end if;

  -- Return org admins if configured
  if v_rule.notify_org_admins then
    return query
    select p.id
    from profiles p
    where p.org_id = v_rule.org_id
    and p.role = 'admin';
  end if;

  -- Return specific users
  if array_length(v_rule.notify_specific_users, 1) > 0 then
    return query
    select unnest(v_rule.notify_specific_users);
  end if;

  -- Return users with specific roles
  if array_length(v_rule.notify_roles, 1) > 0 then
    return query
    select p.id
    from profiles p
    where p.org_id = v_rule.org_id
    and p.role = any(v_rule.notify_roles);
  end if;
end;
$$;

-- Function to create a notification template
create or replace function create_notification_template(
  p_name text,
  p_description text,
  p_subject_template text,
  p_body_template text,
  p_notification_type notification_type
)
returns notification_templates
language plpgsql
security definer
as $$
declare
  v_template notification_templates;
  v_org_id uuid;
  v_profile_id uuid;
begin
  -- Get org_id and profile_id
  select org_id, id into v_org_id, v_profile_id
  from profiles
  where auth_id = auth.uid();

  -- Create template
  insert into notification_templates (
    org_id,
    name,
    description,
    subject_template,
    body_template,
    notification_type,
    created_by
  ) values (
    v_org_id,
    p_name,
    p_description,
    p_subject_template,
    p_body_template,
    p_notification_type,
    v_profile_id
  )
  returning * into v_template;

  return v_template;
end;
$$;

-- Function to create a notification rule
create or replace function create_notification_rule(
  p_workflow_id uuid,
  p_stage_id uuid,
  p_template_id uuid,
  p_notification_type notification_type,
  p_notify_creator boolean,
  p_notify_assignee boolean,
  p_notify_org_admins boolean,
  p_notify_specific_users uuid[],
  p_notify_roles user_role[],
  p_conditions jsonb default '{}'::jsonb
)
returns notification_rules
language plpgsql
security definer
as $$
declare
  v_rule notification_rules;
  v_org_id uuid;
  v_profile_id uuid;
begin
  -- Get org_id and profile_id
  select org_id, id into v_org_id, v_profile_id
  from profiles
  where auth_id = auth.uid();

  -- Create rule
  insert into notification_rules (
    org_id,
    workflow_id,
    stage_id,
    template_id,
    notification_type,
    notify_creator,
    notify_assignee,
    notify_org_admins,
    notify_specific_users,
    notify_roles,
    conditions,
    created_by
  ) values (
    v_org_id,
    p_workflow_id,
    p_stage_id,
    p_template_id,
    p_notification_type,
    p_notify_creator,
    p_notify_assignee,
    p_notify_org_admins,
    p_notify_specific_users,
    p_notify_roles,
    p_conditions,
    v_profile_id
  )
  returning * into v_rule;

  return v_rule;
end;
$$;

-- Grant execute permissions
grant execute on function get_notification_recipients(uuid, uuid) to authenticated;
grant execute on function create_notification_template(text, text, text, text, notification_type) to authenticated;
grant execute on function create_notification_rule(uuid, uuid, uuid, notification_type, boolean, boolean, boolean, uuid[], user_role[], jsonb) to authenticated;


-- Function to process ticket stage change for notifications
create or replace function process_ticket_stage_change()
returns trigger
language plpgsql
security definer
as $$
declare
  v_org_id uuid;
  v_rule notification_rules;
  v_template notification_templates;
  v_recipient_id uuid;
  v_ticket record;
  v_old_stage text;
  v_new_stage text;
begin
  -- Get ticket details with old and new stage names
  select 
    t.*,
    old_stage.name as old_stage_name,
    new_stage.name as new_stage_name,
    org.id as org_id
  into v_ticket
  from tickets t
  join organizations org on org.id = t.org_id
  left join workflow_stages old_stage on old_stage.id = OLD.current_stage_id
  left join workflow_stages new_stage on new_stage.id = NEW.current_stage_id
  where t.id = NEW.id;

  v_org_id := v_ticket.org_id;
  v_old_stage := v_ticket.old_stage_name;
  v_new_stage := v_ticket.new_stage_name;

  -- Find applicable notification rules
  for v_rule in
    select r.*
    from notification_rules r
    where r.org_id = v_org_id
    and r.is_active = true
    and r.notification_type = 'ticket_stage_changed'
    and (
      r.workflow_id is null 
      or r.workflow_id = NEW.workflow_id
    )
    and (
      r.stage_id is null 
      or r.stage_id = NEW.current_stage_id
    )
  loop
    -- Get template
    select * into v_template
    from notification_templates
    where id = v_rule.template_id
    and is_active = true;

    if v_template.id is null then
      continue;
    end if;

    -- Create notification for each recipient
    for v_recipient_id in
      select * from get_notification_recipients(NEW.id, v_rule.id)
    loop
      insert into notification_logs (
        org_id,
        rule_id,
        template_id,
        ticket_id,
        recipient_id,
        notification_type,
        subject,
        body,
        metadata
      ) values (
        v_org_id,
        v_rule.id,
        v_template.id,
        NEW.id,
        v_recipient_id,
        'ticket_stage_changed',
        replace(
          replace(v_template.subject_template, '{{old_stage}}', v_old_stage),
          '{{new_stage}}', v_new_stage
        ),
        replace(
          replace(v_template.body_template, '{{old_stage}}', v_old_stage),
          '{{new_stage}}', v_new_stage
        ),
        jsonb_build_object(
          'old_stage_id', OLD.current_stage_id,
          'new_stage_id', NEW.current_stage_id,
          'old_stage_name', v_old_stage,
          'new_stage_name', v_new_stage
        )
      );
    end loop;
  end loop;

  return NEW;
end;
$$;

-- Drop existing trigger first
drop trigger if exists ticket_history_notification_trigger on ticket_history;

-- Create trigger for ticket stage changes
drop trigger if exists on_ticket_stage_change on tickets;
create trigger on_ticket_stage_change
  after update of current_stage_id
  on tickets
  for each row
  when (OLD.current_stage_id is distinct from NEW.current_stage_id)
  execute function process_ticket_stage_change();

-- Function to get pending notifications
create or replace function get_pending_notifications(
  p_limit int default 100
)
returns table (
  id uuid,
  org_id uuid,
  ticket_id uuid,
  recipient_id uuid,
  recipient_email text,
  subject text,
  body text,
  metadata jsonb
)
language sql
security definer
as $$
  select 
    n.id,
    n.org_id,
    n.ticket_id,
    n.recipient_id,
    p.email as recipient_email,
    n.subject,
    n.body,
    n.metadata
  from notification_logs n
  join profiles p on p.id = n.recipient_id
  where n.status = 'pending'
  order by n.created_at asc
  limit p_limit;
$$;

-- Function to mark notification as sent
create or replace function mark_notification_sent(
  p_notification_id uuid,
  p_external_id text default null
)
returns void
language sql
security definer
as $$
  update notification_logs
  set 
    status = 'sent',
    sent_at = now(),
    external_id = p_external_id
  where id = p_notification_id;
$$;

-- Function to mark notification as failed
create or replace function mark_notification_failed(
  p_notification_id uuid,
  p_error_message text
)
returns void
language sql
security definer
as $$
  update notification_logs
  set 
    status = 'failed',
    error_message = p_error_message
  where id = p_notification_id;
$$;

-- Grant execute permissions
grant execute on function get_pending_notifications(int) to authenticated;
grant execute on function mark_notification_sent(uuid, text) to authenticated;
grant execute on function mark_notification_failed(uuid, text) to authenticated;

-- Drop existing functions first
drop function if exists get_user_notifications cascade;

-- Create new function matching the working query
create or replace function get_user_notifications(
  p_limit int default 50,
  p_status notification_status default 'pending',
  p_include_read boolean default false
) returns table (
  id uuid,
  subject text,
  body text,
  status notification_status,
  created_at timestamptz,
  metadata jsonb,
  notification_type notification_type,
  recipient_role user_role,
  recipient_id uuid,
  ticket_id uuid
) as $$
declare
  v_user_id uuid;
  v_role user_role;
begin
  -- Get current user's profile ID and role
  select p.id, role into v_user_id, v_role
  from profiles p
  where auth_id = auth.uid();

  return query
  select 
    n.id,
    n.subject,
    n.body,
    n.status,
    n.created_at,
    n.metadata,
    n.notification_type,
    n.recipient_role,
    n.recipient_id,
    n.ticket_id
  from notification_logs n
  where (n.recipient_id = v_user_id or n.recipient_role = v_role)
    and (p_status is null or n.status = p_status)
  order by n.created_at desc
  limit p_limit;
end;
$$ language plpgsql security definer;

-- Grant execute permissions
grant execute on function get_user_notifications(int, notification_status, boolean) to authenticated;

-- Enable realtime for notifications (Supabase specific)
alter publication supabase_realtime add table notification_logs;

-- Enable full replica identity for realtime
alter table notification_logs replica identity full;

-- Add realtime flag in table comment
comment on table notification_logs is E'@realtime\nBroadcasts notifications in realtime.';

-- Add realtime security policy
create policy "enable realtime for authenticated users"
  on notification_logs
  for select
  to authenticated
  using (
    auth.role() = 'authenticated'
    and (
      -- User-specific notifications
      recipient_id = (select id from profiles where auth_id = auth.uid())
      -- Role-based notifications
      or recipient_role = (select role from profiles where auth_id = auth.uid())
      -- Admins can see all org notifications
      or exists (
        select 1 from profiles p
        where p.auth_id = auth.uid()
        and p.org_id = notification_logs.org_id
        and p.role = 'admin'
      )
    )
  );

-- Add policy for insert (needed for triggers to create notifications)
create policy "system can create notifications"
  on notification_logs
  for insert
  with check (true);  -- Allow system to create notifications via triggers

-- Drop the old function first
drop function if exists check_notification_hooks() cascade;

-- Create the new simplified version
create or replace function check_notification_hooks()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into notification_logs (
    org_id,
    rule_id,
    ticket_id,
    recipient_id,
    recipient_role,
    notification_type,
    status,
    subject,
    body,
    metadata
  )
  select 
    t.org_id,
    null,
    NEW.ticket_id,
    case 
      when h.config->>'target_type' = 'specific_user' then (h.config->>'target_user_id')::uuid
      else null
    end,
    case 
      when h.config->>'target_type' = 'role' then (h.config->>'target_role')::user_role
      else null
    end,
    'ticket_stage_changed'::notification_type,
    'pending'::notification_status,
    h.config->>'message',
    h.config->>'message',
    jsonb_build_object(
      'hook_id', h.id,
      'stage_id', NEW.workflow_stage_id,
      'previous_stage_id', OLD.workflow_stage_id
    )
  from workflow_stage_hooks h
  join tickets t on t.id = NEW.ticket_id
  where h.stage_id = NEW.workflow_stage_id
  and h.hook_type = 'notification'
  and h.is_active = true;

  return NEW;
end;
$$;

-- Recreate the trigger
drop trigger if exists check_notification_hooks_trigger on ticket_history;
create trigger check_notification_hooks_trigger
  after insert
  on ticket_history
  for each row
  execute function check_notification_hooks();

-- Create default template for hook notifications
insert into notification_templates (
  org_id,
  name,
  description,
  subject_template,
  body_template,
  notification_type,
  created_by
) values (
  (select org_id from profiles where role = 'admin' limit 1),
  'Default Hook Template',
  'Default template for workflow hook notifications',
  '{message}',
  '{message}',
  'ticket_stage_changed',
  (select id from profiles where role = 'admin' limit 1)
)
returning id;

-- Function to get unread notification count
create or replace function get_unread_notification_count()
returns integer
security definer
language plpgsql
as $$
declare
  v_user_id uuid;
  v_role user_role;
  v_count integer;
begin
  -- Get current user's profile ID and role
  select id, role into v_user_id, v_role
  from profiles
  where auth_id = auth.uid();

  -- Count unread notifications
  select count(*)::integer into v_count
  from notification_logs n
  left join notification_reads nr on nr.notification_id = n.id and nr.user_id = v_user_id
  where (n.recipient_id = v_user_id or n.recipient_role = v_role)
    and nr.id is null  -- Only unread
    and n.status = 'pending';  -- Only pending notifications

  return v_count;
end;
$$;

-- Grant execute permission
grant execute on function get_unread_notification_count() to authenticated;

-- Create a function that will be called by the trigger
create or replace function notify_ticket_update()
returns trigger as $$
begin
  -- Only notify if there are actual changes
  if OLD.title != NEW.title 
     or OLD.description != NEW.description 
     or OLD.status != NEW.status 
     or OLD.priority != NEW.priority then
    
    -- Create notification for the ticket creator
    insert into notification_logs (
      subject,
      body,
      status,
      notification_type,
      recipient_id,
      org_id,
      ticket_id,
      metadata
    ) values (
      'Ticket Updated: ' || NEW.title,
      case 
        when OLD.status != NEW.status then 'Ticket status changed to: ' || NEW.status
        when OLD.priority != NEW.priority then 'Ticket priority changed to: ' || NEW.priority
        else 'Ticket details have been updated'
      end,
      'pending',
      'ticket_stage_changed',
      NEW.created_by,
      NEW.org_id,
      NEW.id,
      jsonb_build_object(
        'changes', jsonb_build_object(
          'title', case when OLD.title != NEW.title then jsonb_build_object('old', OLD.title, 'new', NEW.title) else null end,
          'description', case when OLD.description != NEW.description then jsonb_build_object('old', OLD.description, 'new', NEW.description) else null end,
          'status', case when OLD.status != NEW.status then jsonb_build_object('old', OLD.status, 'new', NEW.status) else null end,
          'priority', case when OLD.priority != NEW.priority then jsonb_build_object('old', OLD.priority, 'new', NEW.priority) else null end
        )
      )
    );
  end if;
  
  return NEW;
end;
$$ language plpgsql security definer;

-- Create the trigger
drop trigger if exists notify_ticket_update_trigger on tickets;
create trigger notify_ticket_update_trigger
  after update
  on tickets
  for each row
  execute function notify_ticket_update();
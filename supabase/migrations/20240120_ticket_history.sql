-- Enable extensions
create extension if not exists "uuid-ossp";

-- Drop existing tables and functions if they exist
drop trigger if exists update_ticket_timestamp on tickets;
drop function if exists update_ticket_timestamp();
drop table if exists ticket_comments;
drop table if exists tickets;
drop type if exists ticket_status;
drop type if exists ticket_priority;

-- Recreate types
create type ticket_status as enum ('new', 'open', 'pending', 'resolved', 'closed');
create type ticket_priority as enum ('low', 'medium', 'high', 'urgent');

-- Main tickets table (simplified to just reference latest state)
create table tickets (
  id uuid primary key default uuid_generate_v4(),
  latest_history_id uuid,
  created_at timestamptz default now(),
  created_by uuid references auth.users(id) not null
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
  assigned_to uuid references auth.users(id),
  custom_fields jsonb default '{}'::jsonb,
  tags text[] default '{}',
  changed_by uuid references auth.users(id) not null,
  changed_at timestamptz default now(),
  change_reason text,
  changes jsonb not null
);

-- Add foreign key constraint
alter table tickets 
add constraint fk_latest_history 
foreign key (latest_history_id) 
references ticket_history(id);

-- Comments table
create table ticket_comments (
  id uuid primary key default uuid_generate_v4(),
  ticket_id uuid references tickets(id) on delete cascade not null,
  content text not null,
  created_by uuid references auth.users(id) not null,
  created_at timestamptz default now(),
  is_internal boolean default false
);

-- Create indexes
create index ticket_history_previous_state_idx on ticket_history(previous_state_id);
create index ticket_history_ticket_id_idx on ticket_history(ticket_id);
create index ticket_comments_ticket_id_idx on ticket_comments(ticket_id);

-- Enable RLS
alter table tickets enable row level security;
alter table ticket_history enable row level security;
alter table ticket_comments enable row level security;

-- RLS Policies
create policy "users can view their tickets"
  on tickets for select
  to authenticated
  using (created_by = auth.uid());

create policy "users can insert their tickets"
  on tickets for insert
  to authenticated
  with check (created_by = auth.uid());

create policy "users can view history of their tickets"
  on ticket_history for select
  to authenticated
  using (
    exists (
      select 1 from tickets
      where tickets.id = ticket_history.ticket_id
      and tickets.created_by = auth.uid()
    )
  );

create policy "users can view comments on their tickets"
  on ticket_comments for select
  to authenticated
  using (
    exists (
      select 1 from tickets
      where tickets.id = ticket_comments.ticket_id
      and tickets.created_by = auth.uid()
    )
  );

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
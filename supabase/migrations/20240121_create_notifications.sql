-- Create notifications table
create table notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) not null,
  message text not null,
  ticket_id uuid references tickets(id),
  is_read boolean default false,
  created_at timestamptz default now()
);

-- Create indexes
create index notifications_user_id_idx on notifications(user_id);
create index notifications_ticket_id_idx on notifications(ticket_id);
create index notifications_created_at_idx on notifications(created_at);

-- Enable RLS
alter table notifications enable row level security;

-- RLS policies
create policy "Users can view their own notifications"
  on notifications for select
  using (auth.uid() in (
    select auth_id from profiles where id = notifications.user_id
  ));

create policy "Users can mark their notifications as read"
  on notifications for update
  using (auth.uid() in (
    select auth_id from profiles where id = notifications.user_id
  ))
  with check (
    auth.uid() in (
      select auth_id from profiles where id = notifications.user_id
    ) and
    (
      case when is_read is distinct from notifications.is_read then true
      else false end
    )
  ); 
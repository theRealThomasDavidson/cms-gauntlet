-- Drop existing objects if they exist
drop function if exists get_or_create_default_org cascade;
drop table if exists organizations cascade;

-- Create organizations table
create table organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  created_at timestamptz default now(),
  created_by uuid references profiles(id) not null,
  is_active boolean default true,
  is_default boolean default false
);

-- Enable RLS
alter table organizations enable row level security;

-- Create indexes
create index organizations_name_idx on organizations(name);

-- RLS Policies
create policy "authenticated users can view organizations"
  on organizations for select
  to authenticated
  using (true);

create policy "admins can manage organizations"
  on organizations for all
  to authenticated
  using (
    exists (
      select 1 from profiles
      where auth_id = auth.uid()
      and role = 'admin'
    )
  );

-- Function to get or create default org
create or replace function get_or_create_default_org()
returns uuid as $$
declare
  default_org_id uuid;
  admin_id uuid;
begin
  -- Check if default org exists
  select id into default_org_id
  from organizations
  where is_default = true;

  if default_org_id is null then
    -- Get the first admin user
    select id into admin_id
    from profiles
    where role = 'admin'
    limit 1;

    -- Create default org
    insert into organizations (name, created_by, is_default)
    values ('Default Organization', admin_id, true)
    returning id into default_org_id;
  end if;

  return default_org_id;
end;
$$ language plpgsql security definer; 
-- Drop existing objects if they exist
drop function if exists get_or_create_default_org cascade;
drop table if exists organizations cascade;

-- Create organizations table
create table organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  created_at timestamptz default now(),
  is_active boolean default true,
  is_default boolean default false
);

-- Enable RLS
alter table organizations enable row level security;

-- Drop existing policies
drop policy if exists "Allow public viewing of organizations" on organizations;
drop policy if exists "Allow organization management by admins" on organizations;

-- Create indexes
create index organizations_name_idx on organizations(name);

-- Allow the function to create organizations
create policy "allow function to create organizations"
  on organizations for insert
  with check (true);

-- Allow anyone to view organizations
create policy "anyone can view organizations"
  on organizations for select
  using (true);

-- Only admins can modify organizations
create policy "Allow organization management by admins"
  on organizations for all using (
    auth.jwt() ->> 'role' = 'admin'
  );

-- Function to get or create default org
create or replace function get_or_create_default_org()
returns uuid
security definer
set search_path = public
language plpgsql
as $$
declare
  default_org_id uuid;
begin
  -- Check if default org exists
  select id into default_org_id
  from organizations
  where is_default = true
  limit 1;

  if default_org_id is null then
    -- Create default org
    insert into organizations (name, is_default)
    values ('Default Organization', true)
    returning id into default_org_id;
  end if;

  return default_org_id;
end;
$$;

-- Grant execute permission on get_or_create_default_org
grant execute on function get_or_create_default_org() to authenticated;

-- Note: The admin policy will be added in 2_user_profiles.sql after the profiles table exists 
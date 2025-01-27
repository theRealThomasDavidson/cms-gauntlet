-- Drop existing objects if they exist
drop function if exists delete_user(text);
drop function if exists change_role(text, user_role);
drop function if exists handle_new_user() cascade;
drop function if exists is_admin() cascade;
drop trigger if exists on_auth_user_created on auth.users;
drop table if exists profiles cascade;
drop type if exists user_role cascade;
DROP FUNCTION if exists get_profile_by_id(uuid);

-- Create user role enum
create type user_role as enum ('customer', 'agent', 'admin');

-- Create is_admin function
create or replace function is_admin()
returns boolean as $$
begin
  return (
    select count(*) = 1
    from public.profiles
    where auth_id = auth.uid()
    and role = 'admin'
  );
end;
$$ language plpgsql security definer;

-- Profiles table - central point for authorization and relationships
create table profiles (
  id uuid primary key default uuid_generate_v4(),
  auth_id uuid references auth.users(id) not null unique,
  org_id uuid references organizations(id) null,  -- Made optional
  username text unique,  -- Already optional
  name text,            -- Already optional
  role user_role not null default 'customer',
  email text not null,
  teams uuid[] default '{}',
  created_at timestamptz default now(),
  last_active timestamptz,
  preferences jsonb default '{}'::jsonb
);

-- Create indexes for better performance
create index profiles_auth_id_idx on profiles(auth_id);
create index profiles_org_id_idx on profiles(org_id);
create index profiles_role_idx on profiles(role);
create index profiles_email_idx on profiles(email);
create index profiles_username_idx on profiles(username);

-- Enable RLS on profiles
alter table profiles enable row level security;

-- Drop all existing policies first
drop policy if exists "authenticated users can view profiles" on profiles;
drop policy if exists "allow trigger to create profiles" on profiles;
drop policy if exists "users can view own profile" on profiles;
drop policy if exists "users can update own profile" on profiles;
drop policy if exists "admins can view all profiles" on profiles;
drop policy if exists "admins can update all profiles" on profiles;
drop policy if exists "admins can delete profiles" on profiles;
drop policy if exists "users can view org profiles" on profiles;

-- Allow the trigger to create profiles
create policy "allow trigger to create profiles"
  on profiles for insert
  with check (true);

-- Users can view their own profile
create policy "users can view own profile"
  on profiles for select
  using (auth_id = auth.uid());

-- Users can update their own profile
create policy "users can update own profile"
  on profiles for update
  using (auth_id = auth.uid());

-- Users can view profiles in their organization
create policy "users can view org profiles"
  on profiles for select
  using (
    org_id in (
      select org_id 
      from profiles 
      where auth_id = auth.uid()
    )
  );

-- Admin policies
create policy "admins can manage all profiles"
  on profiles for all
  using (
    exists (
      select 1 
      from profiles 
      where auth_id = auth.uid() 
      and role = 'admin'
    )
  );

-- Create a trigger function to create a profile when a user signs up
create or replace function public.handle_new_user()
returns trigger
security definer set search_path = public
as $$
declare
  default_org_id uuid;
  v_count int;
  v_username text;
  v_name text;
begin
  -- Get count of existing users
  select count(*) into v_count from profiles;
  
  -- Get or create default org
  default_org_id := get_or_create_default_org();

  -- For email signups, use email as fallback for username/name
  v_username := coalesce(
    new.raw_user_meta_data->>'username',    -- Email signup format
    new.raw_user_meta_data->>'user_name',   -- GitHub format
    split_part(new.email, '@', 1)           -- Fallback to email username
  );
  
  v_name := coalesce(
    new.raw_user_meta_data->>'name',        -- Email signup format
    new.raw_user_meta_data->>'user_name',   -- GitHub format
    v_username                              -- Fallback to username
  );
  
  -- Create profile with default org
  insert into public.profiles (
    auth_id, 
    email,
    username,
    name,
    org_id,
    role
  )
  values (
    new.id, 
    new.email,
    v_username,
    v_name,
    default_org_id,
    case 
      when v_count = 0 then 'admin'::user_role  -- First user is admin
      else 'customer'::user_role                -- Everyone else starts as customer
    end
  );
  return new;
end;
$$ language plpgsql;

-- Create a trigger to automatically create profiles
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- Function to change user role
create or replace function public.change_role(user_email text, new_role user_role)
returns void as $$
begin
  if (is_admin() = true) then
    update profiles
    set role = new_role
    where email = user_email;
  end if;
end;
$$ language plpgsql security definer;

-- Function to handle user deletion
create or replace function delete_user(email_to_delete text)
returns json 
security definer
set search_path = public
as $$
declare
  v_auth_id uuid;
  v_is_admin boolean;
  v_is_self boolean;
  v_username text;
begin
  -- Get the auth_id and username for the user being deleted
  select auth_id, username into v_auth_id, v_username
  from profiles 
  where email = email_to_delete;

  -- Check if current user is admin
  v_is_admin := is_admin();
  
  -- Check if user is deleting themselves
  v_is_self := auth.uid() = v_auth_id;

  -- Only allow if admin or self
  if v_is_admin or v_is_self then
    -- Delete the profile
    delete from profiles 
    where email = email_to_delete;

    return json_build_object(
      'success', true,
      'message', format('User %s successfully deleted', v_username),
      'auth_id', v_auth_id
    );
  else
    return json_build_object(
      'success', false,
      'message', 'Unauthorized to delete this user'
    );
  end if;
end;
$$ language plpgsql;

-- Ensure proper grants
revoke execute on function delete_user(text) from public;
grant execute on function delete_user(text) to authenticated;

-- Drop the function if it exists
drop function if exists get_visible_profiles();

-- Create function to get visible profiles based on user role
create or replace function get_visible_profiles()
returns setof profiles
security definer
language plpgsql
as $$
begin
  -- Let RLS handle the visibility rules
  return query 
  select * from profiles 
  order by created_at desc;
end;
$$;

-- Grant execute permissions
grant execute on function get_visible_profiles() to authenticated;

-- Function to update a profile
create or replace function update_profile(
  profile_id uuid,
  new_username text,
  new_name text,
  new_email text
)
returns void
security definer
language plpgsql
as $$
begin
  -- Check if user is updating their own profile or is admin
  if exists (
    select 1 
    from profiles 
    where id = profile_id 
    and (
      auth_id = auth.uid()  -- Own profile
      or exists (          -- Or is admin
        select 1 
        from profiles 
        where auth_id = auth.uid() 
        and role = 'admin'
      )
    )
  ) then
    update profiles
    set
      username = coalesce(new_username, username),
      name = coalesce(new_name, name),
      email = coalesce(new_email, email)
    where id = profile_id;
  else
    raise exception 'Not authorized to update this profile';
  end if;
end;
$$;

-- Grant execute permission
grant execute on function update_profile to authenticated;

-- Grant execute permissions
grant execute on function public.change_role(text, user_role) to authenticated;

-- Function to get a profile by auth_id
create or replace function get_profile_by_auth_id(user_auth_id uuid)
returns profiles
security definer
language plpgsql
as $$
declare
  v_profile profiles;
begin
  -- Get the profile if it belongs to the requesting user or if the requester is an admin
  select p.* into v_profile
  from profiles p
  where p.auth_id = user_auth_id limit 1;
  
  return v_profile;
end;
$$;

-- Grant execute permission
grant execute on function get_profile_by_auth_id(uuid) to authenticated;

-- Drop existing function first
drop function if exists get_profile_by_id(uuid);

-- Function to get a profile by ID
create or replace function get_profile_by_id(p_profile_id uuid)
returns table (
  id uuid,
  name text,
  email text,
  role text
) security definer
as $$
begin
  -- Verify user has permission to view profile
  if not exists (
    select 1 from profiles p1
    where p1.auth_id = auth.uid()
    and exists (
      select 1 from profiles p2
      where p2.id = p_profile_id
      and p2.org_id = p1.org_id
    )
  ) then
    raise exception 'User does not have permission to view this profile';
  end if;

  return query
  select 
    p.id,
    p.name,
    p.email,
    p.role::text
  from profiles p
  where p.id = p_profile_id;
end;
$$ language plpgsql;

-- Grant execute permissions
grant execute on function get_profile_by_id(uuid) to authenticated; 
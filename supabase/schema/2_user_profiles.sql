-- Drop existing objects if they exist
drop function if exists delete_user(text);
drop function if exists change_role(text, user_role);
drop function if exists handle_new_user() cascade;
drop function if exists is_admin() cascade;
drop trigger if exists on_auth_user_created on auth.users;
drop table if exists profiles cascade;
drop type if exists user_role cascade;

-- Create user role enum
create type user_role as enum ('customer', 'agent', 'admin');

-- Create is_admin function
create or replace function is_admin()
returns boolean as $$
begin
  return (
    select count(*) = 1
    from auth.users u
    join profiles p on u.id = p.auth_id
    where u.id = auth.uid()
    and p.role = 'admin'
  );
end;
$$ language plpgsql security definer;

-- Profiles table - central point for authorization and relationships
create table profiles (
  id uuid primary key default uuid_generate_v4(),
  auth_id uuid references auth.users(id) not null unique,
  org_id uuid references organizations(id),
  username text unique not null,
  name text not null,
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

-- Users can read their own profile
create policy "users can view own profile"
  on profiles for select
  using (auth_id = auth.uid());

-- Users can update their own profile
create policy "users can update own profile"
  on profiles for update
  using (auth_id = auth.uid());

-- Admin policies using the helper function
create policy "admins can view all profiles"
  on profiles for select
  using (is_admin() = true);

create policy "admins can update all profiles"
  on profiles for update
  using (is_admin() = true);

create policy "admins can delete profiles"
  on profiles for delete
  using (is_admin() = true);

-- Agents can view all profiles
create policy "agents can view all profiles"
  on profiles for select
  using (
    (select role from profiles where auth_id = auth.uid()) = 'agent'
  );

-- Function to create profile on signup
create or replace function handle_new_user()
returns trigger as $$
declare
  v_count int;
  v_default_org_id uuid;
begin
  -- Check if this is the first user
  select count(*) into v_count from profiles;
  
  -- Get or create default org
  v_default_org_id := get_or_create_default_org();
  
  insert into public.profiles (
    auth_id,
    org_id,
    username,
    name,
    email,
    role,
    preferences
  )
  values (
    new.id,
    v_default_org_id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.email,
    case 
      when v_count = 0 then 'admin'::user_role  -- First user is admin
      else 'customer'::user_role                -- Everyone else starts as customer
    end,
    jsonb_build_object(
      'notifications', jsonb_build_object(
        'email', true,
        'in_app', true
      ),
      'theme', 'light'
    )
  );
  return new;
end;
$$ language plpgsql security definer;

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
create or replace function delete_user(target_email text)
returns jsonb as $$
declare
  v_user_id uuid;
  v_is_admin boolean;
  v_is_self boolean;
  v_username text;
begin
  -- Get the ID and username of the user to be deleted
  select id into v_user_id
  from auth.users
  where email = target_email;

  -- Get username for the message
  select username into v_username
  from public.profiles
  where auth_id = v_user_id;

  -- Check if current user is admin
  v_is_admin := is_admin();
  
  -- Check if user is deleting themselves
  v_is_self := auth.uid() = v_user_id;

  -- Only allow if admin or self
  if v_is_admin or v_is_self then
    -- Delete profile first (cascading constraints will handle related data)
    delete from public.profiles
    where auth_id = v_user_id;

    -- Delete auth user
    if v_is_admin then
      -- Admins can delete the auth user directly
      perform auth.users.delete(v_user_id);
    end if;

    return jsonb_build_object(
      'success', true,
      'message', format('User %s successfully deleted', v_username)
    );
  else
    return jsonb_build_object(
      'success', false,
      'message', 'Unauthorized to delete this user'
    );
  end if;

exception
  when others then
    return jsonb_build_object(
      'success', false,
      'message', SQLERRM
    );
end;
$$ language plpgsql security definer;

-- Grant execute permissions
grant execute on function public.change_role(text, user_role) to authenticated;
grant execute on function delete_user(text) to authenticated;

-- Create trigger for new users
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user(); 
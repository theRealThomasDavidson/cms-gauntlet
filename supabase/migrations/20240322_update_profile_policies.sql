-- Drop existing policies
drop policy if exists "admins can view all profiles" on profiles;
drop policy if exists "admins can update all profiles" on profiles;
drop policy if exists "admins can delete profiles" on profiles;

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

-- Add new admin policies using the helper function
create policy "admins can view all profiles"
  on profiles for select
  using (is_admin() = true);

create policy "admins can update all profiles"
  on profiles for update
  using (is_admin() = true);

create policy "admins can delete profiles"
  on profiles for delete
  using (is_admin() = true);

-- Add policies for agents to view profiles
create policy "agents can view all profiles"
  on profiles for select
  using (
    (select role from profiles where auth_id = auth.uid()) = 'agent'
  );

-- Add indexes for better performance
create index if not exists profiles_auth_id_idx on profiles(auth_id);
create index if not exists profiles_role_idx on profiles(role);
create index if not exists profiles_email_idx on profiles(email);
create index if not exists profiles_username_idx on profiles(username); 
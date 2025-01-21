drop type if exists user_role cascade;
create type user_role as enum ('customer', 'agent', 'admin');

drop table if exists profiles cascade;
create table profiles (
  id uuid primary key default uuid_generate_v4(),
  auth_id uuid references auth.users(id) not null unique,
  username text unique,
  name text,
  role user_role not null default 'customer',
  email text not null unique,
  org_id uuid references organizations(id),
  teams jsonb,
  created_at timestamptz not null default now(),
  last_active timestamptz,
  preferences jsonb default '{}'::jsonb
);

create index profiles_auth_id_idx on profiles(auth_id);
create index profiles_username_idx on profiles(username);
create index profiles_email_idx on profiles(email);
create index profiles_org_id_idx on profiles(org_id);

alter table profiles enable row level security;

create policy "Users can view their own profile" on profiles
  for select using (auth.uid() = auth_id);

create policy "Users can update their own profile" on profiles
  for update using (auth.uid() = auth_id);

create policy "Admins can view all profiles" on profiles
  for select using (
    exists (
      select 1 from profiles p
      where p.auth_id = auth.uid()
      and p.role = 'admin'
    )
  );

create policy "Admins can update all profiles" on profiles
  for update using (
    exists (
      select 1 from profiles p
      where p.auth_id = auth.uid()
      and p.role = 'admin'
    )
  );

create or replace function is_admin()
returns boolean as $$
begin
  return exists (
    select 1 from profiles p
    where p.auth_id = auth.uid()
    and p.role = 'admin'
  );
end;
$$ language plpgsql security definer;

create or replace function handle_new_user()
returns trigger as $$
declare
  v_count int;
  v_default_org_id uuid;
begin
  -- Get count of existing profiles
  select count(*) into v_count from profiles;
  
  -- Get default org id
  select id into v_default_org_id
  from organizations
  where is_default = true;

  -- Create profile
  insert into profiles (auth_id, email, role, org_id)
  values (
    new.id,
    new.email,
    case when v_count = 0 then 'admin' else 'customer' end,
    v_default_org_id
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

create or replace function change_role(user_email text, new_role user_role)
returns jsonb as $$
declare
  v_username text;
begin
  if not is_admin() then
    return jsonb_build_object(
      'success', false,
      'message', 'Only admins can change user roles'
    );
  end if;

  select username into v_username
  from profiles
  where email = user_email;

  update profiles
  set role = new_role
  where email = user_email;

  return jsonb_build_object(
    'success', true,
    'message', format('Changed role of user %s to %s', v_username, new_role)
  );
end;
$$ language plpgsql security definer;

create or replace function delete_user(target_email text)
returns jsonb as $$
declare
  v_username text;
  v_auth_id uuid;
  v_is_self boolean;
begin
  -- Get user details
  select username, auth_id into v_username, v_auth_id
  from profiles
  where email = target_email;

  -- Check if user is deleting themselves
  v_is_self := auth.uid() = v_auth_id;

  -- Only allow if admin or self
  if not (is_admin() or v_is_self) then
    return jsonb_build_object(
      'success', false,
      'message', 'Only admins can delete other users'
    );
  end if;

  -- Delete profile
  delete from profiles where email = target_email;

  -- If admin, also delete auth user
  if is_admin() and not v_is_self then
    delete from auth.users where id = v_auth_id;
  end if;

  return jsonb_build_object(
    'success', true,
    'message', format('Successfully deleted user %s', v_username)
  );
end;
$$ language plpgsql security definer;

grant execute on function change_role(text, user_role) to authenticated;
grant execute on function delete_user(text) to authenticated; 
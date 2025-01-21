-- First ensure we have a default org
do $$
declare
  v_admin_id uuid;
  v_default_org_id uuid;
begin
  -- Get the first admin
  select id into v_admin_id
  from profiles
  where role = 'admin'
  limit 1;

  -- Create default org if it doesn't exist
  insert into organizations (name, created_by, is_default)
  select 'Default Organization', v_admin_id, true
  where not exists (
    select 1 from organizations where is_default = true
  )
  returning id into v_default_org_id;

  -- If we didn't create one, get the existing default org
  if v_default_org_id is null then
    select id into v_default_org_id
    from organizations
    where is_default = true;
  end if;

  -- Update all profiles that don't have an org
  update profiles
  set org_id = v_default_org_id
  where org_id is null;
end;
$$ language plpgsql; 
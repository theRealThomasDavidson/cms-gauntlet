do $$
declare
  v_admin_id uuid;
  v_default_org_id uuid;
begin
  -- Get the first admin user's id
  select id into v_admin_id
  from profiles
  where role = 'admin'
  limit 1;

  -- Create default org if it doesn't exist
  insert into organizations (name, created_by, is_default)
  values ('Default Organization', v_admin_id, true)
  returning id into v_default_org_id;

  -- Update all profiles that don't have an org
  update profiles
  set org_id = v_default_org_id
  where org_id is null;
end;
$$ language plpgsql; 
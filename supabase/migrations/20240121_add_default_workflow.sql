-- Function to get the earliest active workflow for an organization
create or replace function get_default_workflow(org_uuid uuid)
returns uuid as $$
declare
  workflow_id uuid;
begin
  select id into workflow_id
  from workflows
  where org_id = org_uuid
  and is_active = true
  order by created_at asc
  limit 1;
  
  return workflow_id;
end;
$$ language plpgsql security definer;

-- Grant execute permissions
grant execute on function get_default_workflow(uuid) to authenticated; 
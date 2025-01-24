-- Temporarily disable role check for unassigned tickets
create or replace function get_unassigned_tickets(
  p_org_id uuid
) returns table (
  id uuid,
  org_id uuid,
  workflow_id uuid,
  current_stage_id uuid,
  title text,
  description text,
  priority ticket_priority,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz
) as $$
begin
  -- Temporarily disabled role check
  -- if not exists (
  --   select 1 from profiles
  --   where auth_id = auth.uid()
  --   and org_id = p_org_id
  --   and role in ('admin', 'agent')
  -- ) then
  --   raise exception 'Only admins and agents can view unassigned tickets';
  -- end if;

  return query
  select 
    t.id,
    t.org_id,
    t.workflow_id,
    t.current_stage_id,
    t.title,
    t.description,
    t.priority,
    t.created_by,
    t.created_at,
    t.updated_at
  from tickets t
  where t.org_id = p_org_id
  and t.workflow_id is null
  order by t.updated_at desc;
end;
$$ language plpgsql security definer;

-- Grant execute permissions
grant execute on function get_unassigned_tickets(uuid) to authenticated; 
-- Drop existing workflow policies
drop policy if exists "org members can view workflows" on workflows;
drop policy if exists "org members can view workflow stages" on workflow_stages;
drop policy if exists "org members can view stage hooks" on workflow_stage_hooks;

-- Recreate policies without customer access
create policy "org members can view workflows"
  on workflows for select
  to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.auth_id = auth.uid()
      and p.org_id = workflows.org_id
      and p.role in ('admin', 'agent')
    )
  );

create policy "org members can view workflow stages"
  on workflow_stages for select
  to authenticated
  using (
    exists (
      select 1 from workflows w
      join profiles p on p.org_id = w.org_id
      where p.auth_id = auth.uid()
      and w.id = workflow_stages.workflow_id
      and p.role in ('admin', 'agent')
    )
  );

create policy "org members can view stage hooks"
  on workflow_stage_hooks for select
  to authenticated
  using (
    exists (
      select 1 from workflow_stages ws
      join workflows w on w.id = ws.workflow_id
      join profiles p on p.org_id = w.org_id
      where p.auth_id = auth.uid()
      and ws.id = workflow_stage_hooks.stage_id
      and p.role in ('admin', 'agent')
    )
  );

-- Modify get_workflow_stages function to restrict customer access
create or replace function get_workflow_stages(workflow_uuid uuid)
returns table (
  id uuid,
  name text,
  description text,
  is_start boolean,
  is_end boolean,
  next_stage_id uuid,
  prev_stage_id uuid,
  created_at timestamptz
) security definer
as $$
begin
  return query
  select 
    ws.id, ws.name, ws.description, ws.is_start, ws.is_end,
    ws.next_stage_id, ws.prev_stage_id, ws.created_at
  from workflow_stages ws
  join workflows w on w.id = ws.workflow_id
  where ws.workflow_id = workflow_uuid
  and exists (
    select 1 from profiles p 
    where p.auth_id = auth.uid()
    and p.org_id = w.org_id
    and p.role in ('admin', 'agent')
  )
  order by 
    case when ws.is_start then 0 else 1 end,
    ws.created_at;
end;
$$ language plpgsql;
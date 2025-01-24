-- Function to get a ticket by ID
create or replace function get_ticket_by_id(
  p_ticket_id uuid
) returns agent_tickets as $$
declare
  v_org_id uuid;
  v_result agent_tickets;
begin
  -- Get organization ID from ticket
  select org_id into v_org_id
  from tickets
  where id = p_ticket_id;

  -- Verify user has permission to view ticket
  if not exists (
    select 1 from profiles p
    where p.auth_id = auth.uid()
    and p.org_id = v_org_id
    and (
      p.role in ('admin', 'agent')
      or exists (
        select 1 from tickets t
        join ticket_history h on h.id = t.latest_history_id
        where t.id = p_ticket_id
        and (t.created_by = p.id or h.assigned_to = p.id)
      )
    )
  ) then
    raise exception 'User does not have permission to view this ticket';
  end if;

  -- Get ticket data
  select * into v_result
  from agent_tickets
  where id = p_ticket_id;

  return v_result;
end;
$$ language plpgsql security definer;

-- Grant execute permissions
grant execute on function get_ticket_by_id(uuid) to authenticated; 
-- Drop the old function
drop function if exists update_ticket_data(uuid, text, text, ticket_status, ticket_priority, uuid, text);

-- Recreate the function with profile ID lookup
create or replace function update_ticket_data(
  p_ticket_id uuid,
  p_title text,
  p_description text,
  p_status ticket_status,
  p_priority ticket_priority,
  p_assigned_to uuid,
  p_change_reason text default null
)
returns uuid as $$
declare
  v_new_history_id uuid;
  v_profile_id uuid;
begin
  -- Get profile ID from auth ID
  select id into v_profile_id
  from profiles
  where auth_id = auth.uid();

  -- Create history entry
  insert into ticket_history (
    ticket_id,
    title,
    description,
    priority,
    assigned_to,
    changed_by,
    changes
  ) values (
    p_ticket_id,
    p_title,
    p_description,
    p_priority,
    p_assigned_to,
    v_profile_id,
    jsonb_build_object('change_reason', p_change_reason)
  ) returning id into v_new_history_id;

  -- Update ticket
  update tickets 
  set latest_history_id = v_new_history_id,
      status = p_status
  where id = p_ticket_id;

  return v_new_history_id;
end;
$$ language plpgsql security definer;

-- Grant execute permissions
grant execute on function update_ticket_data(
  uuid,    -- p_ticket_id
  text,    -- p_title
  text,    -- p_description
  ticket_status,  -- p_status
  ticket_priority,  -- p_priority
  uuid,    -- p_assigned_to
  text     -- p_change_reason
) to authenticated; 
-- Drop the old function
drop function if exists update_ticket_data(uuid, text, text, ticket_status, ticket_priority, uuid, jsonb, text[], text);

-- Recreate the function with fixed status handling
create or replace function update_ticket_data(
  p_ticket_id uuid,
  p_title text,
  p_description text,
  p_status ticket_status,
  p_priority ticket_priority,
  p_assigned_to uuid,
  p_custom_fields jsonb default '{}'::jsonb,
  p_tags text[] default '{}'::text[],
  p_change_reason text default null
)
returns uuid as $$
declare
  v_old_history ticket_history;
  v_new_history_id uuid;
  v_changes jsonb;
begin
  -- Get current state
  select * into v_old_history
  from ticket_history
  where id = (
    select latest_history_id
    from tickets
    where id = p_ticket_id
  );

  -- Calculate changes (excluding status since it's not in history)
  v_changes = jsonb_build_object(
    'title', case when p_title != v_old_history.title then jsonb_build_object('old', v_old_history.title, 'new', p_title) else null end,
    'description', case when p_description != v_old_history.description then jsonb_build_object('old', v_old_history.description, 'new', p_description) else null end,
    'priority', case when p_priority != v_old_history.priority then jsonb_build_object('old', v_old_history.priority, 'new', p_priority) else null end,
    'assigned_to', case when p_assigned_to != v_old_history.assigned_to then jsonb_build_object('old', v_old_history.assigned_to, 'new', p_assigned_to) else null end,
    'custom_fields', case when p_custom_fields != v_old_history.custom_fields then jsonb_build_object('old', v_old_history.custom_fields, 'new', p_custom_fields) else null end,
    'tags', case when p_tags != v_old_history.tags then jsonb_build_object('old', v_old_history.tags, 'new', p_tags) else null end
  );

  -- Only create history if something changed
  if v_changes != '{}'::jsonb then
    insert into ticket_history (
      ticket_id,
      previous_history_id,
      title,
      description,
      priority,
      assigned_to,
      custom_fields,
      tags,
      changed_by,
      change_reason,
      changes
    ) values (
      p_ticket_id,
      v_old_history.id,
      p_title,
      p_description,
      p_priority,
      p_assigned_to,
      p_custom_fields,
      p_tags,
      auth.uid(),
      p_change_reason,
      v_changes
    ) returning id into v_new_history_id;

    -- Update ticket reference and status
    update tickets 
    set latest_history_id = v_new_history_id,
        status = p_status
    where id = p_ticket_id;

    return v_new_history_id;
  end if;

  return v_old_history.id;
end;
$$ language plpgsql security definer;

-- Re-grant execute permissions
grant execute on function update_ticket_data(
  uuid,    -- p_ticket_id
  text,    -- p_title
  text,    -- p_description
  ticket_status,  -- p_status
  ticket_priority,  -- p_priority
  uuid,    -- p_assigned_to
  jsonb,   -- p_custom_fields
  text[],  -- p_tags
  text     -- p_change_reason
) to authenticated; 
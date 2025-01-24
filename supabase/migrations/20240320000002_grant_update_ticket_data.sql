-- Grant execute permissions for update_ticket_data
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
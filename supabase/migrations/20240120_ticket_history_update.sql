-- Function to update history
create or replace function update_ticket_history()
returns trigger as $$
declare
  old_history ticket_history;
  new_history_id uuid;
  changes jsonb;
begin
  -- Get the current state
  select * into old_history 
  from ticket_history 
  where id = old.latest_history_id;

  -- Calculate what changed
  changes = jsonb_build_object(
    'title', case when new.title != old_history.title then jsonb_build_object('old', old_history.title, 'new', new.title) else null end,
    'description', case when new.description != old_history.description then jsonb_build_object('old', old_history.description, 'new', new.description) else null end,
    'status', case when new.status != old_history.status then jsonb_build_object('old', old_history.status, 'new', new.status) else null end,
    'priority', case when new.priority != old_history.priority then jsonb_build_object('old', old_history.priority, 'new', new.priority) else null end,
    'assigned_to', case when new.assigned_to != old_history.assigned_to then jsonb_build_object('old', old_history.assigned_to, 'new', new.assigned_to) else null end,
    'custom_fields', case when new.custom_fields != old_history.custom_fields then jsonb_build_object('old', old_history.custom_fields, 'new', new.custom_fields) else null end,
    'tags', case when new.tags != old_history.tags then jsonb_build_object('old', old_history.tags, 'new', new.tags) else null end
  );

  -- Only create history if something changed
  if changes != '{}'::jsonb then
    insert into ticket_history (
      ticket_id,
      previous_state_id,
      title,
      description,
      status,
      priority,
      assigned_to,
      custom_fields,
      tags,
      changed_by,
      changes
    ) values (
      old.id,
      old.latest_history_id,
      new.title,
      new.description,
      new.status,
      new.priority,
      new.assigned_to,
      new.custom_fields,
      new.tags,
      auth.uid(),
      changes
    ) returning id into new_history_id;

    -- Update ticket with new latest history
    update tickets 
    set latest_history_id = new_history_id
    where id = old.id;
  end if;

  return new;
end;
$$ language plpgsql security definer;

-- Trigger for history updates
create trigger update_ticket_history
after update on ticket_history
for each row
execute function update_ticket_history(); 
-- Add check constraint to validate hook configuration
alter table workflow_stage_hooks
add constraint valid_notification_config
check (
  hook_type != 'notification' or (
    config ? 'target_type' and
    config->>'target_type' in ('specific_user', 'role', 'ticket_creator', 'org_admins') and
    (
      (config->>'target_type' = 'specific_user' and config ? 'target_user_id') or
      (config->>'target_type' = 'role' and config ? 'target_role') or
      config->>'target_type' in ('ticket_creator', 'org_admins')
    ) and
    config ? 'message'
  )
);

-- Create function to send notifications
create or replace function send_workflow_notification(
  p_hook_id uuid,
  p_ticket_id uuid,
  p_user_id uuid
)
returns void as $$
declare
  v_hook workflow_stage_hooks;
  v_stage workflow_stages;
  v_workflow workflows;
  v_ticket tickets;
  v_notification_text text;
  v_target_users uuid[];
begin
  -- Get hook details
  select * into v_hook
  from workflow_stage_hooks
  where id = p_hook_id;

  -- Get stage and workflow details
  select s.*, w.* into v_stage, v_workflow
  from workflow_stages s
  join workflows w on w.id = s.workflow_id
  where s.id = v_hook.stage_id;

  -- Get ticket details
  select * into v_ticket
  from tickets
  where id = p_ticket_id;

  -- Replace placeholders in message
  v_notification_text := replace(v_hook.config->>'message', '{ticket_id}', p_ticket_id::text);
  v_notification_text := replace(v_notification_text, '{ticket_title}', v_ticket.title);
  v_notification_text := replace(v_notification_text, '{stage_name}', v_stage.name);

  -- Determine target users based on notification type
  case v_hook.config->>'target_type'
    when 'specific_user' then
      v_target_users := array[(v_hook.config->>'target_user_id')::uuid];
    when 'role' then
      select array_agg(id) into v_target_users
      from profiles
      where role = (v_hook.config->>'target_role')::user_role
      and org_id = v_workflow.org_id;
    when 'ticket_creator' then
      v_target_users := array[v_ticket.created_by];
    when 'org_admins' then
      select array_agg(id) into v_target_users
      from profiles
      where role = 'admin'
      and org_id = v_workflow.org_id;
  end case;

  -- Insert notifications for each target user
  insert into notifications (user_id, message, ticket_id)
  select unnest(v_target_users), v_notification_text, p_ticket_id;
end;
$$ language plpgsql security definer; 
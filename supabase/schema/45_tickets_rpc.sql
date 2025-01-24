-- Additional RPC functions for ticket management

-- Function to create a comment
create or replace function create_comment(
  p_ticket_id uuid,
  p_content text,
  p_is_internal boolean default false
) returns uuid as $$
declare
  v_comment_id uuid;
begin
  -- Verify user has permission to comment on ticket
  if not exists (
    select 1 from tickets t
    join profiles p on p.org_id = t.org_id
    where t.id = p_ticket_id
    and p.auth_id = auth.uid()
    and (
      -- Internal comments only for admin/agent
      (not p_is_internal) or
      p.role in ('admin', 'agent')
    )
  ) then
    raise exception 'Permission denied to create comment';
  end if;

  -- Create comment
  insert into ticket_comments (
    ticket_id,
    content,
    is_internal,
    created_by
  ) values (
    p_ticket_id,
    p_content,
    p_is_internal,
    (select id from profiles where auth_id = auth.uid())
  ) returning id into v_comment_id;

  return v_comment_id;
end;
$$ language plpgsql security definer;

-- Function to update a comment
create or replace function update_comment(
  p_comment_id uuid,
  p_content text,
  p_is_internal boolean
) returns void as $$
begin
  -- Verify user has permission to update comment
  if not exists (
    select 1 from ticket_comments c
    join tickets t on t.id = c.ticket_id
    join profiles p on p.org_id = t.org_id
    where c.id = p_comment_id
    and p.auth_id = auth.uid()
    and (
      c.created_by = p.id or  -- Own comment
      p.role = 'admin'        -- Admin can edit any comment
    )
  ) then
    raise exception 'Permission denied to update comment';
  end if;

  -- Update comment
  update ticket_comments
  set content = p_content,
      is_internal = p_is_internal,
      edited_at = now()
  where id = p_comment_id;
end;
$$ language plpgsql security definer;

-- Function to delete a comment
create or replace function delete_comment(
  p_comment_id uuid
) returns void as $$
begin
  -- Verify user has permission to delete comment
  if not exists (
    select 1 from ticket_comments c
    join tickets t on t.id = c.ticket_id
    join profiles p on p.org_id = t.org_id
    where c.id = p_comment_id
    and p.auth_id = auth.uid()
    and (
      c.created_by = p.id or  -- Own comment
      p.role = 'admin'        -- Admin can delete any comment
    )
  ) then
    raise exception 'Permission denied to delete comment';
  end if;

  -- Delete comment
  delete from ticket_comments
  where id = p_comment_id;
end;
$$ language plpgsql security definer;

-- Function to create an attachment
create or replace function create_attachment(
  p_ticket_id uuid,
  p_file_name text,
  p_file_type text,
  p_file_size integer,
  p_storage_path text
) returns uuid as $$
declare
  v_attachment_id uuid;
begin
  -- Verify user has permission to add attachment
  if not exists (
    select 1 from tickets t
    join profiles p on p.org_id = t.org_id
    where t.id = p_ticket_id
    and p.auth_id = auth.uid()
    and (
      t.created_by = p.id or
      exists (
        select 1 from ticket_history h
        where h.ticket_id = t.id
        and h.assigned_to = p.id
      ) or
      p.role in ('admin', 'agent')
    )
  ) then
    raise exception 'Permission denied to add attachment';
  end if;

  -- Create attachment
  insert into ticket_attachments (
    ticket_id,
    file_name,
    file_type,
    file_size,
    storage_path,
    uploaded_by
  ) values (
    p_ticket_id,
    p_file_name,
    p_file_type,
    p_file_size,
    p_storage_path,
    (select id from profiles where auth_id = auth.uid())
  ) returning id into v_attachment_id;

  return v_attachment_id;
end;
$$ language plpgsql security definer;

-- Function to delete an attachment
create or replace function delete_attachment(
  p_attachment_id uuid
) returns void as $$
begin
  -- Verify user has permission to delete attachment
  if not exists (
    select 1 from ticket_attachments a
    join tickets t on t.id = a.ticket_id
    join profiles p on p.org_id = t.org_id
    where a.id = p_attachment_id
    and p.auth_id = auth.uid()
    and (
      a.uploaded_by = p.id or  -- Own attachment
      p.role = 'admin'         -- Admin can delete any attachment
    )
  ) then
    raise exception 'Permission denied to delete attachment';
  end if;

  -- Delete attachment
  delete from ticket_attachments
  where id = p_attachment_id;
end;
$$ language plpgsql security definer;

-- Function to delete a ticket
create or replace function delete_ticket(
  p_ticket_id uuid
) returns void as $$
begin
  -- Verify user has permission to delete ticket
  if not exists (
    select 1 from tickets t
    join profiles p on p.org_id = t.org_id
    where t.id = p_ticket_id
    and p.auth_id = auth.uid()
    and p.role = 'admin'  -- Only admins can delete tickets
  ) then
    raise exception 'Only admins can delete tickets';
  end if;

  -- Delete ticket (will cascade to history, comments, and attachments)
  delete from tickets
  where id = p_ticket_id;
end;
$$ language plpgsql security definer;

drop function if exists get_ticket_by_id(uuid);
-- Function to get a ticket by ID
create or replace function get_ticket_by_id(
  p_ticket_id uuid
) returns table (
  id uuid,
  org uuid,
  workflow_id uuid,
  current_stage_id uuid,
  title text,
  description text,
  priority ticket_priority,
  assigned_to uuid,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  workflow_name text,
  stage_name text,
  comment_count bigint,
  attachment_count bigint
) security definer as $$
declare
  v_org_id uuid;
begin
  -- Get organization ID from ticket
  select org_id into v_org_id
  from tickets t
  where t.id = p_ticket_id;

  -- Verify user has permission to view ticket
  if not exists (
    select 1 from profiles p
    where p.auth_id = auth.uid()
    and (
      -- Admin/agent in the org
      (p.org_id = v_org_id and p.role in ('admin', 'agent'))
      -- Created the ticket
      or exists (
        select 1 from tickets t
        where t.id = p_ticket_id
        and t.created_by = p.id
      )
      -- Assigned to the ticket
      or exists (
        select 1 from tickets t
        join ticket_history h on h.id = t.latest_history_id
        where t.id = p_ticket_id
        and h.assigned_to = p.id
      )
    )
  ) then
    raise exception 'User does not have permission to view this ticket';
  end if;

  return query
  select 
    t.id,
    t.org_id as org,
    t.workflow_id,
    t.current_stage_id,
    h.title,
    h.description,
    h.priority,
    h.assigned_to,
    t.created_by,
    t.created_at,
    t.updated_at,
    w.name as workflow_name,
    ws.name as stage_name,
    (select count(*) from ticket_comments tc where tc.ticket_id = t.id) as comment_count,
    (select count(*) from ticket_attachments ta where ta.ticket_id = t.id) as attachment_count
  from tickets t
  join ticket_history h on h.id = t.latest_history_id
  left join workflows w on w.id = t.workflow_id
  left join workflow_stages ws on ws.id = t.current_stage_id
  where t.id = p_ticket_id;
end;
$$ language plpgsql;
grant execute on function get_ticket_by_id(uuid) to authenticated;
-- Grant execute permissions
grant execute on function create_comment(uuid, text, boolean) to authenticated;
grant execute on function update_comment(uuid, text, boolean) to authenticated;
grant execute on function delete_comment(uuid) to authenticated;
grant execute on function create_attachment(uuid, text, text, integer, text) to authenticated;
grant execute on function delete_attachment(uuid) to authenticated;
grant execute on function delete_ticket(uuid) to authenticated;

drop function if exists update_ticket_stage(uuid, uuid, text);
-- Function to update a ticket's stage
create or replace function update_ticket_stage(
  p_ticket_id uuid,
  p_stage_id uuid,
  p_change_reason text default null
) returns uuid as $$
declare
  v_old_history ticket_history;
  v_new_history_id uuid;
  v_profile_id uuid;
  v_workflow_id uuid;
begin
  -- Get profile ID from auth ID
  select id into v_profile_id
  from profiles
  where auth_id = auth.uid();

  if v_profile_id is null then
    raise exception 'Profile not found';
  end if;

  -- Get workflow ID from ticket
  select workflow_id into v_workflow_id
  from tickets
  where id = p_ticket_id;

  -- Verify stage belongs to workflow
  if not exists (
    select 1 from workflow_stages
    where id = p_stage_id
    and workflow_id = v_workflow_id
  ) then
    raise exception 'Stage does not belong to ticket workflow';
  end if;

  -- Get current state
  select * into v_old_history
  from ticket_history
  where id = (
    select latest_history_id
    from tickets
    where id = p_ticket_id
  );

  -- Create history entry
  insert into ticket_history (
    ticket_id,
    title,
    description,
    priority,
    assigned_to,
    workflow_stage_id,
    changed_by,
    changes
  ) values (
    p_ticket_id,
    v_old_history.title,
    v_old_history.description,
    v_old_history.priority,
    v_old_history.assigned_to,
    p_stage_id,
    v_profile_id,
    jsonb_build_object(
      'action', 'stage_changed',
      'previous_stage_id', v_old_history.workflow_stage_id,
      'new_stage_id', p_stage_id,
      'change_reason', p_change_reason
    )
  ) returning id into v_new_history_id;

  -- Update ticket
  update tickets 
  set current_stage_id = p_stage_id,
      latest_history_id = v_new_history_id
  where id = p_ticket_id;

  return v_new_history_id;
end;
$$ language plpgsql security definer;

grant execute on function update_ticket_stage(uuid, uuid, text) to authenticated; 
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

-- Grant execute permissions
grant execute on function create_comment(uuid, text, boolean) to authenticated;
grant execute on function update_comment(uuid, text, boolean) to authenticated;
grant execute on function delete_comment(uuid) to authenticated;
grant execute on function create_attachment(uuid, text, text, integer, text) to authenticated;
grant execute on function delete_attachment(uuid) to authenticated;
grant execute on function delete_ticket(uuid) to authenticated; 
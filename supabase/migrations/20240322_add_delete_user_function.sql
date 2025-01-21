-- Function to handle user deletion (both self and admin)
create or replace function delete_user(target_email text)
returns jsonb as $$
declare
  v_user_id uuid;
  v_is_admin boolean;
  v_is_self boolean;
  v_username text;
begin
  -- Get the ID and username of the user to be deleted
  select id into v_user_id
  from auth.users
  where email = target_email;

  -- Get username for the message
  select username into v_username
  from public.profiles
  where auth_id = v_user_id;

  -- Check if current user is admin
  v_is_admin := is_admin();
  
  -- Check if user is deleting themselves
  v_is_self := auth.uid() = v_user_id;

  -- Only allow if admin or self
  if v_is_admin or v_is_self then
    -- Delete profile first (cascading constraints will handle related data)
    delete from public.profiles
    where auth_id = v_user_id;

    -- Delete auth user
    if v_is_admin then
      -- Admins can delete the auth user directly
      perform auth.users.delete(v_user_id);
    end if;

    return jsonb_build_object(
      'success', true,
      'message', format('User %s successfully deleted', v_username)
    );
  else
    return jsonb_build_object(
      'success', false,
      'message', 'Unauthorized to delete this user'
    );
  end if;

exception
  when others then
    return jsonb_build_object(
      'success', false,
      'message', SQLERRM
    );
end;
$$ language plpgsql security definer;

-- Grant execute permission to authenticated users
grant execute on function delete_user(text) to authenticated; 
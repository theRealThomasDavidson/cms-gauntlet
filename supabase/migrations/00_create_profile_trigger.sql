-- Create profile on auth.user creation
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (auth_id, name, role, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    'customer',
    new.email
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger the function every time a user is created
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user(); 
drop table if exists organizations cascade;

create table organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) not null,
  is_active boolean not null default true,
  is_default boolean not null default false
);

create index organizations_name_idx on organizations(name);

alter table organizations enable row level security;

create policy "Organizations are viewable by authenticated users" on organizations
  for select using (auth.role() = 'authenticated');

create policy "Organizations are manageable by admins" on organizations
  for all using (
    exists (
      select 1 from profiles p
      where p.auth_id = auth.uid()
      and p.role = 'admin'
    )
  ); 
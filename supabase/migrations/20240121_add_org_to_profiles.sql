-- Add org_id column to profiles
alter table profiles 
add column if not exists org_id uuid references organizations(id);

-- Create index for the new column
create index if not exists profiles_org_id_idx on profiles(org_id); 
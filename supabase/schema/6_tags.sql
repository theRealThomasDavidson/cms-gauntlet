-- Create tag definitions table
create table if not exists tag_definitions (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references organizations(id) on delete cascade,
  name text not null,
  description text,
  color text not null default '#666666',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  
  -- Each tag name should be unique within an organization
  unique(org_id, name),
  
  -- Color should be a valid hex code
  constraint valid_color check (color ~* '^#[0-9a-f]{6}$')
);

-- Create generic tagging junction table
create table if not exists tagged_items (
  tag_id uuid references tag_definitions(id) on delete cascade,
  item_type text not null check (item_type in ('ticket', 'article')),
  item_id uuid not null,
  added_at timestamptz not null default now(),
  added_by uuid references auth.users(id) on delete set null,
  
  primary key (tag_id, item_type, item_id)
);

-- Enable RLS
alter table tag_definitions enable row level security;
alter table tagged_items enable row level security;

-- Create indexes
create index if not exists idx_tag_definitions_org on tag_definitions(org_id);
create index if not exists idx_tagged_items_tag on tagged_items(tag_id);
create index if not exists idx_tagged_items_item on tagged_items(item_type, item_id);

-- RLS Policies for tag_definitions

-- Users can view tags in their organizations
create policy "Users can view tags in their organizations"
  on tag_definitions for select
  using (
    exists (
      select 1 from tickets t
      where t.org_id = tag_definitions.org_id
      and t.created_by = auth.uid()
    )
    or exists (
      select 1 from kb_articles ka
      where ka.org_id = tag_definitions.org_id
      and ka.created_by = auth.uid()
    )
  );

-- Users can create tags in their organizations
create policy "Users can create tags"
  on tag_definitions for insert
  with check (
    exists (
      select 1 from tickets t
      where t.org_id = tag_definitions.org_id
      and t.created_by = auth.uid()
    )
    or exists (
      select 1 from kb_articles ka
      where ka.org_id = tag_definitions.org_id
      and ka.created_by = auth.uid()
    )
  );

-- Users can update their own tags
create policy "Users can update their own tags"
  on tag_definitions for update
  using (created_by = auth.uid());

-- Users can delete their own tags
create policy "Users can delete their own tags"
  on tag_definitions for delete
  using (created_by = auth.uid());

-- RLS Policies for tagged_items

-- Users can view tags on items they have access to
create policy "Users can view tagged items"
  on tagged_items for select
  using (
    (item_type = 'ticket' and exists (
      select 1 from tickets t
      where t.id = tagged_items.item_id
      and t.created_by = auth.uid()
    ))
    or
    (item_type = 'article' and exists (
      select 1 from kb_articles ka
      where ka.id = tagged_items.item_id
      and ka.created_by = auth.uid()
    ))
  );

-- Users can add tags to their items
create policy "Users can add tags to items"
  on tagged_items for insert
  with check (
    (item_type = 'ticket' and exists (
      select 1 from tickets t
      where t.id = tagged_items.item_id
      and t.created_by = auth.uid()
    ))
    or
    (item_type = 'article' and exists (
      select 1 from kb_articles ka
      where ka.id = tagged_items.item_id
      and ka.created_by = auth.uid()
    ))
  );

-- Users can remove tags from their items
create policy "Users can remove tags from items"
  on tagged_items for delete
  using (
    (item_type = 'ticket' and exists (
      select 1 from tickets t
      where t.id = tagged_items.item_id
      and t.created_by = auth.uid()
    ))
    or
    (item_type = 'article' and exists (
      select 1 from kb_articles ka
      where ka.id = tagged_items.item_id
      and ka.created_by = auth.uid()
    ))
  ); 
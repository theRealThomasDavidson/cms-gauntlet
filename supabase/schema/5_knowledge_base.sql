-- Create categories table
create table if not exists kb_categories (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references organizations(id) on delete cascade,
  name text not null,
  description text,
  parent_id uuid references kb_categories(id) on delete set null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  
  -- Each category name should be unique within an organization and parent
  unique(org_id, parent_id, name)
);

-- Create articles table
create table if not exists kb_articles (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references organizations(id) on delete cascade,
  category_id uuid references kb_categories(id) on delete set null,
  title text not null,
  content text not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  
  -- Search configuration
  search_vector tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(content, '')), 'B')
  ) stored
);

-- Enable RLS
alter table kb_categories enable row level security;
alter table kb_articles enable row level security;

-- Create indexes
create index if not exists idx_kb_categories_org on kb_categories(org_id);
create index if not exists idx_kb_categories_parent on kb_categories(parent_id);
create index if not exists idx_kb_articles_org on kb_articles(org_id);
create index if not exists idx_kb_articles_category on kb_articles(category_id);
create index if not exists idx_kb_articles_status on kb_articles(status);
create index if not exists idx_kb_articles_search on kb_articles using gin(search_vector);

-- RLS Policies for kb_categories

-- Users can view published categories
create policy "Users can view categories"
  on kb_categories for select
  using (
    exists (
      select 1 from tickets t
      where t.org_id = kb_categories.org_id
      and t.created_by = auth.uid()
    )
  );

-- Users can create categories
create policy "Users can create categories"
  on kb_categories for insert
  with check (
    exists (
      select 1 from tickets t
      where t.org_id = kb_categories.org_id
      and t.created_by = auth.uid()
    )
  );

-- Users can update their own categories
create policy "Users can update their own categories"
  on kb_categories for update
  using (created_by = auth.uid());

-- Users can delete their own categories
create policy "Users can delete their own categories"
  on kb_categories for delete
  using (created_by = auth.uid());

-- RLS Policies for kb_articles

-- Users can view published articles
create policy "Users can view published articles"
  on kb_articles for select
  using (
    exists (
      select 1 from tickets t
      where t.org_id = kb_articles.org_id
      and t.created_by = auth.uid()
    )
  );

-- Users can create articles
create policy "Users can create articles"
  on kb_articles for insert
  with check (
    exists (
      select 1 from tickets t
      where t.org_id = kb_articles.org_id
      and t.created_by = auth.uid()
    )
  );

-- Users can update their own articles
create policy "Users can update their own articles"
  on kb_articles for update
  using (created_by = auth.uid());

-- Users can delete their own articles
create policy "Users can delete their own articles"
  on kb_articles for delete
  using (created_by = auth.uid()); 
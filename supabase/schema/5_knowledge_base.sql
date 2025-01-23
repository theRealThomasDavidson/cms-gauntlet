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
  ) stored,
  
  -- Vector embeddings for semantic search (using OpenAI ada-002)
  title_embedding vector(1536),
  content_embedding vector(1536)
);

-- Create article chunks table for detailed semantic search
create table if not exists kb_article_chunks (
  id uuid primary key default uuid_generate_v4(),
  article_id uuid not null references kb_articles(id) on delete cascade,
  chunk_index int not null,
  chunk_text text not null,
  embedding vector(1536),
  
  -- Chunk metadata
  start_char int not null,
  end_char int not null,
  token_count int not null,
  
  -- Overlap tracking
  prev_chunk_id uuid references kb_article_chunks(id),
  next_chunk_id uuid references kb_article_chunks(id),
  overlap_start_prev int,  -- Number of overlapping tokens with previous chunk
  overlap_start_next int,  -- Number of overlapping tokens with next chunk
  
  -- Optional context
  section_title text,
  metadata jsonb not null default '{}'::jsonb check (
    metadata ? 'article_id' and 
    metadata ? 'org_id' and
    metadata ? 'model_version'
  ),
  
  created_at timestamptz not null default now(),
  
  -- Ensure chunks are ordered
  unique(article_id, chunk_index)
);

-- Create comments table
create table if not exists kb_article_comments (
  id uuid primary key default uuid_generate_v4(),
  article_id uuid not null references kb_articles(id) on delete cascade,
  content text not null,
  created_by uuid not null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  parent_id uuid references kb_article_comments(id) on delete cascade,
  
  -- For threaded comments support
  path ltree not null default ''::ltree,
  depth int not null default 0
);

-- Enable RLS
alter table kb_categories enable row level security;
alter table kb_articles enable row level security;
alter table kb_article_comments enable row level security;
alter table kb_article_chunks enable row level security;

-- Drop existing policies
drop policy if exists "Users can view categories" on kb_categories;
drop policy if exists "Users can create categories" on kb_categories;
drop policy if exists "Users can update their own categories" on kb_categories;
drop policy if exists "Users can delete their own categories" on kb_categories;

drop policy if exists "Users can view published articles" on kb_articles;
drop policy if exists "Users can create articles" on kb_articles;
drop policy if exists "Users can update their own articles" on kb_articles;
drop policy if exists "Users can delete their own articles" on kb_articles;

drop policy if exists "Users can view comments" on kb_article_comments;
drop policy if exists "Users can create comments" on kb_article_comments;
drop policy if exists "Users can update their own comments" on kb_article_comments;
drop policy if exists "Users can delete their own comments" on kb_article_comments;

drop policy if exists "Users can view chunks from visible articles" on kb_article_chunks;
drop policy if exists "System can manage chunks" on kb_article_chunks;

-- Create indexes
create index if not exists idx_kb_categories_org on kb_categories(org_id);
create index if not exists idx_kb_categories_parent on kb_categories(parent_id);

create index if not exists idx_kb_articles_org on kb_articles(org_id);
create index if not exists idx_kb_articles_category on kb_articles(category_id);
create index if not exists idx_kb_articles_status on kb_articles(status);
create index if not exists idx_kb_articles_search on kb_articles using gin(search_vector);

-- Create additional indexes for chunks
create index if not exists idx_article_chunks_article on kb_article_chunks(article_id);
create index if not exists idx_article_chunks_embedding on kb_article_chunks using ivfflat (embedding vector_cosine_ops);

-- Update article indexes for new vector size
drop index if exists idx_kb_articles_title_embedding;
drop index if exists idx_kb_articles_content_embedding;
create index idx_kb_articles_title_embedding on kb_articles using ivfflat (title_embedding vector_cosine_ops);
create index idx_kb_articles_content_embedding on kb_articles using ivfflat (content_embedding vector_cosine_ops);

create index if not exists idx_kb_comments_article on kb_article_comments(article_id);
create index if not exists idx_kb_comments_parent on kb_article_comments(parent_id);
create index if not exists idx_kb_comments_path on kb_article_comments using gist(path);
create index if not exists idx_kb_comments_created on kb_article_comments(created_at desc);

-- Drop existing trigger if it exists
drop trigger if exists set_comment_path on kb_article_comments;

create trigger set_comment_path before insert on kb_article_comments
  for each row execute procedure update_comment_path();

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

-- RLS Policies for kb_article_comments
create policy "Users can view comments"
  on kb_article_comments for select
  using (
    exists (
      select 1 from kb_articles a
      where a.id = kb_article_comments.article_id
      and exists (
        select 1 from tickets t
        where t.org_id = a.org_id
        and t.created_by = auth.uid()
      )
    )
  );

create policy "Users can create comments"
  on kb_article_comments for insert
  with check (
    exists (
      select 1 from kb_articles a
      where a.id = kb_article_comments.article_id
      and exists (
        select 1 from tickets t
        where t.org_id = a.org_id
        and t.created_by = auth.uid()
      )
    )
  );

create policy "Users can update their own comments"
  on kb_article_comments for update
  using (created_by = auth.uid());

create policy "Users can delete their own comments"
  on kb_article_comments for delete
  using (created_by = auth.uid());

-- RLS Policies for kb_article_chunks
create policy "Users can view chunks from visible articles"
  on kb_article_chunks for select
  using (
    exists (
      select 1 from kb_articles a
      where a.id = kb_article_chunks.article_id
      and exists (
        select 1 from tickets t
        where t.org_id = a.org_id
        and t.created_by = auth.uid()
      )
    )
  );

-- Only allow system to manage chunks (will be handled by edge functions)
create policy "System can manage chunks"
  on kb_article_chunks for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Function to create chunk with proper metadata
create or replace function create_article_chunk(
  p_article_id uuid,
  p_chunk_index int,
  p_chunk_text text,
  p_embedding vector(1536),
  p_start_char int,
  p_end_char int,
  p_token_count int,
  p_section_title text default null,
  p_extra_metadata jsonb default '{}'::jsonb
) returns uuid as $$
declare
  v_org_id uuid;
  v_chunk_id uuid;
begin
  -- Get org_id from article
  select org_id into v_org_id
  from kb_articles
  where id = p_article_id;

  -- Create chunk with required metadata
  insert into kb_article_chunks (
    article_id,
    chunk_index,
    chunk_text,
    embedding,
    start_char,
    end_char,
    token_count,
    section_title,
    metadata
  ) values (
    p_article_id,
    p_chunk_index,
    p_chunk_text,
    p_embedding,
    p_start_char,
    p_end_char,
    p_token_count,
    p_section_title,
    jsonb_build_object(
      'article_id', p_article_id,
      'org_id', v_org_id,
      'model_version', 'text-embedding-ada-002'
    ) || p_extra_metadata
  ) returning id into v_chunk_id;

  return v_chunk_id;
end;
$$ language plpgsql security definer;

-- Function to update comment paths
create or replace function update_comment_path()
returns trigger as $$
begin
  if new.parent_id is null then
    new.path := text2ltree(new.id::text);
    new.depth := 0;
  else
    select path || text2ltree(new.id::text), depth + 1
    into new.path, new.depth
    from kb_article_comments
    where id = new.parent_id;
  end if;
  return new;
end;
$$ language plpgsql;

-- Function to find similar chunks
create or replace function find_similar_chunks(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  filter_article_id uuid default null
)
returns table (
  chunk_id uuid,
  article_id uuid,
  chunk_text text,
  similarity float,
  section_title text,
  metadata jsonb
)
language sql stable
as $$
  select
    id,
    article_id,
    chunk_text,
    1 - (embedding <=> query_embedding) as similarity,
    section_title,
    metadata
  from kb_article_chunks
  where
    case
      when filter_article_id is not null then article_id = filter_article_id
      else true
    end
    and 1 - (embedding <=> query_embedding) > match_threshold
  order by embedding <=> query_embedding
  limit match_count;
$$; 
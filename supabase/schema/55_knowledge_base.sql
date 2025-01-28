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

-- Drop existing objects if they exist
drop table if exists kb_articles cascade;
drop table if exists kb_article_chunks cascade;

-- Create the articles table
create table kb_articles (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references organizations(id) not null,
  title text not null,
  content text not null,
  status text not null default 'draft',
  is_public boolean default false,
  metadata jsonb default '{}'::jsonb,
  title_embedding vector(1536),    -- For semantic search
  content_embedding vector(1536),  -- For semantic search
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references profiles(id) not null,
  updated_by uuid references profiles(id) not null
);

-- Create the chunks table for detailed semantic search
create table kb_article_chunks (
  id uuid primary key default uuid_generate_v4(),
  article_id uuid references kb_articles(id) on delete cascade not null,
  chunk_index integer not null,
  content text not null,
  embedding vector(1536) not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
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

create index kb_articles_org_idx on kb_articles(org_id);
create index kb_articles_status_idx on kb_articles(status);
create index kb_articles_public_idx on kb_articles(is_public);

create index kb_article_chunks_article_idx on kb_article_chunks(article_id);

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

-- Drop all existing policies
drop policy if exists "public can view published articles" on kb_articles;
drop policy if exists "public can view published article chunks" on kb_article_chunks;
drop policy if exists "public can view categories" on kb_categories;
drop policy if exists "public can view comments on public articles" on kb_article_comments;
drop policy if exists "org members can view all articles" on kb_articles;
drop policy if exists "org members can view all chunks" on kb_article_chunks;
drop policy if exists "admins and agents can manage articles" on kb_articles;
drop policy if exists "admins and agents can manage chunks" on kb_article_chunks;

-- Public access policies for published articles
create policy "public can view published articles"
  on kb_articles for select
  using (
    is_public = true 
    and status = 'published'
  );

-- Allow authenticated users to create articles
create policy "authenticated users can create articles"
  on kb_articles for insert
  to authenticated
  with check (true);

create policy "public can view published article chunks"
  on kb_article_chunks for select
  using (
    exists (
      select 1 from kb_articles a
      where a.id = kb_article_chunks.article_id
      and a.is_public = true
      and a.status = 'published'
    )
  );

-- Public access to categories
create policy "public can view categories"
  on kb_categories for select
  using (true);

-- Public access to comments on public articles
create policy "public can view comments on public articles"
  on kb_article_comments for select
  using (
    exists (
      select 1 from kb_articles a
      where a.id = kb_article_comments.article_id
      and a.is_public = true
      and a.status = 'published'
    )
  );

-- Org member policies
create policy "org members can view all articles"
  on kb_articles for select
  to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.auth_id = auth.uid()
      and p.org_id = kb_articles.org_id
    )
  );

create policy "org members can view all chunks"
  on kb_article_chunks for select
  to authenticated
  using (
    exists (
      select 1 from kb_articles a
      join profiles p on p.org_id = a.org_id
      where p.auth_id = auth.uid()
      and a.id = kb_article_chunks.article_id
    )
  );

-- Admin and agent policies
create policy "admins and agents can manage articles"
  on kb_articles for all
  to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.auth_id = auth.uid()
      and p.org_id = kb_articles.org_id
      and p.role in ('admin', 'agent')
    )
  );

create policy "admins and agents can manage chunks"
  on kb_article_chunks for all
  to authenticated
  using (
    exists (
      select 1 from kb_articles a
      join profiles p on p.org_id = a.org_id
      where p.auth_id = auth.uid()
      and a.id = kb_article_chunks.article_id
      and p.role in ('admin', 'agent')
    )
  );

-- Allow anyone to view kb_articles
create policy "anyone can view kb_articles"
  on kb_articles
  for select
  using (true);

-- Function to search articles by similarity
create or replace function search_kb_articles(
  query_embedding vector(1536),
  similarity_threshold float,
  match_count int
)
returns table (
  id uuid,
  title text,
  content text,
  similarity float
)
language plpgsql
security definer
as $$
begin
  return query
  select
    a.id,
    a.title,
    a.content,
    1 - (a.content_embedding <=> query_embedding) as similarity
  from kb_articles a
  where 1 - (a.content_embedding <=> query_embedding) > similarity_threshold
    and a.is_public = true
    and a.status = 'published'
  order by a.content_embedding <=> query_embedding
  limit match_count;
end;
$$;

-- Function to search article chunks by similarity
create or replace function search_kb_chunks(
  query_embedding vector(1536),
  similarity_threshold float,
  match_count int
)
returns table (
  chunk_id uuid,
  article_id uuid,
  content text,
  similarity float,
  metadata jsonb
)
language plpgsql
security definer
as $$
begin
  return query
  select
    c.id as chunk_id,
    c.article_id,
    c.content,
    1 - (c.embedding <=> query_embedding) as similarity,
    c.metadata
  from kb_article_chunks c
  join kb_articles a on a.id = c.article_id
  where 1 - (c.embedding <=> query_embedding) > similarity_threshold
    and a.is_public = true
    and a.status = 'published'
  order by c.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- Grant access to the search functions
grant execute on function search_kb_articles(vector(1536), float, int) to anon;
grant execute on function search_kb_chunks(vector(1536), float, int) to anon;

-- Create a function to update embeddings (to be called from edge function)
create or replace function update_article_embeddings(
  article_id uuid,
  new_title_embedding vector(1536),
  new_content_embedding vector(1536)
)
returns void
language plpgsql
security definer
as $$
begin
  update kb_articles
  set
    title_embedding = new_title_embedding,
    content_embedding = new_content_embedding,
    updated_at = now()
  where id = article_id;
end;
$$;

-- Create a function to update chunk embeddings
create or replace function update_chunk_embedding(
  chunk_id uuid,
  new_embedding vector(1536)
)
returns void
language plpgsql
security definer
as $$
begin
  update kb_article_chunks
  set embedding = new_embedding
  where id = chunk_id;
end;
$$;

-- Grant access to the embedding update functions to authenticated users
grant execute on function update_article_embeddings(uuid, vector(1536), vector(1536)) to authenticated;
grant execute on function update_chunk_embedding(uuid, vector(1536)) to authenticated;

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
    content,
    embedding,
    metadata
  ) values (
    p_article_id,
    p_chunk_index,
    p_chunk_text,
    p_embedding,
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

-- Drop the embeddings function and trigger
drop function if exists generate_article_embeddings() cascade;
drop trigger if exists article_embeddings_trigger on kb_articles;

-- We'll re-enable this later with proper configuration
-- create trigger article_embeddings_trigger
--   after insert or update of title, content
--   on kb_articles
--   for each row
--   when (NEW.is_public = true and NEW.id is not null)
--   execute function generate_article_embeddings();

-- Create function for semantic search
create or replace function search_kb_articles(
  query_text text,
  similarity_threshold float default 0.5,
  match_count int default 5
) returns table (
  id uuid,
  title text,
  content text,
  similarity float
)
language plpgsql
security definer
as $$
declare
  query_embedding vector(1536);
begin
  -- Call OpenAI API to get the embedding for the search query
  select embedding into query_embedding
  from (
    select 
      (openai.embeddings(
        array[query_text],
        'text-embedding-ada-002'
      ))[1] as embedding
  ) as query_data;

  -- Return articles ordered by similarity
  return query
  select
    a.id,
    a.title,
    a.content,
    (a.title_embedding <=> query_embedding) as similarity
  from kb_articles a
  where 
    a.is_public = true
    and (a.title_embedding <=> query_embedding) < similarity_threshold
  order by a.title_embedding <=> query_embedding
  limit match_count;
end;
$$;

-- Drop all versions of the function
drop function if exists create_knowledge_article(text, text, text, text);
drop function if exists create_knowledge_article(text, boolean, text, text);
drop function if exists create_knowledge_article(text, text, boolean, text);
drop function if exists create_knowledge_article(p_content text, p_is_public boolean, p_status text, p_title text);
drop function if exists create_knowledge_article(p_title text, p_content text, p_is_public boolean, p_status text);

-- Create a single version with clear parameter order
create or replace function create_knowledge_article(
  p_title text,
  p_content text,
  p_is_public boolean default false,
  p_status text default 'draft'
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid;
  v_org_id uuid;
  v_article_id uuid;
begin
  -- Get user profile info
  select id, org_id into v_user_id, v_org_id
  from profiles p
  where p.auth_id = auth.uid();

  if v_user_id is null then
    raise exception 'Profile not found for current user';
  end if;

  -- Create the article
  insert into kb_articles (
    org_id,
    title,
    content,
    is_public,
    status,
    created_by,
    updated_by
  ) values (
    v_org_id,
    p_title,
    p_content,
    p_is_public,
    p_status,
    v_user_id,
    v_user_id
  ) returning id into v_article_id;

  return v_article_id;
end;
$$;

-- Grant execute permission
grant execute on function create_knowledge_article(text, text, boolean, text) to authenticated;

-- Grant necessary table permissions
grant usage on schema public to postgres, authenticated, anon;
grant select on profiles to postgres, authenticated;
grant select, insert on kb_articles to postgres, authenticated; 
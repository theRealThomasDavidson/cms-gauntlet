-- Create job status enum
create type job_status as enum (
  'pending',
  'processing',
  'completed',
  'failed',
  'cancelled'
);

-- Create job types enum
create type job_type as enum (
  'generate_embeddings',
  'reprocess_embeddings',
  'delete_embeddings'
);

-- Create background jobs table
create table if not exists background_jobs (
  id uuid primary key default uuid_generate_v4(),
  job_type job_type not null,
  status job_status not null default 'pending',
  
  -- Job data
  payload jsonb not null,
  result jsonb,
  error text,
  
  -- Tracking
  attempts int not null default 0,
  max_attempts int not null default 3,
  last_error text,
  locked_until timestamptz,
  locked_by text,
  
  -- Timing
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  
  -- For ordering and batching
  priority int not null default 0,
  queue text not null default 'default'
);

-- Create indexes
create index idx_jobs_status on background_jobs(status);
create index idx_jobs_type on background_jobs(job_type);
create index idx_jobs_queue on background_jobs(queue);
create index idx_jobs_priority on background_jobs(priority desc);
create index idx_jobs_locked_until on background_jobs(locked_until);
create index idx_jobs_created_at on background_jobs(created_at);

-- Function to claim next job
create or replace function claim_next_job(
  worker_id text,
  supported_types job_type[],
  supported_queues text[]
)
returns table (
  id uuid,
  job_type job_type,
  payload jsonb
) as $$
declare
  lock_timeout interval = interval '5 minutes';
  v_job record;
begin
  -- Get and lock next available job
  update background_jobs
  set 
    status = 'processing',
    attempts = attempts + 1,
    locked_until = now() + lock_timeout,
    locked_by = worker_id,
    started_at = now(),
    updated_at = now()
  where id = (
    select id
    from background_jobs
    where 
      status in ('pending', 'failed')
      and (locked_until is null or locked_until < now())
      and attempts < max_attempts
      and job_type = any(supported_types)
      and queue = any(supported_queues)
    order by
      priority desc,
      created_at asc
    limit 1
    for update skip locked
  )
  returning * into v_job;

  -- Return job details if found
  if v_job.id is not null then
    return query
    select 
      v_job.id,
      v_job.job_type,
      v_job.payload;
  end if;
end;
$$ language plpgsql;

-- Function to complete job
create or replace function complete_job(
  p_job_id uuid,
  p_result jsonb default null
)
returns void as $$
begin
  update background_jobs
  set
    status = 'completed',
    result = p_result,
    completed_at = now(),
    updated_at = now(),
    locked_until = null,
    locked_by = null
  where id = p_job_id;
end;
$$ language plpgsql;

-- Function to fail job
create or replace function fail_job(
  p_job_id uuid,
  p_error text
)
returns void as $$
begin
  update background_jobs
  set
    status = case 
      when attempts >= max_attempts then 'failed'
      else 'pending'
    end,
    last_error = p_error,
    error = case 
      when attempts >= max_attempts then p_error
      else error
    end,
    updated_at = now(),
    locked_until = null,
    locked_by = null
  where id = p_job_id;
end;
$$ language plpgsql;

-- Function to schedule embedding generation
create or replace function schedule_embedding_generation(
  p_article_id uuid,
  p_priority int default 0
)
returns uuid as $$
declare
  v_job_id uuid;
begin
  insert into background_jobs (
    job_type,
    payload,
    priority,
    queue
  ) values (
    'generate_embeddings',
    jsonb_build_object(
      'article_id', p_article_id
    ),
    p_priority,
    'embeddings'
  )
  returning id into v_job_id;

  return v_job_id;
end;
$$ language plpgsql;

-- Trigger to auto-schedule embedding generation for new articles
create or replace function schedule_article_embedding()
returns trigger as $$
begin
  perform schedule_embedding_generation(new.id);
  return new;
end;
$$ language plpgsql;

create trigger article_embedding_scheduler
  after insert on kb_articles
  for each row
  execute function schedule_article_embedding(); 
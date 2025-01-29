-- Create junction table for stage-article relationships if it doesn't exist
CREATE TABLE IF NOT EXISTS workflow_stage_articles (
  id uuid primary key default uuid_generate_v4(),
  stage_id uuid references workflow_stages(id) on delete cascade,
  article_id uuid references kb_articles(id) on delete cascade,
  created_at timestamptz default now(),
  unique(stage_id, article_id)
);

-- Create base workflows
INSERT INTO workflows (name, description, created_by, org_id) 
VALUES 
  (
    'Canoe Repair', 
    'Workflow for handling repair or replacement requests for damaged canoes',
    (SELECT id FROM profiles LIMIT 1),
    (SELECT id FROM organizations WHERE 'Default Organization' = name LIMIT 1)
  );

INSERT INTO workflows (name, description, created_by, org_id) 
VALUES 
  (
    'Canoe Activities', 
    'Workflow for helping customers learn about different canoe activities and uses',
    (SELECT id FROM profiles LIMIT 1),
    (SELECT id FROM organizations WHERE 'Default Organization' = name LIMIT 1)
  ); 
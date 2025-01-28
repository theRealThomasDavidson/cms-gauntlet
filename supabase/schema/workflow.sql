-- Check if this matches your current function
CREATE OR REPLACE FUNCTION create_workflow(
  p_name TEXT,
  p_description TEXT DEFAULT NULL,
  p_org_id UUID
) RETURNS UUID AS $$
DECLARE
  v_workflow_id UUID;
BEGIN
  -- Insert the workflow
  INSERT INTO workflows (name, description, org_id)
  VALUES (p_name, p_description, p_org_id)
  RETURNING id INTO v_workflow_id;

  -- Create default stages
  INSERT INTO workflow_stages (workflow_id, name, description, position)
  VALUES 
    (v_workflow_id, 'New', 'New tickets', 0),
    (v_workflow_id, 'In Progress', 'Tickets being worked on', 1),
    (v_workflow_id, 'Review', 'Tickets ready for review', 2),
    (v_workflow_id, 'Done', 'Completed tickets', 3);

  RETURN v_workflow_id;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS workflow_stages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
); 
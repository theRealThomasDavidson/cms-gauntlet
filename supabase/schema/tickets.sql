CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'open',
  priority TEXT DEFAULT 'medium',
  workflow_id UUID REFERENCES workflows(id),
  current_stage_id UUID REFERENCES workflow_stages(id),
  created_by UUID REFERENCES auth.users(id),
  assigned_to UUID REFERENCES auth.users(id),
  org_id UUID REFERENCES organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION update_ticket_stage(
  p_ticket_id UUID,
  p_stage_id UUID,
  p_change_reason TEXT DEFAULT NULL
) RETURNS void AS $$
BEGIN
  -- Update the ticket's current stage
  UPDATE tickets 
  SET current_stage_id = p_stage_id,
      updated_at = NOW()
  WHERE id = p_ticket_id;

  -- Add to ticket history
  INSERT INTO ticket_history (
    ticket_id,
    description,
    changes,
    created_by
  ) VALUES (
    p_ticket_id,
    p_change_reason,
    jsonb_build_object(
      'action', 'stage_changed',
      'new_stage_id', p_stage_id
    ),
    auth.uid()
  );
END;
$$ LANGUAGE plpgsql; 
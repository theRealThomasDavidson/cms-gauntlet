-- Store outreach templates and their metadata
CREATE TABLE IF NOT EXISTS outreach_templates (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  prompt_template TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Store generated messages and their context
CREATE TABLE IF NOT EXISTS outreach_messages (
  id BIGSERIAL PRIMARY KEY,
  template_id BIGINT REFERENCES outreach_templates(id),
  recipient_id UUID REFERENCES auth.users(id),
  context JSON,  -- Stores student data used in generation
  prompt TEXT,   -- The actual prompt sent to GPT
  message TEXT,  -- Generated message
  edited_message TEXT, -- Message after human edits
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) DEFAULT auth.uid()
);

-- Function to generate message using edge function
CREATE OR REPLACE FUNCTION generate_outreach_message(
  p_template_id BIGINT,
  p_recipient_id UUID,
  p_context JSON
) RETURNS JSON AS $$
DECLARE
  response RECORD;
  template_record outreach_templates%ROWTYPE;
BEGIN
  -- Get template
  SELECT * INTO template_record FROM outreach_templates WHERE id = p_template_id;
  
  -- Call edge function with context
  SELECT net.http_post(
    'https://satkuhqfcnmonhxfdmiu.supabase.co/functions/v1/outreach-gpt',
    jsonb_build_object(
      'template', template_record.prompt_template,
      'context', p_context
    ),
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || auth.jwt(),
      'Content-Type', 'application/json'
    )
  ) INTO response;

  -- Store the message
  INSERT INTO outreach_messages (
    template_id,
    recipient_id,
    context,
    prompt,
    message
  ) VALUES (
    p_template_id,
    p_recipient_id,
    p_context,
    template_record.prompt_template,
    response.content::json->>'message'
  );

  RETURN response.content::json;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to generate AI message for ticket
CREATE OR REPLACE FUNCTION generate_ticket_message(
  p_ticket_id UUID,
  p_context JSON
) RETURNS JSON AS $$
DECLARE
  response RECORD;
  v_profile_id UUID;
BEGIN
  -- Get profile ID
  SELECT id INTO v_profile_id 
  FROM profiles 
  WHERE auth_id = auth.uid();

  -- Call edge function with context
  SELECT net.http_post(
    'https://satkuhqfcnmonhxfdmiu.supabase.co/functions/v1/outreach-gpt',
    jsonb_build_object(
      'ticket_id', p_ticket_id,
      'context', p_context
    ),
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || auth.jwt(),
      'Content-Type', 'application/json'
    )
  ) INTO response;

  -- Store as ticket history
  INSERT INTO ticket_history (
    ticket_id,
    title,
    description,
    priority,
    assigned_to,
    changed_by,
    changes
  ) 
  SELECT
    t.id,
    h.title,
    response.content::json->>'message',
    h.priority,
    h.assigned_to,
    v_profile_id,
    jsonb_build_object(
      'action', 'ai_message',
      'context', p_context,
      'original_description', h.description
    )
  FROM tickets t
  JOIN ticket_history h ON h.id = t.latest_history_id
  WHERE t.id = p_ticket_id;

  RETURN response.content::json;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to handle OpenAI responses
CREATE OR REPLACE FUNCTION handle_outreach_response(
  p_ticket_id UUID,
  p_response TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS void AS $$
BEGIN
  -- Add to ticket history
  INSERT INTO ticket_history (
    ticket_id,
    description,
    changes,
    created_by
  ) VALUES (
    p_ticket_id,
    p_response,
    jsonb_build_object(
      'action', 'ai_response_added',
      'metadata', p_metadata
    ),
    auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION handle_outreach_response(UUID, TEXT, JSONB) TO authenticated;

-- Create RPC function for outreach-gpt
CREATE OR REPLACE FUNCTION invoke_outreach_gpt(
  p_ticket_id UUID,
  p_tone TEXT DEFAULT 'professional',
  p_notes TEXT DEFAULT ''
) RETURNS JSON AS $$
DECLARE
  response RECORD;
BEGIN
  SELECT net.http_post(
    'https://satkuhqfcnmonhxfdmiu.supabase.co/functions/v1/outreach-gpt',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || auth.jwt(),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'ticketId', p_ticket_id,
      'tone', p_tone,
      'speakerNotes', p_notes
    )
  ) INTO response;

  RETURN response.content::json;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission for RPC
GRANT EXECUTE ON FUNCTION invoke_outreach_gpt(UUID, TEXT, TEXT) TO authenticated;

-- Grant permissions
GRANT ALL ON TABLE outreach_templates TO authenticated;
GRANT ALL ON TABLE outreach_messages TO authenticated;
GRANT EXECUTE ON FUNCTION generate_outreach_message TO authenticated;
GRANT EXECUTE ON FUNCTION generate_ticket_message TO authenticated; 
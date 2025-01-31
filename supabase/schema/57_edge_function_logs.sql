-- Create edge function logs table
CREATE TABLE IF NOT EXISTS edge_function_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  function_name TEXT NOT NULL,
  ticket_id UUID REFERENCES tickets(id),
  response JSONB,
  metadata JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Drop all existing policies
DO $$ 
BEGIN
  EXECUTE (
    SELECT string_agg('DROP POLICY IF EXISTS ' || quote_ident(policyname) || ' ON edge_function_logs;', ' ')
    FROM pg_policies 
    WHERE tablename = 'edge_function_logs'
  );
END $$;

-- Enable RLS and create simple policy
ALTER TABLE edge_function_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can access logs" ON edge_function_logs FOR ALL TO authenticated USING (true);

-- Create RPC function
CREATE OR REPLACE FUNCTION test_edge_secret()
RETURNS JSON AS $$
DECLARE
  response RECORD;
BEGIN
  SELECT net.http_post(
    'https://satkuhqfcnmonhxfdmiu.supabase.co/functions/v1/test-secret',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || auth.jwt(),
      'Content-Type', 'application/json'
    )
  ) INTO response;

  INSERT INTO edge_function_logs (function_name, response)
  VALUES ('test-secret', response.content::json);

  RETURN response.content::json;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT ALL ON TABLE edge_function_logs TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE edge_function_logs_id_seq TO authenticated;
GRANT EXECUTE ON FUNCTION test_edge_secret() TO authenticated;

-- Add RLS
ALTER TABLE edge_function_logs ENABLE ROW LEVEL SECURITY;

-- Policy for viewing logs
CREATE POLICY "Users can view logs for their org's tickets" ON edge_function_logs
  FOR SELECT USING (
    ticket_id IN (
      SELECT t.id FROM tickets t
      JOIN profiles p ON p.org_id = t.org_id
      WHERE p.id = auth.uid()
    )
  );

-- You can check the results with:
-- SELECT * FROM edge_function_logs ORDER BY created_at DESC LIMIT 1; 
-- First, let's get the organization and profile IDs
WITH org_profile AS (
  SELECT 
    o.id as org_id,
    p.id as profile_id
  FROM organizations o
  JOIN profiles p ON p.org_id = o.id
  -- Assuming you want the first org and its admin
  WHERE p.role = 'admin'
  LIMIT 1
)
INSERT INTO kb_articles (
    title,
    content,
    org_id,
    created_by,
    updated_by,
    metadata
)
SELECT 
    'Professional Canoe Repair Guide and Pricing',
    'DAMAGE ASSESSMENT AND PRICING:

1. Minor Repairs (Under $200)
- Scratches and surface gouges
- Small cracks under 3 inches
- Gelcoat touch-ups
- Labor: 1-2 hours
- Materials: $40-60

2. Moderate Repairs ($200-400)
- Cracks 3-6 inches
- Deep gouges requiring fiberglass
- Small hull punctures
- Labor: 2-4 hours
- Materials: $75-150

3. Major Repairs ($400-800)
- Structural damage
- Large cracks over 6 inches
- Multiple repair areas
- Labor: 4-8 hours
- Materials: $150-300

REPAIR PROCESS:
1. Initial Assessment
2. Surface Preparation
3. Structural Repair (if needed)
4. Gelcoat Application
5. Finishing and Quality Check

MATERIALS USED:
- Marine-grade fiberglass
- UV-resistant gelcoat
- Epoxy resin system
- Professional-grade tools

WARRANTY:
- 1 year on workmanship
- 90 days on cosmetic finish

TURNAROUND TIME:
- Minor repairs: 1-2 days
- Moderate repairs: 2-4 days
- Major repairs: 4-7 days',
    org_id,
    profile_id,
    profile_id,
    jsonb_build_object(
        'tags', ARRAY['canoe', 'repair', 'pricing', 'fiberglass'],
        'category', 'repairs',
        'last_updated', CURRENT_TIMESTAMP
    )
FROM org_profile;
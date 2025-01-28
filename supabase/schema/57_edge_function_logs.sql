-- Create a table to log edge function calls and responses
CREATE TABLE IF NOT EXISTS edge_function_logs (
  id BIGSERIAL PRIMARY KEY,
  function_name TEXT,
  response JSON,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
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

-- You can check the results with:
-- SELECT * FROM edge_function_logs ORDER BY created_at DESC LIMIT 1; 
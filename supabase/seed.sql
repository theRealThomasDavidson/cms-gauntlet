-- Load schemas in order
\echo 'Loading auth schema...'
\i schema/00_auth.sql

\echo 'Loading organizations schema...'
\i schema/10_organizations.sql

\echo 'Loading user profiles schema...'
\i schema/20_user_profiles.sql

\echo 'Loading workflows schema...'
\i schema/30_workflows.sql

\echo 'Loading workflow permissions schema...'
\i schema/35_workflow_permissions.sql

\echo 'Loading tickets schema...'
\i schema/40_tickets.sql

\echo 'Loading tickets RPC schema...'
\i schema/45_tickets_rpc.sql

\echo 'Loading notifications schema...'
\i schema/50_notifications.sql

\echo 'Loading edge function logs schema...'
\i schema/57_edge_function_logs.sql

\echo 'Loading outreach GPT schema...'
\i schema/58_outreach_gpt.sql


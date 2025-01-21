# Schema Organization

The schema is split into multiple files that should be executed in the following order:

1. `0_extensions.sql`
   - Enables required PostgreSQL extensions
   - Must run first as other parts depend on these extensions

2. `1_user_profiles.sql`
   - User roles and profile management
   - Core user authentication and authorization
   - Profile table and related functions
   - RLS policies for user access

3. `2_tickets.sql`
   - Ticket management system
   - Ticket history and comments
   - Related RLS policies
   - Depends on profiles for user references

4. `3_workflows.sql`
   - Workflow definitions and steps
   - Hook configurations
   - Related RLS policies
   - Depends on profiles for user references

## Running the Schema

When setting up a new database:
1. Run each file in the specified order
2. Each file is idempotent (can be run multiple times safely)
3. Files use `create or replace` for functions and `if not exists` for tables

## File Contents Overview

### 0_extensions.sql
- UUID extension
- Other required PostgreSQL extensions

### 1_user_profiles.sql
- User role enum
- Profile table
- Profile management functions
- User-related RLS policies
- Profile triggers

### 2_tickets.sql
- Ticket status and priority enums
- Tickets table
- Ticket history
- Comments
- Ticket-related RLS policies

### 3_workflows.sql
- Workflow tables
- Step definitions
- Hook configurations
- Workflow-related RLS policies
- Workflow triggers 
# API Documentation

## Database Functions

### User Management
- `is_admin()`: Checks if the current user has admin role
- `change_role(user_id uuid, new_role user_role)`: Changes a user's role (admin only)
- `delete_user(email text)`: Deletes a user's profile and auth account
- `handle_new_user()`: Trigger function to create profile for new users

### Organization Management
- `get_or_create_default_org()`: Gets or creates a default organization

### Workflow Management
- `get_workflow_stages(workflow_uuid uuid)`: Retrieves all stages for a workflow in order
- `get_stage_hooks(stage_uuid uuid)`: Retrieves active hooks for a stage

### Ticket Management
- `create_ticket(org_id uuid, title text, description text, priority ticket_priority, workflow_id uuid)`: Creates a new ticket
- `update_ticket(ticket_id uuid, title text, description text, priority ticket_priority, assigned_to uuid, stage_id uuid)`: Updates a ticket
- `create_comment_notification()`: Trigger function to notify users of new comments
- `refresh_ticket_stats()`: Refreshes materialized views for ticket statistics

## Row Level Security (RLS) Policies

### Organizations Table
- View: All authenticated users can view organizations
- Create/Update/Delete: Only admins can manage organizations

### Profiles Table
- View: Users can view profiles in their organization
- Update: Users can update their own profile, admins can update any profile
- Delete: Users can delete their own profile, admins can delete any profile

### Workflows Table
- View: Organization members can view workflows
- Create/Update/Delete: Admins and agents can manage workflows

### Workflow Stages Table
- View: Organization members can view stages
- Create/Update/Delete: Admins and agents can manage stages

### Workflow Stage Hooks Table
- View: Organization members can view hooks
- Create/Update/Delete: Admins and agents can manage hooks

### Tickets Table
- View: Users can view tickets in their organization
- Create: Authenticated users can create tickets in their organization
- Update: Admins and agents can update any ticket, users can update their own tickets

### Ticket History Table
- View: Users can view history of tickets they can access
- Create: Generated automatically when tickets are updated

### Ticket Comments Table
- View: Users can view comments on tickets they can access
- Create: Users can create comments on their tickets, agents/admins can create internal comments

### Ticket Attachments Table
- View: Users can view attachments on tickets they can access
- Create: Users can add attachments to their tickets

## Client API Usage

### Authentication
```javascript
// Sign up
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'password'
})

// Sign in
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password'
})

// Sign out
const { error } = await supabase.auth.signOut()
```

### Profile Management
```javascript
// Get user profile
const { data: profile } = await supabase
  .from('profiles')
  .select('*')
  .eq('auth_id', user.id)
  .single()

// Update profile
const { error } = await supabase
  .from('profiles')
  .update({ name: 'New Name' })
  .eq('auth_id', user.id)
```

### Workflow Management
```javascript
// Create workflow
const { data, error } = await supabase
  .from('workflows')
  .insert({
    name: 'New Workflow',
    description: 'Description',
    org_id: orgId
  })

// Get workflow stages
const { data: stages } = await supabase
  .rpc('get_workflow_stages', {
    workflow_uuid: workflowId
  })

// Add workflow stage
const { data, error } = await supabase
  .from('workflow_stages')
  .insert({
    workflow_id: workflowId,
    name: 'New Stage',
    is_start: true
  })

// Add stage hook
const { data, error } = await supabase
  .from('workflow_stage_hooks')
  .insert({
    stage_id: stageId,
    hook_type: 'notification',
    config: {
      target_type: 'role',
      target_role: 'admin',
      message: 'New ticket in stage'
    }
  })
```

### Ticket Management
```javascript
// Create ticket
const { data: ticketId } = await supabase
  .rpc('create_ticket', {
    p_org_id: orgId,
    p_title: 'New Ticket',
    p_description: 'Description',
    p_priority: 'medium',
    p_workflow_id: workflowId
  })

// Update ticket
const { data: historyId } = await supabase
  .rpc('update_ticket', {
    p_ticket_id: ticketId,
    p_title: 'Updated Title',
    p_assigned_to: agentId,
    p_stage_id: newStageId
  })

// Add comment
const { data, error } = await supabase
  .from('ticket_comments')
  .insert({
    ticket_id: ticketId,
    content: 'New comment',
    is_internal: false
  })

// Add attachment
const { data, error } = await supabase
  .from('ticket_attachments')
  .insert({
    ticket_id: ticketId,
    file_name: 'document.pdf',
    file_type: 'application/pdf',
    file_size: 1024,
    storage_path: 'tickets/123/document.pdf'
  })
``` 
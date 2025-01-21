# API Documentation

## Database Functions

### User Management
- `is_admin()`: Checks if the current user has admin role
- `change_role(user_email text, new_role text)`: Changes a user's role (admin only)
- `delete_user(target_email text)`: Deletes a user's profile and auth account

### Workflow Management
- `get_workflow_stages(workflow_uuid uuid)`: Retrieves all stages for a workflow in order
- `get_stage_hooks(stage_uuid uuid)`: Retrieves active hooks for a stage

## Row Level Security (RLS) Policies

### Organizations Table
- View: All authenticated users can view their own organization
- Create/Update: Only admins can create or modify organizations

### Profiles Table
- View: Users can view profiles in their organization
- Update: Users can update their own profile, admins can update any profile
- Delete: Users can delete their own profile, admins can delete any profile

### Workflows Table
- View: Organization members can view workflows
- Create/Update: Admins and agents can manage workflows
- Delete: Admins and agents can delete workflows

### Workflow Stages Table
- View: Organization members can view stages
- Create/Update/Delete: Admins and agents can manage stages

### Workflow Stage Hooks Table
- View: Organization members can view hooks
- Create/Update/Delete: Admins and agents can manage hooks

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
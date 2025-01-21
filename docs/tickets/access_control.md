# Ticket Access Control

## User Roles

### Admin
- Full access to all tickets and features
- Can configure workflows and stages
- Can manage internal comments
- Can delete tickets
- Can assign to anyone
- Can set any priority level

### Agent
- Full access to tickets
- Can view/add internal comments
- Can transition between any stages
- Can assign tickets
- Can set priority levels
- Cannot delete tickets

### User
- Can create tickets
- Can view their created/assigned tickets
- Can comment externally
- Can add attachments
- Cannot view internal comments
- Cannot change priority/assignment
- Limited stage transitions

### Guest
- Read-only access to relevant tickets
- Can view external comments
- Can add external comments
- Cannot create tickets
- Cannot add attachments
- Cannot transition stages

## View-Specific Permissions

### List View
- **Admin/Agent**
  - View all tickets
  - Bulk actions
  - All filters available
  - Quick edit capabilities
- **User**
  - View created/assigned tickets
  - Basic filters
  - No bulk actions
- **Guest**
  - View only relevant tickets
  - Basic filters
  - No actions

### Detail View
- **Admin/Agent**
  - Edit all fields
  - Internal/external comments
  - File management
  - Stage transitions
  - Assignment changes
- **User**
  - View all fields
  - External comments only
  - Add attachments
  - Basic field updates
- **Guest**
  - View basic fields
  - External comments only
  - No file upload
  - No transitions

### Form View
- **Admin/Agent**
  - Create for anyone
  - All fields editable
  - Workflow selection
  - Stage selection
  - Priority setting
- **User**
  - Create for self
  - Basic fields only
  - Default workflow
  - Default priority
  - No assignment
- **Guest**
  - No access

## Field-Level Permissions

### Always Editable
- Title
- Description
- External comments
- Basic attachments

### Admin/Agent Only
- Priority
- Assignment
- Workflow
- Stage transitions
- Internal comments
- Ticket deletion

### Never Editable
- Created by
- Created at
- Ticket ID
- History entries 
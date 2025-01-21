# Views Documentation

## Ticket Views

### Ticket List View
**Component**: `TicketListView`
**Path**: `/tickets`

**Access Control**:
- **View Access**: All authenticated users
- **Filter Options**:
  - Admin/Agent: Can filter by all fields
  - User: Can only filter by their created/assigned tickets
- **Actions**:
  - Admin/Agent: Can bulk update, delete, reassign
  - User: Can only create new tickets
  - Guest: Read-only view of relevant tickets

**Data Requirements**:
```typescript
{
  tickets: {
    id: string
    title: string
    priority: 'low' | 'medium' | 'high' | 'urgent'
    currentStage: {
      id: string
      name: string 
    }
    assignedTo?: {
      id: string
      name: string
    }
    createdAt: string
    updatedAt: string
  }[]
  filters: {
    priority: string[]
    stageId: string[]
    assignedTo: string[]
    search: string
  }
  pagination: {
    page: number
    perPage: number
    total: number
  }
}
```

**Key Features**:
- Filterable table/grid of tickets
- Quick priority updates
- Stage transition buttons
- Assignment dropdown
- Create ticket button
- Click through to detail view

### Ticket Detail View
**Component**: `TicketDetailView` 
**Path**: `/tickets/:id`

**Access Control**:
- **View Access**: All authenticated users with access to the ticket
- **Comments**:
  - Admin/Agent: Can view/add internal and external comments
  - User: Can only view/add external comments
  - Guest: Can only view external comments
- **Actions**:
  - Admin/Agent: Can edit all fields, transition stages, manage attachments
  - User: Can comment, add attachments, update basic fields
  - Guest: Can only view and comment

**Data Requirements**:
```typescript
{
  ticket: {
    id: string
    title: string
    description: string
    priority: 'low' | 'medium' | 'high' | 'urgent'
    currentStage: {
      id: string
      name: string
      description: string
    }
    workflow: {
      id: string
      name: string
    }
    assignedTo?: {
      id: string
      name: string
      email: string
    }
    createdBy: {
      id: string
      name: string
    }
    createdAt: string
    updatedAt: string
  }
  comments: {
    id: string
    content: string
    isInternal: boolean
    createdBy: {
      id: string
      name: string
    }
    createdAt: string
  }[]
  attachments: {
    id: string
    fileName: string
    fileType: string
    fileSize: number
    uploadedBy: {
      id: string
      name: string
    }
    uploadedAt: string
  }[]
  history: {
    id: string
    changes: {
      field: string
      oldValue: any
      newValue: any
    }[]
    changedBy: {
      id: string
      name: string
    }
    changedAt: string
  }[]
}
```

**Key Features**:
- Ticket title and description
- Priority indicator/selector
- Current stage with transition options
- Assignment management
- Comment thread with internal/external toggle
- File attachments
- Edit history timeline
- Back to list navigation

### Create/Edit Ticket View
**Component**: `TicketFormView`
**Path**: `/tickets/new` or `/tickets/:id/edit`

**Access Control**:
- **Create New**:
  - Admin/Agent: Can create tickets for anyone
  - User: Can create tickets for themselves
  - Guest: No access
- **Edit Existing**:
  - Admin/Agent: Can edit all fields
  - User: Can only edit basic fields of their tickets
  - Guest: No access
- **Field Restrictions**:
  - Workflow Selection: Admin/Agent only
  - Priority: Admin/Agent only
  - Assignment: Admin/Agent only
  - Basic Fields (title, description): All creators

**Data Requirements**:
```typescript
{
  // For editing
  ticket?: {
    id: string
    title: string
    description: string
    priority: 'low' | 'medium' | 'high' | 'urgent'
    assignedTo?: string
  }
  // For new tickets
  workflows: {
    id: string
    name: string
    stages: {
      id: string
      name: string
      isStart: boolean
    }[]
  }[]
  // Shared
  users: {
    id: string
    name: string
    role: string
  }[]
  priorities: {
    value: string
    label: string
  }[]
}
```

**Key Features**:
- Title and description fields
- Priority selection
- Workflow selection (new tickets only)
- Initial stage selection (new tickets only)
- Assignment selection
- File upload
- Save/Cancel buttons

## Shared Components

### TicketPriorityBadge
- Displays priority level with appropriate color
- Used in list and detail views
- Color coding:
  - Low: Gray
  - Medium: Blue
  - High: Orange
  - Urgent: Red

### StageTransitionButtons  
- Shows available next/previous stages
- Handles stage transitions
- Used in list and detail views
- Disabled based on user permissions
- Shows transition confirmation for important stages

### TicketCommentThread
- Displays threaded comments
- Toggles internal/external visibility
- Used in detail view
- Handles markdown formatting
- Shows user avatars and timestamps
- Indicates edited comments

### TicketAttachmentList
- Displays and manages attachments
- Handles file uploads
- Used in detail and form views
- Shows file type icons
- Displays file size and upload date
- Provides download links 
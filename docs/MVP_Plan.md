# AutoCRM Development Plan

## Current Status (End of Day)
### Completed
- [x] Authentication working with GitHub OAuth via Supabase
- [x] Dashboard UI implemented with navigation
- [x] Workflow UI Components:
  - [x] Stage creation form
  - [x] Stage listing and organization
  - [x] Stage name editing
  - [x] Stage description as textarea
  - [x] Delete stage functionality
  - [x] Stage notification configuration
  - [x] Visual styling
  - [x] Add stage form with validation
- [x] Workflow Management:
  - [x] Database schema for workflows and stages
  - [x] RPC functions with proper permissions
  - [x] Stage notification system
  - [x] Linked list structure for stages

### In Progress
- [ ] Ticket System Integration:
  - [x] Database schema for tickets, history, comments, attachments
  - [x] Service layer API functions
  - [ ] Connection to workflow stages
  - [ ] UI implementation
- [ ] Notification System:
  - [x] Stage notification configuration
  - [ ] In-app notifications
  - [ ] Notification preferences
  - [ ] Notification triggers

## Next 2 Days Plan
### Day 1: Ticket System Integration
1. Morning: Ticket Core Features (9am-12pm)
   - [ ] Connect tickets to workflows
     - [ ] Add workflow_id and stage_id to tickets table
     - [ ] Create RPC functions for ticket-workflow operations
     - [ ] Implement stage transition validation
   - [ ] Ticket Creation
     - [ ] Create ticket form with workflow selection
     - [ ] Initial stage assignment
     - [ ] Basic ticket fields (title, description, priority)
   - [ ] Ticket List View
     - [ ] Basic list display with pagination
     - [ ] Status/stage filtering
     - [ ] Priority filtering
     - [ ] Assignment filtering

2. Afternoon: Ticket Management (1pm-5pm)
   - [ ] Stage Transitions
     - [ ] UI for changing ticket stages
     - [ ] Transition validation
     - [ ] History tracking for changes
   - [ ] Comment System
     - [ ] Internal comments for team
     - [ ] External comments for customers
     - [ ] Rich text editor integration
   - [ ] File Attachments
     - [ ] Upload interface
     - [ ] File type validation
     - [ ] Storage configuration

### Day 2: Notifications & Enhancements
1. Morning: Notification System (9am-12pm)
   - [ ] In-App Notifications
     - [ ] Notification table setup
     - [ ] UI for displaying notifications
     - [ ] Mark as read functionality
   - [ ] Notification Triggers
     - [ ] Ticket creation
     - [ ] Stage changes
     - [ ] Comment additions
     - [ ] Assignment changes
   - [ ] Notification Preferences
     - [ ] Per-user settings
     - [ ] Channel preferences (in-app, email)
     - [ ] Frequency settings

2. Afternoon: UI/UX Improvements (1pm-5pm)
   - [ ] Loading States
     - [ ] Skeleton loaders for lists
     - [ ] Progress indicators for actions
   - [ ] Error Handling
     - [ ] Error boundaries
     - [ ] User-friendly error messages
     - [ ] Recovery actions
   - [ ] Success/Error Toasts
     - [ ] Action confirmation messages
     - [ ] Error notifications
   - [ ] Enhanced Filtering
     - [ ] Combined filters
     - [ ] Save filter preferences
     - [ ] Quick filters

## Success Criteria
- [ ] Users can create and manage tickets
- [ ] Tickets are properly associated with workflow stages
- [ ] Stage transitions are tracked and validated
- [ ] Comments and attachments work reliably
- [ ] Notifications are triggered and delivered
- [ ] UI is responsive and user-friendly
- [ ] Error handling is robust
- [ ] Performance is acceptable under load

## Tomorrow's Specific Tasks
### Morning
1. Database & Security (9am-12pm)
   - [ ] Set up RLS policies for workflows table
     - [ ] Create policy for reading workflows
     - [ ] Create policy for creating workflows
     - [ ] Create policy for updating workflows
     - [ ] Create policy for deleting workflows
   - [ ] Set up RLS policies for workflow_stages table
     - [ ] Link stage permissions to workflow access
     - [ ] Create policy for reading stages
     - [ ] Create policy for creating stages
     - [ ] Create policy for updating stages
     - [ ] Create policy for deleting stages
   - [ ] Add role system columns and policies
     - [ ] Create roles enum type (admin, manager, user)
     - [ ] Add role column to profiles table
     - [ ] Create migration for existing users
     - [ ] Set up role-based policies for each table

### Afternoon
2. Workflow System Completion (1pm-5pm)
   - [ ] Fix workflow save functionality
     - [ ] Test workflow creation with new RLS
     - [ ] Test stage creation with new RLS
     - [ ] Verify stage order is maintained
     - [ ] Add proper error messages
     - [ ] Add loading states
   - [ ] Implement stage transitions
     - [ ] Create transition rules table
     - [ ] Add UI for managing allowed transitions
     - [ ] Add validation for stage movement
     - [ ] Test transition enforcement
   - [ ] Create default workflow template
     - [ ] Basic support workflow stages:
       - [ ] New
       - [ ] In Progress
       - [ ] Pending Review
       - [ ] Resolved
     - [ ] Standard transitions
     - [ ] Default descriptions
     - [ ] Auto-creation for new systems

## Day 1 MVP Components
- [x] Core Authentication
  - [x] GitHub login (Implemented with Supabase Auth)
  - [x] Basic profile creation (Auto-created on GitHub login)
  - [ ] Role-based access (Need to implement RLS policies in Supabase)

- [x] Workflow System Foundation
  - [x] Basic workflow UI
    - [x] Create/Edit workflow form
    - [x] Stage management
    - [x] Visual stage organization
  - [x] Data Management
    - [x] Workflows table structure
    - [x] Workflow stages table structure
    - [ ] RLS policies for workflows
    - [x] Save functionality
  - [ ] Stage Configuration
    - [ ] Stage transition rules
    - [ ] Basic hooks setup
    - [ ] Default workflow template

- [x] Minimal UI
  - [x] Login/Register page (Complete with GitHub OAuth)
  - [x] Dashboard layout (Implemented with sidebar navigation)
  - [x] Workflow management UI
  - [ ] Ticket management UI (Pending workflow system)

- [x] Basic Ticket Management (Initial Implementation Complete)
  - [x] Create tickets
    - [x] Basic ticket creation form
    - [x] Title and description fields
    - [x] Priority selection
    - [x] Initial history entry
    - [x] Organization assignment
  - [x] View tickets list
    - [x] Basic list view implementation
    - [x] Pagination structure
    - [x] Direct table access for admins
    - [x] Loading states
    - [x] Error handling
  - [x] Simple ticket details view
    - [x] Basic information display
    - [x] Service layer implementation
    - [x] Data fetching structure
  - [ ] Basic status updates
    - [ ] Workflow stage display
    - [ ] Stage transition UI
    - [ ] Update history tracking
    - [ ] Assignment interface

## Immediate Tasks (In Priority Order)
1. Implement RLS policies for workflows and stages
2. Complete workflow save functionality
3. Set up basic role system for access control
4. Implement stage transition rules
5. Create default workflow template
6. Create ticket management UI using workflow system
7. Production Configuration
   - [ ] Update Supabase Site URL for production
   - [ ] Configure Supabase redirect URLs
   - [ ] Verify GitHub OAuth settings
   - [ ] Test authentication flow in production
   - [ ] Document environment variables

## Week 1 Full Features
### Workflow System
- [ ] Advanced workflow features
  - [ ] Conditional transitions
  - [ ] Custom hooks
  - [ ] Workflow templates
  - [ ] Stage automation
- [ ] Workflow management
  - [ ] Version control
  - [ ] Import/Export
  - [ ] Analytics

### User Management
- [x] Complete profile management (Using GitHub profile data)
- [ ] Team assignments
- [ ] Role permissions (Next priority after workflows)
- [ ] User preferences

### Ticket System
- [ ] Advanced ticket fields
- [ ] Comments & internal notes
- [ ] File attachments
- [ ] Custom fields
- [ ] Tags and categorization
- [ ] Assignment system
- [ ] Search and filters

### Knowledge Base
- [ ] Article creation
- [ ] Article versioning
- [ ] Categories
- [ ] Search functionality

### Notifications
- [ ] Real-time updates
- [ ] Email notifications
- [ ] Notification preferences

### Admin Features
- [ ] User management
  - [ ] Create users
  - [ ] Edit user roles
  - [ ] Delete users
  - [ ] View user activity
- [ ] Team management
- [ ] System settings
- [ ] Analytics dashboard

### UI/UX
- [x] Responsive design (Using Tailwind CSS)
- [ ] Theme customization
- [ ] Advanced filtering
- [ ] Bulk operations
- [ ] Rich text editing

## Questions for MVP Scope
1. ~~Should we include any knowledge base features in Day 1?~~ No, focusing on workflow and tickets first
2. ~~Do we need team management in MVP?~~ No, will add after basic ticket system
3. ~~What level of notification system for Day 1?~~ None for MVP, will add in Week 1
4. ~~Should we include any admin features in MVP?~~ Only basic role-based access 

## Next Tasks (In Priority Order)
1. Ticket Management Enhancement
   - [ ] Filter Implementation
     - [ ] Priority filters
     - [ ] Status filters
     - [ ] Assignment filters
     - [ ] Date range filters
   - [ ] Sorting Options
     - [ ] By creation date
     - [ ] By priority
     - [ ] By status
     - [ ] By assignee
   - [ ] Details View Enhancement
     - [ ] History timeline
     - [ ] Comments section
     - [ ] File attachments
     - [ ] Edit capabilities

2. Workflow Integration
   - [ ] Status Change UI
     - [ ] Stage transition controls
     - [ ] Validation rules
     - [ ] History tracking
     - [ ] Assignment interface
   - [ ] Workflow Selection
     - [ ] Creation time selection
     - [ ] Post-creation assignment
     - [ ] Default workflow handling
     - [ ] Stage initialization

3. UI/UX Improvements
   - [ ] Loading Skeletons
   - [ ] Error Boundaries
   - [ ] Success/Error Toasts
   - [ ] Responsive Design
   - [ ] Keyboard Shortcuts

4. Database Views
   - [ ] Create agent_tickets materialized view
   - [ ] Create customer_tickets view
   - [ ] Set up refresh mechanism
   - [ ] Add necessary indexes

5. RLS Policies
   - [ ] Set up policies for tickets table
   - [ ] Set up policies for ticket_history
   - [ ] Set up policies for comments
   - [ ] Set up policies for attachments

6. UI Implementation
   - [ ] Ticket list view with filters
   - [ ] Ticket detail view
   - [ ] Comment interface
   - [ ] File upload interface 
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
  - [x] Move up/down controls
  - [x] Delete stage functionality
  - [x] Hooks button placeholder
  - [x] Visual pink box styling
  - [x] Add stage form with validation

### In Progress
- [x] Database Structure:
  - [x] Workflows table created
  - [x] Workflow stages table created
    - [x] confirm this in database
  - [ ] RLS policies missing
  - [ ] Role system not configured

### Blocking Issues
- [ ] RLS policies preventing workflow save
  - [ ] Cannot create new workflows
  - [ ] Cannot update existing workflows
  - [ ] Cannot manage stages
- [ ] Role-based access not implemented
  - [ ] No role column in profiles
  - [ ] No role enum type
  - [ ] No role-based policies
- [ ] Stage transitions not configured
  - [ ] No transition rules table
  - [ ] No UI for managing transitions
  - [ ] No validation logic

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

- [ ] Basic Ticket Management (Pending Workflow Completion)
  - [ ] Create tickets
  - [ ] View tickets list
  - [ ] Simple ticket details view
  - [ ] Basic status updates (Using workflow stages)

## Immediate Tasks (In Priority Order)
1. Implement RLS policies for workflows and stages
2. Complete workflow save functionality
3. Set up basic role system for access control
4. Implement stage transition rules
5. Create default workflow template
6. Create ticket management UI using workflow system

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
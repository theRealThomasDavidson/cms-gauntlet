# Ticket System Documentation

## Overview
The ticket system allows users to create, track, and manage support tickets through customizable workflows. Each ticket follows a workflow's stages and maintains a complete history of changes.

## Components

### Database Schema
- `tickets`: Main ticket records
- `ticket_history`: Change history and state snapshots
- `ticket_comments`: User and agent comments
- `ticket_attachments`: File attachments

### Services
- `TicketService`: Core ticket operations
- `CommentService`: Comment management
- `AttachmentService`: File handling
- Integration with `WorkflowService` for stage management

### Views
1. **TicketsView** (Main List)
   - List all tickets with filtering
   - Create new tickets
   - Quick actions

2. **TicketDetail**
   - Full ticket information
   - History timeline
   - Comments
   - Attachments
   - Stage management

3. **CreateTicketForm**
   - Basic ticket information
   - Workflow selection
   - File attachments

4. **Supporting Components**
   - Comments section
   - History timeline
   - File uploader
   - Stage selector

## Workflow Integration
- Each ticket is associated with a workflow
- New tickets use org's earliest active workflow
- Stage transitions follow workflow rules
- Hooks trigger on stage changes

## Security
- RLS policies control access
- Internal notes for agents only
- Attachment size and type restrictions
- Audit trail via history table

## Future Enhancements
1. Kanban board view
2. Bulk actions
3. Templates
4. SLA tracking
5. Advanced search 
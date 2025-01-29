import { lazy, Suspense } from 'react'
import PropTypes from 'prop-types'

const WorkflowList = lazy(() => import('./Workflow/WorkflowList'))
const WorkflowForm = lazy(() => import('./Workflow/WorkflowForm'))
const WorkflowDetail = lazy(() => import('./Workflow/WorkflowDetail'))
const KanbanBoard = lazy(() => import('./Workflow/KanbanBoard'))
const Dashboard = lazy(() => import('./Dashboard/DashboardView'))
const Tickets = lazy(() => import('./Tickets/TicketsView'))
const Knowledge = lazy(() => import('./Knowledge/KnowledgeView'))
const Profile = lazy(() => import('./Dashboard/ProfileView'))
const NotificationCenter = lazy(() => import('./Notifications/NotificationCenter'))
const TicketDetail = lazy(() => import('./Tickets/TicketDetail'))

export default function Workspace({ 
  activeComponent, 
  workflowState = { view: 'list', id: null },
  ticketId = null,
  onCreateWorkflow,
  onEditWorkflow,
  onViewWorkflow,
  onWorkflowAction,
  onBackToTickets,
  onViewTicket,
  profile 
}) {
  return (
    <div className="p-6 overflow-auto h-[calc(100vh-60px)] min-h-0 relative z-10">
      <Suspense fallback={<div></div>}>
        {activeComponent === 'workflows' && (
          <>
            {workflowState.view === 'list' && (
              <WorkflowList 
                onCreateWorkflow={onCreateWorkflow} 
                onEditWorkflow={onEditWorkflow}
                onViewWorkflow={onViewWorkflow}
                profile={profile}
              />
            )}
            {workflowState.view === 'new' && (
              <WorkflowForm 
                onCancel={() => onWorkflowAction('list')}
                profile={profile}
              />
            )}
            {workflowState.view === 'edit' && (
              <WorkflowForm 
                id={workflowState.id} 
                onCancel={() => onWorkflowAction('list')}
                profile={profile}
              />
            )}
            {workflowState.view === 'detail' && (
              <WorkflowDetail 
                id={workflowState.id} 
                onBack={() => onWorkflowAction('list')}
                onEdit={onEditWorkflow}
                profile={profile}
              />
            )}
            {workflowState.view === 'kanban' && (
              <KanbanBoard
                workflowId={workflowState.id}
                profile={profile}
              />
            )}
          </>
        )}
        {activeComponent === 'dashboard' && <Dashboard profile={profile} />}
        {activeComponent === 'tickets' && (
          ticketId ? (
            <TicketDetail 
              ticketId={ticketId} 
              onBack={onBackToTickets}
            />
          ) : (
            <Tickets profile={profile} />
          )
        )}
        {activeComponent === 'knowledge' && <Knowledge profile={profile} />}
        {activeComponent === 'profile' && <Profile profile={profile} />}
        {activeComponent === 'notifications' && (
          <NotificationCenter onViewTicket={onViewTicket} />
        )}
      </Suspense>
    </div>
  )
}

Workspace.propTypes = {
  activeComponent: PropTypes.string.isRequired,
  workflowState: PropTypes.shape({
    view: PropTypes.oneOf(['list', 'new', 'edit', 'detail', 'kanban']),
    id: PropTypes.string
  }),
  ticketId: PropTypes.string,
  onCreateWorkflow: PropTypes.func.isRequired,
  onEditWorkflow: PropTypes.func.isRequired,
  onViewWorkflow: PropTypes.func.isRequired,
  onWorkflowAction: PropTypes.func.isRequired,
  onBackToTickets: PropTypes.func.isRequired,
  onViewTicket: PropTypes.func.isRequired,
  profile: PropTypes.shape({
    // Add appropriate prop types for the profile shape
  })
} 
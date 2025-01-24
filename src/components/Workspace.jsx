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

export default function Workspace({ 
  activeComponent, 
  workflowState = { view: 'list', id: null }, 
  onCreateWorkflow,
  onEditWorkflow,
  onViewWorkflow,
  onWorkflowAction,
  profile 
}) {
  const renderComponent = () => {
    return (
      <Suspense fallback={<div>Loading...</div>}>
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
        {activeComponent === 'tickets' && <Tickets profile={profile} />}
        {activeComponent === 'knowledge' && <Knowledge profile={profile} />}
        {activeComponent === 'profile' && <Profile />}
      </Suspense>
    )
  }

  return (
    <main style={{
      marginLeft: '200px',  // Width of sidebar
      marginTop: '60px',    // Height of topbar
      padding: '20px',
      paddingBottom: '200px',  // Extra space at bottom
      minHeight: 'calc(100vh - 60px)',
      overflowY: 'auto',
      height: 'calc(100vh - 60px)',  // Fixed height to enable scroll
      position: 'fixed',
      right: 0,
      left: '200px',  // Same as marginLeft
      top: '60px'     // Same as marginTop
    }}>
      {renderComponent()}
    </main>
  )
}

Workspace.propTypes = {
  activeComponent: PropTypes.string.isRequired,
  workflowState: PropTypes.shape({
    view: PropTypes.oneOf(['list', 'new', 'edit', 'detail', 'kanban']),
    id: PropTypes.string
  }),
  onCreateWorkflow: PropTypes.func.isRequired,
  onEditWorkflow: PropTypes.func.isRequired,
  onViewWorkflow: PropTypes.func.isRequired,
  onWorkflowAction: PropTypes.func.isRequired,
  profile: PropTypes.shape({
    // Add appropriate prop types for the profile shape
  })
} 
import { lazy, Suspense } from 'react'
import PropTypes from 'prop-types'

const WorkflowList = lazy(() => import('./Workflow/WorkflowList'))
const WorkflowForm = lazy(() => import('./Workflow/WorkflowForm'))
const WorkflowDetail = lazy(() => import('./Workflow/WorkflowDetail'))
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
  onWorkflowAction 
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
              />
            )}
            {workflowState.view === 'new' && (
              <WorkflowForm 
                onCancel={() => onWorkflowAction('list')} 
              />
            )}
            {workflowState.view === 'edit' && (
              <WorkflowForm 
                id={workflowState.id} 
                onCancel={() => onWorkflowAction('list')} 
              />
            )}
            {workflowState.view === 'detail' && (
              <WorkflowDetail 
                id={workflowState.id} 
                onBack={() => onWorkflowAction('list')}
                onEdit={onEditWorkflow}
              />
            )}
          </>
        )}
        {activeComponent === 'dashboard' && <Dashboard />}
        {activeComponent === 'tickets' && <Tickets />}
        {activeComponent === 'knowledge' && <Knowledge />}
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
    view: PropTypes.oneOf(['list', 'new', 'edit', 'detail']),
    id: PropTypes.string
  }),
  onCreateWorkflow: PropTypes.func.isRequired,
  onEditWorkflow: PropTypes.func.isRequired,
  onViewWorkflow: PropTypes.func.isRequired,
  onWorkflowAction: PropTypes.func.isRequired
} 
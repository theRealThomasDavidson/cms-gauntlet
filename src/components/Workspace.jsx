import { lazy, Suspense } from 'react'

const Workflow = lazy(() => import('./Workflow'))
const Dashboard = lazy(() => import('./Dashboard/DashboardView'))
const Tickets = lazy(() => import('./Tickets/TicketsView'))
const Knowledge = lazy(() => import('./Knowledge/KnowledgeView'))
const Profile = lazy(() => import('./Dashboard/ProfileView'))

export default function Workspace({ activeComponent }) {
  const renderComponent = () => {
    return (
      <Suspense fallback={<div>Loading...</div>}>
        {activeComponent === 'workflows' && <Workflow />}
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
      minHeight: 'calc(100vh - 60px)'
    }}>
      {renderComponent()}
    </main>
  )
} 
import { TopBar } from '../components/TopBar'
import SideBar from '../components/SideBar'
import Workspace from '../components/Workspace'
import { useState } from 'react'

export default function Dashboard() {
  const [activeComponent, setActiveComponent] = useState('dashboard')
  const [workflowState, setWorkflowState] = useState({ view: 'list', id: null })

  const handleCreateWorkflow = () => {
    setActiveComponent('workflows')
    setWorkflowState({ view: 'new', id: null })
  }

  const handleEditWorkflow = (id) => {
    setActiveComponent('workflows')
    setWorkflowState({ view: 'edit', id })
  }

  const handleViewWorkflow = (id) => {
    setActiveComponent('workflows')
    setWorkflowState({ view: 'detail', id })
  }

  const handleWorkflowAction = () => {
    setActiveComponent('workflows')
    setWorkflowState({ view: 'list', id: null })
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TopBar />
      <div className="flex-1 flex overflow-hidden">
        <SideBar 
          setActiveComponent={setActiveComponent}
          onCreateWorkflow={handleCreateWorkflow}
          onWorkflowAction={handleWorkflowAction}
        />
        <Workspace 
          activeComponent={activeComponent} 
          workflowState={workflowState}
          onCreateWorkflow={handleCreateWorkflow}
          onEditWorkflow={handleEditWorkflow}
          onViewWorkflow={handleViewWorkflow}
          onWorkflowAction={handleWorkflowAction}
        />
      </div>
    </div>
  )
} 
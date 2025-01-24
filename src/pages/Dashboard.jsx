import { TopBar } from '../components/TopBar'
import SideBar from '../components/SideBar'
import Workspace from '../components/Workspace'
import { useState, useEffect } from 'react'
import { getVisibleProfiles } from '../lib/supabaseClient'
import { useNavigate, useLocation } from 'react-router-dom'

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeComponent, setActiveComponent] = useState('dashboard')
  const [workflowState, setWorkflowState] = useState({ view: 'list', id: null })
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadProfile()
  }, [])

  // Handle URL-based navigation
  useEffect(() => {
    const path = location.pathname;
    const match = path.match(/^\/workflows\/([^/]+)\/kanban$/);
    if (match) {
      const workflowId = match[1];
      setActiveComponent('workflows');
      setWorkflowState({ view: 'kanban', id: workflowId });
    }
  }, [location]);

  const loadProfile = async () => {
    try {
      const profiles = await getVisibleProfiles()
      // First profile is always the current user
      setProfile(profiles[0])
    } catch (err) {
      console.error('Error loading profile:', err)
    } finally {
      setLoading(false)
    }
  }

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

  const handleWorkflowAction = (view = 'list', id = null) => {
    setActiveComponent('workflows')
    setWorkflowState({ view, id })
  }

  if (loading) return <div>Loading...</div>

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TopBar />
      <div className="flex-1 flex overflow-hidden">
        <SideBar 
          setActiveComponent={setActiveComponent}
          onCreateWorkflow={handleCreateWorkflow}
          onWorkflowAction={handleWorkflowAction}
          profile={profile}
        />
        <Workspace 
          activeComponent={activeComponent} 
          workflowState={workflowState}
          onCreateWorkflow={handleCreateWorkflow}
          onEditWorkflow={handleEditWorkflow}
          onViewWorkflow={handleViewWorkflow}
          onWorkflowAction={handleWorkflowAction}
          profile={profile}
        />
      </div>
    </div>
  )
} 
import { Button } from './ui/button'
import { Workflow, Ticket, BookOpen, UserCircle } from 'lucide-react'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import PropTypes from 'prop-types'

export default function SideBar({ setActiveComponent, onWorkflowAction }) {
  const [userRole, setUserRole] = useState(null)

  useEffect(() => {
    getUserRole()
  }, [])

  const getUserRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('auth_id', user.id)
        .single()

      if (profile) {
        setUserRole(profile.role)
      }
    } catch (error) {
      console.error('Error fetching user role:', error)
    }
  }

  return (
    <div style={{ 
      border: '2px solid green', 
      backgroundColor: 'lightgreen',
      width: '200px',
      height: 'calc(100vh - 60px)', // subtracting TopBar height
      position: 'fixed',
      left: 0,
      top: '60px',  // Accounting for the TopBar's border
      overflowY: 'auto',
      margin: 0
    }}>
      <nav className="space-y-2 p-4">
        {/* Workflows - Only for agents and admins */}
        {(userRole === 'admin' || userRole === 'agent') && (
          <>
            <Button 
              onClick={() => onWorkflowAction('list')}
              className="w-full justify-start"
            >
              <Workflow className="h-4 w-4 mr-2" />
              Workflows
            </Button>
            <br />
          </>
        )}

        {/* Tickets - For all users */}
        <Button 
          onClick={() => setActiveComponent('tickets')}
          className="w-full justify-start"
        >
          <Ticket className="h-4 w-4 mr-2" />
          Tickets
        </Button>
        <br />

        {/* Knowledge Base - For all users */}
        <Button 
          onClick={() => setActiveComponent('knowledge')}
          className="w-full justify-start"
        >
          <BookOpen className="h-4 w-4 mr-2" />
          Knowledge Base
        </Button>
        <br />

        {/* Profile - For all users */}
        <Button 
          onClick={() => setActiveComponent('profile')}
          className="w-full justify-start"
        >
          <UserCircle className="h-4 w-4 mr-2" />
          Profile
        </Button>
      </nav>
    </div>
  )
}

SideBar.propTypes = {
  setActiveComponent: PropTypes.func.isRequired,
  onWorkflowAction: PropTypes.func.isRequired
} 
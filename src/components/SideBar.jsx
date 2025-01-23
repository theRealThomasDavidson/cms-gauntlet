import { Button } from './ui/button'
import { Workflow, Ticket, BookOpen, UserCircle } from 'lucide-react'
import { useState, useEffect } from 'react'
import { auth } from '../lib/api'
import { supabase } from '../lib/supabaseClient'
import PropTypes from 'prop-types'

export default function SideBar({ setActiveComponent, onWorkflowAction }) {
  const [userRole, setUserRole] = useState(null)

  useEffect(() => {
    let mounted = true
    
    const fetchRole = async () => {
      try {
        const { data: { user } } = await auth.getUser()
        if (!user || !mounted) return

        const { data: profile, error } = await supabase
          .rpc('get_profile_by_auth_id', { user_auth_id: user.id })
        
        if (error || !mounted) return
        
        if (profile) {
          setUserRole(profile.role)
        }
      } catch (error) {
        console.error('Error fetching user role:', error)
      }
    }

    fetchRole()
    return () => {
      mounted = false
    }
  }, [])

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
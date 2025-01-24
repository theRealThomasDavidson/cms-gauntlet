import { Button } from './ui/button'
import { Workflow, Ticket, BookOpen, UserCircle, Bell } from 'lucide-react'
import { useState, useEffect } from 'react'
import { auth } from '../lib/api'
import { supabase } from '../lib/supabaseClient'
import PropTypes from 'prop-types'

export default function SideBar({ setActiveComponent, onWorkflowAction }) {
  const [userRole, setUserRole] = useState(null)
  const [unreadCount, setUnreadCount] = useState(0)

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

    const fetchUnreadCount = async () => {
      try {
        const { data, error } = await supabase
          .rpc('get_user_notifications', {
            p_include_read: false,  // Only get unread notifications
            p_limit: 50, 
            p_status: 'pending'     // Only pending notifications
          });

        if (error) throw error;
        
        if (mounted && data) {
          setUnreadCount(data.length);
        }
      } catch (error) {
        console.error('Error fetching unread count:', error);
      }
    };

    // Subscribe to notifications
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notification_logs'
        },
        (payload) => {
          // Only increment if the notification is for this user
          const notification = payload.new
          const userId = supabase.auth.user()?.id
          if (userId && (
            notification.recipient_id === userId ||
            notification.recipient_role === userRole
          )) {
            setUnreadCount(prev => prev + 1)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notification_reads'
        },
        () => {
          // Refresh unread count when notifications are marked as read
          fetchUnreadCount()
        }
      )
      .subscribe()

    // Initial fetch
    fetchRole()
    fetchUnreadCount()

    return () => {
      mounted = false
      channel.unsubscribe()
    }
  }, [userRole]) // Added userRole as dependency since we use it in subscription

  return (
    <div style={{ 
      border: '2px solid green', 
      backgroundColor: 'lightgreen',
      width: '200px',
      height: 'calc(100vh - 60px)',
      position: 'fixed',
      left: 0,
      top: '60px',
      overflowY: 'auto',
      margin: 0,
      zIndex: 10
    }}>
      <nav className="space-y-2 p-4">
        {/* Notifications - For all users */}
        <div className="relative inline-block w-full">
          <Button 
            onClick={() => {
              setActiveComponent('notifications')
            }}
            className="w-full justify-start bg-white hover:bg-gray-100"
            variant="outline"
          >
            <Bell className="h-4 w-4 mr-2" />
            Notifications
            {unreadCount > 0 && (
              <span className="absolute right-2 top-1/2 -translate-y-1/2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </Button>
        </div>

        {/* Workflows - Only for agents and admins */}
        {(userRole === 'admin' || userRole === 'agent') && (
          <Button 
            onClick={() => onWorkflowAction('list')}
            className="w-full justify-start"
          >
            <Workflow className="h-4 w-4 mr-2" />
            Workflows
          </Button>
        )}

        {/* Tickets - For all users */}
        <Button 
          onClick={() => setActiveComponent('tickets')}
          className="w-full justify-start"
        >
          <Ticket className="h-4 w-4 mr-2" />
          Tickets
        </Button>

        {/* Knowledge Base - For all users */}
        <Button 
          onClick={() => setActiveComponent('knowledge')}
          className="w-full justify-start"
        >
          <BookOpen className="h-4 w-4 mr-2" />
          Knowledge Base
        </Button>

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
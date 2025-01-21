import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import ProfileView from './ProfileView'

export default function DashboardView() {
  const [loading, setLoading] = useState(true)
  const [needsSetup, setNeedsSetup] = useState(false)

  useEffect(() => {
    checkProfileSetup()
  }, [])

  const checkProfileSetup = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('auth_id', user.id)
        .single()

      // If username or name matches email, profile needs setup
      if (profile && (profile.username === profile.email || profile.name === profile.email)) {
        setNeedsSetup(true)
      }
    } catch (err) {
      console.error('Error checking profile:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div>Loading...</div>
  
  // Show profile setup if needed
  if (needsSetup) {
    return <ProfileView />
  }

  // Regular dashboard view
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Dashboard Overview</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="p-6 bg-white rounded-lg shadow-sm border">
          <h3 className="font-semibold mb-2">Quick Actions</h3>
          <ul className="space-y-2 text-sm">
            <li>✨ View your tickets</li>
            <li>📝 Create new ticket</li>
            <li>👥 Manage your profile</li>
          </ul>
        </div>
        <div className="p-6 bg-white rounded-lg shadow-sm border">
          <h3 className="font-semibold mb-2">Recent Activity</h3>
          <p className="text-sm text-gray-600">No recent activity to show</p>
        </div>
        <div className="p-6 bg-white rounded-lg shadow-sm border">
          <h3 className="font-semibold mb-2">System Status</h3>
          <p className="text-sm text-green-600">All systems operational ✅</p>
        </div>
      </div>
    </div>
  )
} 
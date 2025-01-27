import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import ProfileView from './ProfileView'

// Debug imports
console.log('Imports loaded in DashboardView:', {
  supabase,
  ProfileView
})

// Add error boundary logging
console.log('DashboardView imports loaded:', { supabase, ProfileView })

export default function DashboardView() {
  const [loading, setLoading] = useState(true)
  const [needsSetup, setNeedsSetup] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    checkProfileSetup().catch(err => {
      console.error('Profile setup error:', err)
      console.error('Error stack:', err.stack)
      setError(err)
    })
  }, [])

  const checkProfileSetup = async () => {
    try {
      console.log('Checking profile setup...')
      const { data: { user } } = await supabase.auth.getUser()
      console.log('User data:', user)
      if (!user) return

      const { data: profile, error: profileError } = await supabase
        .rpc('get_profile_by_auth_id', { user_auth_id: user.id })
        .single()
      
      if (profileError) {
        console.error('Profile fetch error:', profileError)
        throw profileError
      }

      console.log('Profile data:', profile)
      // If username or name matches email, profile needs setup
      if (profile && (profile.username === profile.email || profile.name === profile.email)) {
        setNeedsSetup(true)
      }
    } catch (err) {
      console.error('Error in checkProfileSetup:', err)
      console.error('Error stack:', err.stack)
      setError(err)
      throw err
    } finally {
      setLoading(false)
    }
  }

  if (error) return (
    <div className="p-4 text-red-500">
      <h3>Error loading dashboard:</h3>
      <pre className="mt-2 p-2 bg-red-50 rounded">
        {error.message}
        {'\n\n'}
        {error.stack}
      </pre>
    </div>
  )

  if (loading) return <div>Loading...</div>
  
  // Show profile setup if needed
  if (needsSetup) {
    console.log('Rendering ProfileView for setup')
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
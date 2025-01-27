import { LogOut } from "lucide-react"
import { supabase } from '../lib/supabaseClient'
import { useNavigate } from 'react-router-dom'
import './TopBar.css'

export function TopBar() {
  console.log('TopBar component rendered')
  const navigate = useNavigate()

  const handleSignOut = async () => {
    console.log('Logout button clicked - handleSignOut called')
    try {
      console.log('Attempting to sign out...')
      // First try to remove all subscriptions
      try {
        await supabase.removeAllChannels()
      } catch (e) {
        console.log('Error removing channels:', e)
      }
      
      // Then attempt to sign out
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      
      console.log('Successfully signed out, navigating to login')
      // Clear any local storage
      localStorage.clear()
      sessionStorage.clear()
      
      // Navigate after cleanup
      navigate('/login')
    } catch (error) {
      console.error('Error during sign out:', error)
      // If we fail to sign out properly, still clear storage and redirect
      localStorage.clear()
      sessionStorage.clear()
      navigate('/login')
    }
  }

  return (
    <div style={{ 
      border: '2px solid blue', 
      backgroundColor: 'lightblue',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '60px',
      margin: 0,
      padding: 0,
      zIndex: 999
    }}>
      <h1 style={{ fontSize: '14px' }}>AutoCRM</h1>
      <button 
        style={{ 
          position: 'absolute', 
          right: 0,
          height: '60px',
          padding: '0 20px',
          display: 'flex',
          alignItems: 'center',
          cursor: 'pointer',
          backgroundColor: '#2563eb',
          color: 'white',
          border: 'none',
          zIndex: 1000
        }} 
        className="topbar-button" 
        onClick={handleSignOut}
      >
        <LogOut className="h-5 w-5 mr-2" />
        Logout
      </button>
    </div>
  )
}
  
  
import { LogOut } from "lucide-react"
import { supabase } from '../../lib/supabaseClient'
import { useNavigate } from 'react-router-dom'
import './TopBar.css'

export function TopBar() {
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/login')
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
      padding: 0
    }}>
      <h1 style={{ fontSize: '14px' }}>AutoCRM</h1>
      <button style={{ position: 'absolute', right: 0 }} className="topbar-button" onClick={handleSignOut}>
        <LogOut className="h-5 w-5" />
      </button>
    </div>
  )
}
  
  
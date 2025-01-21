import { TopBar } from '../components/TopBar'
import SideBar from '../components/SideBar'
import Workspace from '../components/Workspace'
import { useState } from 'react'

export default function Dashboard() {
  const [activeComponent, setActiveComponent] = useState('dashboard')

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TopBar />
      <div className="flex-1 flex overflow-hidden">
        <SideBar setActiveComponent={setActiveComponent} />
        <Workspace activeComponent={activeComponent} />
      </div>
    </div>
  )
} 
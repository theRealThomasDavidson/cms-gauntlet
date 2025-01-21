import React from 'react'
import AuthComponent from '../components/Auth/Auth'

export default function Home() {
  return (
    <div className="flex-1 w-full bg-gray-50 flex items-center justify-center">
      <div className="w-[320px] flex items-center justify-center">
        <div className="w-full bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
          <AuthComponent />
        </div>
      </div>
    </div>
  )
} 
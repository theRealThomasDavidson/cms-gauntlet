import { createBrowserRouter } from 'react-router-dom'
import Home from '../pages/Home'
import Dashboard from '../pages/Dashboard'
import ProtectedRoute from '../components/Auth/ProtectedRoute'

export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <Dashboard />
      </ProtectedRoute>
    ),
  },
  {
    path: '/login',
    element: <Home />,
  },
  // Add more routes as we create them
  // {
  //   path: '/dashboard',
  //   element: <Dashboard />,
  // },
  // {
  //   path: '/settings',
  //   element: <Settings />,
  // },
]) 
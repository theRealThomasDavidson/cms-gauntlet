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
    children: [
      {
        path: 'workflows/:id/kanban',
        element: <Dashboard />
      }
    ]
  },
  {
    path: '/login',
    element: <Home />,
  },
]) 
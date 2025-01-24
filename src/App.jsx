import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import { NotificationProvider } from './context/NotificationContext'
import { BrowserRouter } from 'react-router-dom'

const router = createBrowserRouter([
  {
    path: '/',
    element: <Login />,
  },
  {
    path: '/dashboard',
    element: <Dashboard />,
  },
  {
    path: '/tickets/:ticketId',
    element: <Dashboard />
  },
])

function App() {
  return (
    <BrowserRouter>
      <NotificationProvider>
        <RouterProvider router={router} />
      </NotificationProvider>
    </BrowserRouter>
  )
}

export default App
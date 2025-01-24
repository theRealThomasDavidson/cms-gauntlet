import { NotificationProvider } from '../context/NotificationContext';

function DashboardLayout() {
  return (
    <NotificationProvider>
      <div className="dashboard-layout">
        <Sidebar />
        <main>
          <Outlet />
        </main>
      </div>
    </NotificationProvider>
  );
}

export default DashboardLayout; 
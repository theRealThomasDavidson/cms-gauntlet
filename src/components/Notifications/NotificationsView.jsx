import { useNotifications } from '../../context/NotificationContext';
import NotificationItem from './NotificationItem';

export default function NotificationsView() {
  const { notifications } = useNotifications();

  if (!notifications?.length) {
    return <div className="p-4">No notifications found</div>;
  }

  return (
    <div className="divide-y divide-gray-200">
      {notifications.map(notification => (
        <NotificationItem 
          key={notification.id} 
          notification={notification} 
        />
      ))}
    </div>
  );
} 
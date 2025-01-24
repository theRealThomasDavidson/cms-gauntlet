import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import NotificationItem from './NotificationItem';

const NotificationCenter = ({ onViewTicket }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    try {
      console.log('Fetching notifications...');
      const { data, error } = await supabase
        .rpc('get_user_notifications', {
          p_limit: 50,
          p_status: null,
          p_include_read: true
        });

      if (error) throw error;

      console.log('Fetched notifications:', data);
      setNotifications(data || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkAsRead = async (notificationId) => {
    try {
      console.log('Marking notification as read:', notificationId);
      const { data, error } = await supabase
        .rpc('mark_notification_read', {
          p_notification_id: notificationId
        });

      if (error) throw error;

      console.log('Marked as read response:', data);
      // Refresh notifications list
      await fetchNotifications();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Notifications</h2>
      <div className="bg-white rounded-lg shadow">
        {loading ? (
          <div className="text-center text-gray-500 py-8">
            Loading notifications...
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            No notifications yet
          </div>
        ) : (
          notifications.map(notification => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onMarkAsRead={handleMarkAsRead}
              onViewTicket={onViewTicket}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default NotificationCenter; 
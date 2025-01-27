import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import NotificationItem from './NotificationItem';
import { useNotifications } from '../../context/NotificationContext';

const NotificationCenter = ({ onViewTicket }) => {
  const { notifications, refreshNotifications } = useNotifications();

  const handleMarkAsRead = async (notificationId) => {
    try {
      const { error } = await supabase
        .rpc('mark_notification_read', {
          p_notification_id: notificationId
        });

      if (error) throw error;
      
      // Use the context's refresh method instead of local fetch
      await refreshNotifications();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Notifications</h2>
      <div className="bg-white rounded-lg shadow">
        {notifications.length === 0 ? (
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
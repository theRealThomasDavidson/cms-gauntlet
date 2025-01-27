import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import PropTypes from 'prop-types';

const NotificationsContext = createContext();

export function NotificationsProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Subscribe to notifications
    const channel = supabase
      .channel('notification_logs')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notification_logs'
      }, (payload) => {
        console.log('Notification change received:', payload);
        refreshNotifications();
      })
      .subscribe();

    // Initial fetch
    refreshNotifications();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const refreshNotifications = async () => {
    try {
      const { data: notifs, error } = await supabase
        .from('notification_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setNotifications(notifs);
      setUnreadCount(notifs.filter(n => !n.read_at).length);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      const { error } = await supabase
        .from('notification_logs')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notificationId);

      if (error) throw error;
      await refreshNotifications();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  return (
    <NotificationsContext.Provider value={{ 
      notifications, 
      unreadCount, 
      refreshNotifications,
      markAsRead 
    }}>
      {children}
    </NotificationsContext.Provider>
  );
}

NotificationsProvider.propTypes = {
  children: PropTypes.node.isRequired
};

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return context;
} 
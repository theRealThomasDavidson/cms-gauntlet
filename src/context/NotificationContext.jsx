import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

const NotificationContext = createContext();

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    try {
      const { data, error } = await supabase
        .rpc('get_user_notifications', {
          p_limit: 50,
          p_status: null,
          p_include_read: true
        });

      if (error) throw error;

      console.log('Notifications from context:', data);  // Simple log of all notifications
      
      setNotifications(data || []);
      const unreadCount = data?.filter(n => n.status === 'pending').length || 0;
      setUnreadCount(unreadCount);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();

    const subscription = supabase
      .channel('notification_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notification_logs'
        },
        (payload) => {
          console.log('Notification change detected');
          fetchNotifications();
        }
      )
      .subscribe();

    return () => subscription.unsubscribe();
  }, []);

  return (
    <NotificationContext.Provider value={{ 
      notifications, 
      unreadCount,
      loading,
      refreshNotifications: fetchNotifications 
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

// Custom hook to use notifications
export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
} 
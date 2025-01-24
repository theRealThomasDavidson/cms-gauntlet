import React from 'react';
import PropTypes from 'prop-types';

export default function NotificationItem({ notification, onMarkAsRead }) {
  const {
    id,
    subject,
    body,
    created_at,
    status,
    notification_type,
    metadata
  } = notification;

  const getStatusStyles = (status) => {
    switch(status) {
      case 'pending':
        return 'bg-blue-100 text-blue-800 hover:bg-blue-200 cursor-pointer';
      case 'sent':
        return 'bg-green-100 text-green-800 cursor-default';
      case 'failed':
        return 'bg-red-100 text-red-800 cursor-default';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800 cursor-default';
      default:
        return 'bg-gray-100 text-gray-800 cursor-default';
    }
  };

  const displayStatus = (status) => {
    return status === 'sent' ? 'read' : status;
  };

  return (
    <div className="notification-item p-4 border-b border-gray-200">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-medium">{subject}</h3>
          <p className="text-gray-600">{body}</p>
          <div className="text-sm text-gray-500 mt-2">
            {new Date(created_at).toLocaleString()}
          </div>
        </div>
        <div className="flex items-center">
          <button
            onClick={() => status === 'pending' && onMarkAsRead(id)}
            className={`px-2 py-1 rounded text-sm transition-colors ${getStatusStyles(status)}`}
          >
            {displayStatus(status)}
          </button>
        </div>
      </div>
      {metadata && metadata.stage_id && (
        <div className="text-sm text-gray-500 mt-2">
          Stage change notification
        </div>
      )}
    </div>
  );
}

NotificationItem.propTypes = {
  notification: PropTypes.shape({
    id: PropTypes.string.isRequired,
    subject: PropTypes.string.isRequired,
    body: PropTypes.string.isRequired,
    created_at: PropTypes.string.isRequired,
    status: PropTypes.oneOf(['pending', 'sent', 'failed', 'cancelled']).isRequired,
    notification_type: PropTypes.string.isRequired,
    metadata: PropTypes.object
  }).isRequired,
  onMarkAsRead: PropTypes.func.isRequired
}; 
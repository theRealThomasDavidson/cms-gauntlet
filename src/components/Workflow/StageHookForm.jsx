import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { supabase } from '../../lib/supabaseClient';

const NOTIFICATION_TARGETS = {
  SPECIFIC_USER: 'specific_user',
  ROLE: 'role',
  TICKET_CREATOR: 'ticket_creator',
  ORG_ADMINS: 'org_admins'
};

export default function StageHookForm({ stageId, hook = null, onSave, onCancel, profile }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [users, setUsers] = useState([]);
  const [hookData, setHookData] = useState({
    type: 'notification',
    config: {
      target_type: NOTIFICATION_TARGETS.SPECIFIC_USER,
      target_user_id: '',
      target_role: 'customer',
      message: ''
    },
    is_active: true
  });

  useEffect(() => {
    if (hook) {
      setHookData({
        type: hook.type,
        config: hook.config,
        is_active: hook.is_active
      });
    }
    fetchUsers();
  }, [hook]);

  async function fetchUsers() {
    try {
      const { data, error } = await supabase
        .rpc('get_org_profiles', { p_org_id: profile.org_id });

      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('Error loading users');
    }
  }

  function handleConfigChange(key, value) {
    setHookData(prev => ({
      ...prev,
      config: {
        ...prev.config,
        [key]: value
      }
    }));
  }

  const handleSaveHook = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Create the hook directly without template
      const { data: hook, error: hookError } = await supabase
        .rpc('create_workflow_stage_hook', {
          p_stage_id: stageId,
          p_hook_type: 'notification',
          p_config: {
            target_type: hookData.config.target_type,
            target_user_id: hookData.config.target_type === 'specific_user' ? hookData.config.target_user_id : null,
            target_role: hookData.config.target_type === 'role' ? hookData.config.target_role : null,
            message: hookData.config.message
          },
          p_is_active: true
        });

      if (hookError) {
        console.error('Hook Error:', hookError);
        throw hookError;
      }

      console.log('Created hook:', hook);
      onSave();
    } catch (err) {
      console.error('Error saving hook:', err);
      setError('Failed to save notification: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Notification Target
        </label>
        <select
          value={hookData.config.target_type}
          onChange={(e) => handleConfigChange('target_type', e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        >
          <option value={NOTIFICATION_TARGETS.SPECIFIC_USER}>Specific User</option>
          <option value={NOTIFICATION_TARGETS.ROLE}>Users with Role</option>
          <option value={NOTIFICATION_TARGETS.TICKET_CREATOR}>Ticket Creator</option>
          <option value={NOTIFICATION_TARGETS.ORG_ADMINS}>Organization Admins</option>
        </select>
      </div>

      {hookData.config.target_type === NOTIFICATION_TARGETS.SPECIFIC_USER && (
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Select User
          </label>
          <select
            value={hookData.config.target_user_id}
            onChange={(e) => handleConfigChange('target_user_id', e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="">Select a user...</option>
            {users.map(user => (
              <option key={user.id} value={user.id}>
                {user.name || user.email}
              </option>
            ))}
          </select>
        </div>
      )}

      {hookData.config.target_type === NOTIFICATION_TARGETS.ROLE && (
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Select Role
          </label>
          <select
            value={hookData.config.target_role}
            onChange={(e) => handleConfigChange('target_role', e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="customer">Customer</option>
            <option value="agent">Agent</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Notification Message
        </label>
        <textarea
          value={hookData.config.message}
          onChange={(e) => handleConfigChange('message', e.target.value)}
          rows={3}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          placeholder="Enter the notification message..."
          required
        />
        <p className="mt-1 text-sm text-gray-500">
          You can use placeholders: {'{ticket_id}'}, {'{ticket_title}'}, {'{stage_name}'}
        </p>
      </div>

      <div className="flex items-center">
        <input
          type="checkbox"
          checked={hookData.is_active}
          onChange={(e) => setHookData(prev => ({ ...prev, is_active: e.target.checked }))}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <label className="ml-2 block text-sm text-gray-900">
          Active
        </label>
      </div>

      {error && (
        <div className="text-red-500 text-sm">{error}</div>
      )}

      <div className="flex gap-4">
        <button
          type="button"
          disabled={loading}
          onClick={handleSaveHook}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Save Hook'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

StageHookForm.propTypes = {
  stageId: PropTypes.string.isRequired,
  hook: PropTypes.object,
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  profile: PropTypes.object.isRequired
}; 
import { supabase } from '../supabaseClient'

/**
 * Get user profile
 * @param {string} userId User ID
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const getProfile = async (userId) => {
  return await supabase
    .from('profiles')
    .select(`
      *,
      organizations:organization_members (
        role,
        permissions,
        organization:org_id (
          id,
          name,
          slug
        )
      )
    `)
    .eq('id', userId)
    .single()
}

/**
 * Update user profile
 * @param {string} userId User ID
 * @param {Object} updates Updates to apply
 * @param {string} [updates.name] Full name
 * @param {string} [updates.avatarUrl] Avatar URL
 * @param {string} [updates.title] Job title
 * @param {Object} [updates.preferences] User preferences
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const updateProfile = async (userId, updates) => {
  return await supabase
    .from('profiles')
    .update({
      name: updates.name,
      avatar_url: updates.avatarUrl,
      title: updates.title,
      preferences: updates.preferences
    })
    .eq('id', userId)
    .select()
    .single()
}

/**
 * Update user preferences
 * @param {string} userId User ID
 * @param {Object} preferences New preferences object
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const updatePreferences = async (userId, preferences) => {
  return await supabase
    .from('profiles')
    .update({
      preferences
    })
    .eq('id', userId)
    .select()
    .single()
}

/**
 * Get user notifications
 * @param {string} userId User ID
 * @param {boolean} [unreadOnly=false] Only get unread notifications
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const getNotifications = async (userId, unreadOnly = false) => {
  let query = supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)

  if (unreadOnly) {
    query = query.eq('read', false)
  }

  return await query.order('created_at', { ascending: false })
}

/**
 * Mark notifications as read
 * @param {string} userId User ID
 * @param {string[]} notificationIds Notification IDs to mark as read
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const markNotificationsRead = async (userId, notificationIds) => {
  return await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .in('id', notificationIds)
}

/**
 * Update notification preferences
 * @param {string} userId User ID
 * @param {Object} preferences Notification preferences
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const updateNotificationPreferences = async (userId, preferences) => {
  return await supabase
    .from('notification_preferences')
    .upsert([{
      user_id: userId,
      ...preferences
    }])
    .select()
    .single()
}

/**
 * Get user activity log
 * @param {string} userId User ID
 * @param {Object} [filters] Optional filters
 * @param {string} [filters.type] Activity type
 * @param {string} [filters.orgId] Organization ID
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const getUserActivity = async (userId, filters = {}) => {
  let query = supabase
    .from('user_activity')
    .select('*')
    .eq('user_id', userId)

  if (filters.type) {
    query = query.eq('activity_type', filters.type)
  }
  if (filters.orgId) {
    query = query.eq('org_id', filters.orgId)
  }

  return await query.order('created_at', { ascending: false })
}

/**
 * Get user's assigned tickets
 * @param {string} userId User ID
 * @param {Object} [filters] Optional filters
 * @param {string} [filters.status] Ticket status
 * @param {string} [filters.priority] Ticket priority
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const getAssignedTickets = async (userId, filters = {}) => {
  let query = supabase
    .from('tickets')
    .select(`
      *,
      organization:org_id (name),
      workflow:workflow_id (name),
      current_stage:current_stage_id (name)
    `)
    .eq('assigned_to', userId)

  if (filters.status) {
    query = query.eq('status', filters.status)
  }
  if (filters.priority) {
    query = query.eq('priority', filters.priority)
  }

  return await query.order('updated_at', { ascending: false })
}

/**
 * Change a user's role (admin only)
 * @param {string} userEmail The user's email
 * @param {string} newRole The new role ('customer', 'agent', 'admin')
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const changeRole = async (userEmail, newRole) => {
  return await supabase
    .rpc('change_role', {
      user_email: userEmail,
      new_role: newRole
    })
}

/**
 * Delete a user's profile and auth account
 * @param {string} email The user's email
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const deleteUser = async (email) => {
  return await supabase
    .rpc('delete_user', {
      target_email: email
    })
}

/**
 * Check if the current user is an admin
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const isAdmin = async () => {
  return await supabase
    .rpc('is_admin')
} 
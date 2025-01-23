import { supabase } from '../supabaseClient'

/**
 * Create a new ticket
 * @param {Object} ticket The ticket data
 * @param {string} ticket.orgId Organization ID
 * @param {string} ticket.title Ticket title
 * @param {string} ticket.description Ticket description
 * @param {string} ticket.priority Ticket priority ('low', 'medium', 'high', 'urgent')
 * @param {string} [ticket.workflowId] Optional workflow ID
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const createTicket = async (ticket) => {
  return await supabase
    .from('tickets')
    .insert([{
      org_id: ticket.orgId,
      title: ticket.title,
      description: ticket.description,
      priority: ticket.priority,
      workflow_id: ticket.workflowId,
      status: 'open'
    }])
    .select()
    .single()
}

/**
 * Update a ticket
 * @param {string} ticketId The ticket ID
 * @param {Object} updates The updates to apply
 * @param {string} [updates.title] New title
 * @param {string} [updates.description] New description
 * @param {string} [updates.priority] New priority
 * @param {string} [updates.assignedTo] New assignee ID
 * @param {string} [updates.stageId] New workflow stage ID
 * @param {Object} [updates.customFields] Custom fields
 * @param {string[]} [updates.tags] Tags
 * @param {string} [updates.changeReason] Reason for the change
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const updateTicket = async (ticketId, updates) => {
  return await supabase.rpc('update_ticket_data', {
    p_ticket_id: ticketId,
    p_title: updates.title,
    p_description: updates.description,
    p_priority: updates.priority,
    p_assigned_to: updates.assignedTo,
    p_custom_fields: updates.customFields,
    p_tags: updates.tags,
    p_change_reason: updates.changeReason
  })
}

/**
 * Add a comment to a ticket
 * @param {Object} comment The comment data
 * @param {string} comment.ticketId The ticket ID
 * @param {string} comment.content The comment content
 * @param {boolean} [comment.isInternal=false] Whether this is an internal comment
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const addComment = async ({ ticketId, content, isInternal = false }) => {
  return await supabase
    .from('ticket_comments')
    .insert([{
      ticket_id: ticketId,
      content,
      is_internal: isInternal
    }])
}

/**
 * Add an attachment to a ticket
 * @param {Object} attachment The attachment data
 * @param {string} attachment.ticketId The ticket ID
 * @param {string} attachment.fileName The file name
 * @param {string} attachment.fileType The file MIME type
 * @param {number} attachment.fileSize The file size in bytes
 * @param {string} attachment.storagePath The storage path
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const addAttachment = async (attachment) => {
  return await supabase
    .from('ticket_attachments')
    .insert([{
      ticket_id: attachment.ticketId,
      file_name: attachment.fileName,
      file_type: attachment.fileType,
      file_size: attachment.fileSize,
      storage_path: attachment.storagePath
    }])
}

/**
 * Get ticket details
 * @param {string} ticketId The ticket ID
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const getTicketDetails = async (ticketId) => {
  return await supabase
    .from('ticket_details')
    .select('*')
    .eq('ticket_id', ticketId)
    .single()
}

/**
 * Get ticket history
 * @param {string} ticketId The ticket ID
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const getTicketHistory = async (ticketId) => {
  return await supabase
    .from('ticket_history')
    .select(`
      id,
      title,
      description,
      priority,
      assigned_to,
      workflow_stage_id,
      changed_by,
      changed_at,
      changes,
      profiles:assigned_to (name),
      changed_by_profile:changed_by (name)
    `)
    .eq('ticket_id', ticketId)
    .order('changed_at', { ascending: false })
}

/**
 * Get ticket comments
 * @param {string} ticketId The ticket ID
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const getTicketComments = async (ticketId) => {
  return await supabase
    .from('ticket_comments')
    .select(`
      *,
      profiles:created_by (name)
    `)
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true })
}

/**
 * Get ticket attachments
 * @param {string} ticketId The ticket ID
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const getTicketAttachments = async (ticketId) => {
  return await supabase
    .from('ticket_attachments')
    .select(`
      *,
      profiles:uploaded_by (name)
    `)
    .eq('ticket_id', ticketId)
    .order('uploaded_at', { ascending: false })
}

/**
 * Get agent tickets view with optional filters
 * @param {Object} [filters] Optional filters
 * @param {string} [filters.orgId] Filter by organization ID
 * @param {string} [filters.priority] Filter by priority
 * @param {string} [filters.assignedTo] Filter by assignee ID
 * @param {string} [filters.stageId] Filter by workflow stage ID
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const getAgentTickets = async (filters = {}) => {
  let query = supabase
    .from('agent_tickets')
    .select('*')

  if (filters.orgId) {
    query = query.eq('org_id', filters.orgId)
  }
  if (filters.priority) {
    query = query.eq('priority', filters.priority)
  }
  if (filters.assignedTo) {
    query = query.eq('assigned_to', filters.assignedTo)
  }
  if (filters.stageId) {
    query = query.eq('current_stage_id', filters.stageId)
  }

  return await query.order('updated_at', { ascending: false })
}

/**
 * Get customer tickets view
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const getCustomerTickets = async () => {
  return await supabase
    .from('customer_tickets')
    .select('*')
    .order('updated_at', { ascending: false })
}

/**
 * Get workflow stage statistics
 * @param {string} orgId The organization ID
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const getWorkflowStageStats = async (orgId) => {
  return await supabase
    .from('workflow_stage_stats')
    .select('*')
    .eq('org_id', orgId)
}

/**
 * Refresh ticket statistics
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const refreshTicketStats = async () => {
  return await supabase
    .rpc('refresh_ticket_stats')
}

/**
 * Delete a ticket
 * @param {string} ticketId The ticket ID
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const deleteTicket = async (ticketId) => {
  return await supabase
    .from('tickets')
    .delete()
    .eq('id', ticketId)
}

/**
 * Update a ticket comment
 * @param {string} commentId The comment ID
 * @param {Object} updates The updates to apply
 * @param {string} updates.content New content
 * @param {boolean} [updates.isInternal] New internal status
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const updateComment = async (commentId, updates) => {
  return await supabase
    .from('ticket_comments')
    .update({
      content: updates.content,
      is_internal: updates.isInternal,
      edited_at: new Date().toISOString()
    })
    .eq('id', commentId)
    .select()
    .single()
}

/**
 * Delete a ticket comment
 * @param {string} commentId The comment ID
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const deleteComment = async (commentId) => {
  return await supabase
    .from('ticket_comments')
    .delete()
    .eq('id', commentId)
}

/**
 * Update an attachment's metadata
 * @param {string} attachmentId The attachment ID
 * @param {Object} updates The updates to apply
 * @param {string} [updates.fileName] New file name
 * @param {Object} [updates.metadata] New metadata
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const updateAttachment = async (attachmentId, updates) => {
  return await supabase
    .from('ticket_attachments')
    .update({
      file_name: updates.fileName,
      metadata: updates.metadata
    })
    .eq('id', attachmentId)
    .select()
    .single()
}

/**
 * Delete a ticket attachment
 * @param {string} attachmentId The attachment ID
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const deleteAttachment = async (attachmentId) => {
  return await supabase
    .from('ticket_attachments')
    .delete()
    .eq('id', attachmentId)
}
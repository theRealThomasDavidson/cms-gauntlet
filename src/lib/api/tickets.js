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
    .rpc('create_ticket', {
      p_org_id: ticket.orgId,
      p_title: ticket.title,
      p_description: ticket.description,
      p_priority: ticket.priority,
      p_workflow_id: ticket.workflowId
    })
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
    .rpc('create_comment', {
      p_ticket_id: ticketId,
      p_content: content,
      p_is_internal: isInternal
    })
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
    .rpc('create_attachment', {
      p_ticket_id: attachment.ticketId,
      p_file_name: attachment.fileName,
      p_file_type: attachment.fileType,
      p_file_size: attachment.fileSize,
      p_storage_path: attachment.storagePath
    })
}

/**
 * Get ticket details
 * @param {string} ticketId The ticket ID
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const getTicketDetails = async (ticketId) => {
  return await supabase
    .rpc('get_ticket_details', {
      p_ticket_id: ticketId
    })
    .single()
}

/**
 * Get ticket history
 * @param {string} ticketId The ticket ID
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const getTicketHistory = async (ticketId) => {
  return await supabase
    .rpc('get_ticket_history', {
      p_ticket_id: ticketId
    })
}

/**
 * Get ticket comments
 * @param {string} ticketId The ticket ID
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const getTicketComments = async (ticketId) => {
  return await supabase
    .rpc('get_ticket_comments', {
      p_ticket_id: ticketId
    })
}

/**
 * Get ticket attachments
 * @param {string} ticketId The ticket ID
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const getTicketAttachments = async (ticketId) => {
  return await supabase
    .rpc('get_ticket_attachments', {
      p_ticket_id: ticketId
    })
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
  return await supabase
    .rpc('get_agent_tickets', {
      p_org_id: filters.orgId,
      p_priority: filters.priority,
      p_assigned_to: filters.assignedTo,
      p_stage_id: filters.stageId
    })
}

/**
 * Get customer tickets view
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const getCustomerTickets = async () => {
  return await supabase
    .rpc('get_customer_tickets')
}

/**
 * Get workflow stage statistics
 * @param {string} orgId The organization ID
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const getWorkflowStageStats = async (orgId) => {
  return await supabase
    .rpc('get_workflow_stage_stats', {
      p_org_id: orgId
    })
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
    .rpc('delete_ticket', {
      p_ticket_id: ticketId
    })
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
    .rpc('update_comment', {
      p_comment_id: commentId,
      p_content: updates.content,
      p_is_internal: updates.isInternal
    })
}

/**
 * Delete a ticket comment
 * @param {string} commentId The comment ID
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const deleteComment = async (commentId) => {
  return await supabase
    .rpc('delete_comment', {
      p_comment_id: commentId
    })
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
    .rpc('update_attachment', {
      p_attachment_id: attachmentId,
      p_file_name: updates.fileName,
      p_metadata: updates.metadata
    })
    .single()
}

/**
 * Delete a ticket attachment
 * @param {string} attachmentId The attachment ID
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const deleteAttachment = async (attachmentId) => {
  return await supabase
    .rpc('delete_attachment', {
      p_attachment_id: attachmentId
    })
}

/**
 * Get ticket by ID
 * @param {string} ticketId The ticket ID
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const getTicketById = async (ticketId) => {
  return await supabase
    .rpc('get_ticket_by_id', {
      p_ticket_id: ticketId
    })
    .single();
}
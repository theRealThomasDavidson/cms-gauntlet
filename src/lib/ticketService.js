import { supabase } from './supabaseClient'

// Fetch tickets with pagination and filters
export async function fetchTickets({ 
  page = 1, 
  pageSize = 20, 
  priority, 
  stageId,
  workflowId,
  assignedTo,
  searchQuery,
  sortBy = 'updated_at',
  sortDirection = 'desc'
} = {}) {
  const { data: profile } = await supabase.auth.getUser()
  if (!profile?.user) return { data: null, error: 'Not authenticated' }

  // Get user profile to determine role
  const { data: userProfile } = await supabase
    .rpc('get_profile_by_auth_id', {
      p_auth_id: profile.user.id
    })
    .single()

  let data, error, count

  if (userProfile?.role === 'admin' || userProfile?.role === 'agent') {
    // Use get_agent_tickets RPC
    const result = await supabase
      .rpc('get_agent_tickets', {
        p_org_id: userProfile.org_id,
        p_priority: priority,
        p_assigned_to: assignedTo,
        p_stage_id: stageId
      })

    data = result.data
    error = result.error
    count = data?.length || 0
  } else {
    // Use get_customer_tickets RPC
    const result = await supabase
      .rpc('get_customer_tickets')

    data = result.data
    error = result.error
    count = data?.length || 0
  }

  // Apply search filter client-side if needed
  if (searchQuery && data) {
    data = data.filter(ticket => 
      ticket.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.description?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    count = data.length
  }

  // Apply sorting client-side
  if (data) {
    data.sort((a, b) => {
      const aVal = a[sortBy]
      const bVal = b[sortBy]
      const modifier = sortDirection === 'asc' ? 1 : -1
      if (aVal < bVal) return -1 * modifier
      if (aVal > bVal) return 1 * modifier
      return 0
    })
  }

  // Apply pagination client-side
  const start = (page - 1) * pageSize
  const end = start + pageSize
  const paginatedData = data?.slice(start, end)

  return { 
    data: paginatedData, 
    error,
    pagination: {
      page,
      pageSize,
      total: count,
      totalPages: Math.ceil(count / pageSize)
    }
  }
}

// Direct fetch tickets using RPC
export async function fetchTicketsDirect({ 
  page = 1, 
  pageSize = 20
} = {}) {
  const { data: profile } = await supabase.auth.getUser()
  if (!profile?.user) return { data: null, error: 'Not authenticated' }

  // Get user profile
  const { data: userProfile } = await supabase
    .rpc('get_profile_by_auth_id', {
      p_auth_id: profile.user.id
    })
    .single()

  // Use get_agent_tickets or get_customer_tickets based on role
  let result
  if (userProfile?.role === 'admin' || userProfile?.role === 'agent') {
    result = await supabase
      .rpc('get_agent_tickets', {
        p_org_id: userProfile.org_id
      })
  } else {
    result = await supabase
      .rpc('get_customer_tickets')
  }

  const { data, error } = result
  const count = data?.length || 0

  // Apply pagination client-side
  const start = (page - 1) * pageSize
  const end = start + pageSize
  const paginatedData = data?.slice(start, end)

  return { 
    data: paginatedData, 
    error,
    pagination: {
      page,
      pageSize,
      total: count,
      totalPages: Math.ceil(count / pageSize)
    }
  }
}

// Fetch a single ticket with its full history and comments
export async function fetchTicketDetails(ticketId) {
  const [ticketResult, historyResult, commentsResult, attachmentsResult] = await Promise.all([
    supabase
      .rpc('get_ticket_by_id', {
        p_ticket_id: ticketId
      })
      .single(),

    supabase
      .rpc('get_ticket_history', {
        p_ticket_id: ticketId
      }),

    supabase
      .rpc('get_ticket_comments', {
        p_ticket_id: ticketId
      }),

    supabase
      .rpc('get_ticket_attachments', {
        p_ticket_id: ticketId
      })
  ])

  return {
    ticket: ticketResult.data,
    history: historyResult.data,
    comments: commentsResult.data,
    attachments: attachmentsResult.data,
    error: ticketResult.error || historyResult.error || commentsResult.error || attachmentsResult.error
  }
}

// Create a new ticket
export async function createTicket({ title, description, priority, workflowId }) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: ticket, error: ticketError } = await supabase
    .rpc('create_ticket', {
      p_title: title,
      p_description: description,
      p_priority: priority,
      p_workflow_id: workflowId
    })
    .single()

  if (ticketError) return { error: ticketError }

  return { data: ticket }
}

// Update a ticket
export async function updateTicket(ticketId, changes) {
  const { data: profile } = await supabase.auth.getUser()
  if (!profile) return { error: 'Not authenticated' }

  return await supabase
    .rpc('update_ticket_data', {
      p_ticket_id: ticketId,
      p_title: changes.title,
      p_description: changes.description,
      p_status: changes.status || 'open',
      p_priority: changes.priority,
      p_assigned_to: changes.assigned_to,
      p_change_reason: changes.change_reason || 'Updated ticket'
    })
}

// Add a comment to a ticket
export async function addComment(ticketId, content, isInternal = false) {
  const { data: profile } = await supabase.auth.getUser()
  if (!profile) return { error: 'Not authenticated' }

  return await supabase
    .rpc('create_comment', {
      p_ticket_id: ticketId,
      p_content: content,
      p_is_internal: isInternal
    })
}

// Upload an attachment
export async function uploadAttachment(ticketId, file) {
  const { data: profile } = await supabase.auth.getUser()
  if (!profile) return { error: 'Not authenticated' }

  // Upload file to storage
  const fileExt = file.name.split('.').pop()
  const filePath = `${ticketId}/${Date.now()}.${fileExt}`
  
  const { error: uploadError } = await supabase.storage
    .from('attachments')
    .upload(filePath, file)

  if (uploadError) return { error: uploadError }

  // Create attachment record
  const { data: attachment, error: attachmentError } = await supabase
    .from('ticket_attachments')
    .insert({
      ticket_id: ticketId,
      file_name: file.name,
      file_type: file.type,
      file_size: file.size,
      storage_path: filePath,
      uploaded_by: profile.id
    })
    .select('*')
    .single()

  if (attachmentError) return { error: attachmentError }

  // Get uploader profile
  const { data: uploaderProfile } = await supabase
    .rpc('get_profile_by_id', {
      p_profile_id: profile.id
    })

  return {
    data: {
      ...attachment,
      uploaded_by_user: uploaderProfile
    }
  }
}

// Helper function to get first stage of a workflow
async function getFirstStage(workflowId) {
  const { data } = await supabase
    .rpc('get_workflow_stages', {
      workflow_uuid: workflowId
    })
  
  // Find the start stage from the returned stages
  const startStage = data?.find(stage => stage.is_start)
  return startStage?.id
}

// Subscribe to ticket updates
export function subscribeToTicket(ticketId, callback) {
  return supabase.channel(`ticket-${ticketId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'tickets',
        filter: `id=eq.${ticketId}`
      },
      callback
    )
    .subscribe()
}

// Delete an attachment
export async function deleteAttachment(attachmentId) {
  const { data: profile } = await supabase.auth.getUser()
  if (!profile) return { error: 'Not authenticated' }

  // Get attachment details first
  const { data: attachment, error: fetchError } = await supabase
    .from('ticket_attachments')
    .select('storage_path')
    .eq('id', attachmentId)
    .single()

  if (fetchError) return { error: fetchError }

  // Delete from storage first
  const { error: storageError } = await supabase.storage
    .from('attachments')
    .remove([attachment.storage_path])

  if (storageError) return { error: storageError }

  // Delete the record
  return await supabase
    .from('ticket_attachments')
    .delete()
    .eq('id', attachmentId)
}

// Get active workflows using RPC
export async function getActiveWorkflows() {
  try {
    const { data, error } = await supabase
      .rpc('get_active_workflows');

    if (error) {
      console.error('Error fetching workflows:', error);
      return { data: [], error };
    }

    return { data, error: null };
  } catch (err) {
    console.error('Exception fetching workflows:', err);
    return { data: [], error: err };
  }
} 
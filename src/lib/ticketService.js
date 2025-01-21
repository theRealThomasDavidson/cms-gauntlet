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
  if (!profile) return { data: null, error: 'Not authenticated' }

  // Use the appropriate view based on user role
  const { data: userProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('auth_id', profile.id)
    .single()

  let query = null

  if (userProfile?.role === 'admin' || userProfile?.role === 'agent') {
    query = supabase
      .from('agent_tickets')
      .select('*', { count: 'exact' })
  } else {
    query = supabase
      .from('customer_tickets')
      .select('*', { count: 'exact' })
  }

  // Apply filters
  if (priority) {
    query = query.eq('priority', priority)
  }
  if (stageId) {
    query = query.eq('current_stage_id', stageId)
  }
  if (workflowId) {
    query = query.eq('workflow_id', workflowId)
  }
  if (assignedTo) {
    query = query.eq('assigned_to', assignedTo)
  }
  if (searchQuery) {
    query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
  }

  // Apply sorting
  query = query.order(sortBy, { ascending: sortDirection === 'asc' })

  // Apply pagination
  const start = (page - 1) * pageSize
  const end = start + pageSize - 1
  query = query.range(start, end)

  const { data, error, count } = await query

  return { 
    data, 
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
    // Get latest ticket state
    supabase
      .from('tickets')
      .select(`
        *,
        current_stage:workflow_stages!tickets_current_stage_id_fkey(name),
        workflow:workflows(name),
        latest_history:ticket_history!tickets_latest_history_id_fkey(
          title,
          description,
          priority,
          assigned_to,
          assigned_user:profiles!ticket_history_assigned_to_fkey(name)
        )
      `)
      .eq('id', ticketId)
      .single(),

    // Get full history chain
    supabase
      .from('ticket_history')
      .select(`
        *,
        changed_by_user:profiles!ticket_history_changed_by_fkey(name),
        stage:workflow_stages!ticket_history_workflow_stage_id_fkey(name)
      `)
      .eq('ticket_id', ticketId)
      .order('changed_at', { ascending: false }),

    // Get comments
    supabase
      .from('ticket_comments')
      .select(`
        *,
        author:profiles!ticket_comments_created_by_fkey(name)
      `)
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true }),

    // Get attachments
    supabase
      .from('ticket_attachments')
      .select(`
        *,
        uploaded_by_user:profiles!ticket_attachments_uploaded_by_fkey(name)
      `)
      .eq('ticket_id', ticketId)
      .order('uploaded_at', { ascending: true })
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
  const { data: profile } = await supabase.auth.getUser()
  if (!profile) return { error: 'Not authenticated' }

  // Start a transaction
  const { data: ticket, error: ticketError } = await supabase
    .from('tickets')
    .insert({
      workflow_id: workflowId,
      created_by: profile.id,
      // Get the first stage of the workflow
      current_stage_id: await getFirstStage(workflowId)
    })
    .select()
    .single()

  if (ticketError) return { error: ticketError }

  // Create initial history entry
  const { data: history, error: historyError } = await supabase
    .from('ticket_history')
    .insert({
      ticket_id: ticket.id,
      title,
      description,
      priority,
      workflow_stage_id: ticket.current_stage_id,
      changed_by: profile.id,
      changes: {
        type: 'created',
        fields: { title, description, priority }
      }
    })
    .select()
    .single()

  if (historyError) return { error: historyError }

  // Update ticket with latest history
  const { error: updateError } = await supabase
    .from('tickets')
    .update({ latest_history_id: history.id })
    .eq('id', ticket.id)

  return { data: ticket, error: updateError }
}

// Update a ticket
export async function updateTicket(ticketId, changes) {
  const { data: profile } = await supabase.auth.getUser()
  if (!profile) return { error: 'Not authenticated' }

  const { data: currentTicket, error: fetchError } = await supabase
    .from('tickets')
    .select(`
      *,
      latest_history:ticket_history!tickets_latest_history_id_fkey(*)
    `)
    .eq('id', ticketId)
    .single()

  if (fetchError) return { error: fetchError }

  // Create new history entry with changes
  const { data: history, error: historyError } = await supabase
    .from('ticket_history')
    .insert({
      ticket_id: ticketId,
      title: changes.title || currentTicket.latest_history.title,
      description: changes.description || currentTicket.latest_history.description,
      priority: changes.priority || currentTicket.latest_history.priority,
      assigned_to: changes.assigned_to || currentTicket.latest_history.assigned_to,
      workflow_stage_id: changes.stage_id || currentTicket.current_stage_id,
      changed_by: profile.id,
      previous_history_id: currentTicket.latest_history_id,
      changes: {
        type: 'updated',
        fields: changes
      }
    })
    .select()
    .single()

  if (historyError) return { error: historyError }

  // Update ticket with new stage and history
  const { error: updateError } = await supabase
    .from('tickets')
    .update({ 
      current_stage_id: changes.stage_id || currentTicket.current_stage_id,
      latest_history_id: history.id,
      updated_at: new Date()
    })
    .eq('id', ticketId)

  return { data: history, error: updateError }
}

// Add a comment to a ticket
export async function addComment(ticketId, content, isInternal = false) {
  const { data: profile } = await supabase.auth.getUser()
  if (!profile) return { error: 'Not authenticated' }

  return await supabase
    .from('ticket_comments')
    .insert({
      ticket_id: ticketId,
      content,
      created_by: profile.id,
      is_internal: isInternal
    })
    .select(`
      *,
      author:profiles!ticket_comments_created_by_fkey(name)
    `)
    .single()
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
  return await supabase
    .from('ticket_attachments')
    .insert({
      ticket_id: ticketId,
      file_name: file.name,
      file_type: file.type,
      file_size: file.size,
      storage_path: filePath,
      uploaded_by: profile.id
    })
    .select(`
      *,
      uploaded_by_user:profiles!ticket_attachments_uploaded_by_fkey(name)
    `)
    .single()
}

// Helper function to get first stage of a workflow
async function getFirstStage(workflowId) {
  const { data } = await supabase
    .from('workflow_stages')
    .select('id')
    .eq('workflow_id', workflowId)
    .eq('is_start', true)
    .single()
  
  return data?.id
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
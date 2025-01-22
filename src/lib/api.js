import { supabase } from './supabaseClient'

// Auth API
export const auth = {
  signUp: async ({ email, password }) => {
    return await supabase.auth.signUp({ email, password })
  },
  
  signIn: async ({ email, password }) => {
    return await supabase.auth.signInWithPassword({ email, password })
  },
  
  signOut: async () => {
    return await supabase.auth.signOut()
  }
}

// Profile API
export const profiles = {
  get: async (userId) => {
    return await supabase
      .from('profiles')
      .select('*')
      .eq('auth_id', userId)
      .single()
  },
  
  update: async (userId, updates) => {
    return await supabase
      .from('profiles')
      .update(updates)
      .eq('auth_id', userId)
  },
  
  changeRole: async (userEmail, newRole) => {
    return await supabase
      .rpc('change_role', { user_email: userEmail, new_role: newRole })
  },
  
  delete: async (email) => {
    return await supabase
      .rpc('delete_user', { target_email: email })
  }
}

// Workflow API
export const workflows = {
  create: async ({ name, description, orgId }) => {
    return await supabase
      .from('workflows')
      .insert({
        name,
        description,
        org_id: orgId
      })
  },
  
  getStages: async (workflowId) => {
    return await supabase
      .rpc('get_workflow_stages', { workflow_uuid: workflowId })
  },
  
  addStage: async ({ workflowId, name, description, isStart, isEnd, isOther, nextStageId, prevStageId }) => {
    return await supabase
      .from('workflow_stages')
      .insert({
        workflow_id: workflowId,
        name,
        description,
        is_start: isStart,
        is_end: isEnd,
        is_other: isOther,
        next_stage_id: nextStageId,
        prev_stage_id: prevStageId
      })
  },
  
  addHook: async ({ stageId, hookType, config }) => {
    return await supabase
      .from('workflow_stage_hooks')
      .insert({
        stage_id: stageId,
        hook_type: hookType,
        config
      })
  },
  
  getStageHooks: async (stageId) => {
    return await supabase
      .rpc('get_stage_hooks', { stage_uuid: stageId })
  }
}

// Ticket API
export const tickets = {
  create: async ({ orgId, title, description, priority, workflowId }) => {
    return await supabase
      .rpc('create_ticket', {
        p_org_id: orgId,
        p_title: title,
        p_description: description,
        p_priority: priority,
        p_workflow_id: workflowId
      })
  },
  
  update: async ({ ticketId, title, description, priority, assignedTo, stageId }) => {
    return await supabase
      .rpc('update_ticket_data', {
        p_ticket_id: ticketId,
        p_title: title,
        p_description: description,
        p_priority: priority,
        p_assigned_to: assignedTo,
        p_stage_id: stageId
      })
  },
  
  addComment: async ({ ticketId, content, isInternal = false }) => {
    return await supabase
      .from('ticket_comments')
      .insert({
        ticket_id: ticketId,
        content,
        is_internal: isInternal
      })
  },
  
  addAttachment: async ({ ticketId, fileName, fileType, fileSize, storagePath }) => {
    return await supabase
      .from('ticket_attachments')
      .insert({
        ticket_id: ticketId,
        file_name: fileName,
        file_type: fileType,
        file_size: fileSize,
        storage_path: storagePath
      })
  },
  
  // Queries for getting tickets
  getAgentTickets: async () => {
    return await supabase
      .from('agent_tickets')
      .select('*')
  },
  
  getCustomerTickets: async () => {
    return await supabase
      .from('customer_tickets')
      .select('*')
  },
  
  getTicketDetails: async (ticketId) => {
    return await supabase
      .from('ticket_details')
      .select('*')
      .eq('ticket_id', ticketId)
      .single()
  },
  
  getTicketHistory: async (ticketId) => {
    return await supabase
      .from('ticket_history')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('changed_at', { ascending: false })
  },
  
  getTicketComments: async (ticketId) => {
    return await supabase
      .from('ticket_comments')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true })
  },
  
  getTicketAttachments: async (ticketId) => {
    return await supabase
      .from('ticket_attachments')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('uploaded_at', { ascending: false })
  }
}

// Organization API
export const organizations = {
  getDefault: async () => {
    return await supabase
      .rpc('get_or_create_default_org')
  }
}

// Stats API
export const stats = {
  getWorkflowStageStats: async () => {
    return await supabase
      .from('workflow_stage_stats')
      .select('*')
  },
  
  refreshStats: async () => {
    return await supabase
      .rpc('refresh_ticket_stats')
  }
} 
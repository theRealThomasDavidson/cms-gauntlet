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
  },

  getUser: async () => {
    return await supabase.auth.getUser()
  }
}

// Profile API
export const profiles = {
  get: async (userId) => {
    const { data, error } = await supabase
      .rpc('get_profile_by_auth_id', { user_auth_id: userId })
      .single()
    
    if (error) throw error
    return data
  },
  
  update: async (profileId, { username, name, email }) => {
    return await supabase
      .rpc('update_profile', {
        profile_id: profileId,
        new_username: username,
        new_name: name,
        new_email: email
      })
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
  list: async () => {
    const { data, error } = await supabase
      .from('workflows')
      .select(`
        *,
        workflow_stages (
          id,
          name,
          description,
          next_stage_id,
          prev_stage_id,
          is_start,
          is_end,
          is_other
        )
      `)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data
  },

  get: async (workflowId) => {
    const { data, error } = await supabase
      .from('workflows')
      .select(`
        *,
        workflow_stages (
          *,
          workflow_stage_hooks (
            *
          )
        )
      `)
      .eq('id', workflowId)
      .single()
    
    if (error) throw error
    return data
  },

  create: async ({ name, description }) => {
    const { data, error } = await supabase
      .from('workflows')
      .insert([{ name, description }])
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  update: async (workflowId, { name, description, is_active }) => {
    const { data, error } = await supabase
      .from('workflows')
      .update({ name, description, is_active })
      .eq('id', workflowId)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  delete: async (workflowId) => {
    const { error } = await supabase
      .from('workflows')
      .delete()
      .eq('id', workflowId)
    
    if (error) throw error
    return true
  }
}

// Workflow Stages API
export const workflowStages = {
  create: async ({ workflow_id, name, description, is_start, is_end, is_other }) => {
    const { data, error } = await supabase
      .from('workflow_stages')
      .insert([{
        workflow_id,
        name,
        description,
        is_start,
        is_end,
        is_other
      }])
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  update: async (stageId, { name, description, next_stage_id, prev_stage_id }) => {
    const { data, error } = await supabase
      .from('workflow_stages')
      .update({ 
        name, 
        description,
        next_stage_id,
        prev_stage_id
      })
      .eq('id', stageId)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  delete: async (stageId) => {
    const { error } = await supabase
      .from('workflow_stages')
      .delete()
      .eq('id', stageId)
    
    if (error) throw error
    return true
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
      .rpc('create_comment', {
        p_ticket_id: ticketId,
        p_content: content,
        p_is_internal: isInternal
      })
  },
  
  addAttachment: async ({ ticketId, fileName, fileType, fileSize, storagePath }) => {
    return await supabase
      .rpc('create_attachment', {
        p_ticket_id: ticketId,
        p_file_name: fileName,
        p_file_type: fileType,
        p_file_size: fileSize,
        p_storage_path: storagePath
      })
  },
  
  getAgentTickets: async (filters = {}) => {
    return await supabase
      .rpc('get_agent_tickets', {
        p_org_id: filters.orgId,
        p_priority: filters.priority,
        p_assigned_to: filters.assignedTo,
        p_stage_id: filters.stageId
      })
  },
  
  getCustomerTickets: async () => {
    return await supabase
      .rpc('get_customer_tickets')
  },
  
  getTicketDetails: async (ticketId) => {
    return await supabase
      .rpc('get_ticket_details', {
        p_ticket_id: ticketId
      })
      .single()
  },
  
  getTicketHistory: async (ticketId) => {
    return await supabase
      .rpc('get_ticket_history', {
        p_ticket_id: ticketId
      })
  },
  
  getTicketComments: async (ticketId) => {
    return await supabase
      .rpc('get_ticket_comments', {
        p_ticket_id: ticketId
      })
  },
  
  getTicketAttachments: async (ticketId) => {
    return await supabase
      .rpc('get_ticket_attachments', {
        p_ticket_id: ticketId
      })
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
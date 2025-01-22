import { supabase } from '../supabaseClient'

/**
 * Get all stages for a workflow in order
 * @param {string} workflowId The workflow ID
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const getWorkflowStages = async (workflowId) => {
  return await supabase
    .rpc('get_workflow_stages', {
      workflow_uuid: workflowId
    })
}

/**
 * Get active hooks for a stage
 * @param {string} stageId The stage ID
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const getStageHooks = async (stageId) => {
  return await supabase
    .rpc('get_stage_hooks', {
      stage_uuid: stageId
    })
}

/**
 * Get the default workflow for an organization
 * @param {string} orgId The organization ID
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const getDefaultWorkflow = async (orgId) => {
  return await supabase
    .rpc('get_default_workflow', {
      org_uuid: orgId
    })
}

/**
 * Create a new workflow
 * @param {Object} workflow The workflow data
 * @param {string} workflow.orgId Organization ID
 * @param {string} workflow.name Workflow name
 * @param {string} workflow.description Workflow description
 * @param {Object[]} workflow.stages Initial workflow stages
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const createWorkflow = async (workflow) => {
  return await supabase
    .from('workflows')
    .insert([{
      org_id: workflow.orgId,
      name: workflow.name,
      description: workflow.description,
      is_active: true
    }])
    .select()
    .single()
}

/**
 * Update a workflow
 * @param {string} workflowId The workflow ID
 * @param {Object} updates The updates to apply
 * @param {string} [updates.name] New name
 * @param {string} [updates.description] New description
 * @param {boolean} [updates.isActive] New active status
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const updateWorkflow = async (workflowId, updates) => {
  return await supabase
    .from('workflows')
    .update({
      name: updates.name,
      description: updates.description,
      is_active: updates.isActive
    })
    .eq('id', workflowId)
    .select()
    .single()
}

/**
 * Get workflow details including stages
 * @param {string} workflowId The workflow ID
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const getWorkflowDetails = async (workflowId) => {
  return await supabase
    .from('workflows')
    .select(`
      *,
      stages:workflow_stages (
        id,
        name,
        description,
        order,
        is_final,
        actions,
        sla_hours
      )
    `)
    .eq('id', workflowId)
    .single()
}

/**
 * List workflows for an organization
 * @param {string} orgId The organization ID
 * @param {boolean} [activeOnly=true] Only return active workflows
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const listWorkflows = async (orgId, activeOnly = true) => {
  let query = supabase
    .from('workflows')
    .select(`
      *,
      stages:workflow_stages (
        id,
        name,
        order
      )
    `)
    .eq('org_id', orgId)
  
  if (activeOnly) {
    query = query.eq('is_active', true)
  }
  
  return await query.order('created_at', { ascending: false })
}

/**
 * Add a stage to a workflow
 * @param {Object} stage The stage data
 * @param {string} stage.workflowId Workflow ID
 * @param {string} stage.name Stage name
 * @param {string} stage.description Stage description
 * @param {number} stage.order Stage order
 * @param {boolean} [stage.isFinal=false] Whether this is a final stage
 * @param {Object} [stage.actions] Available actions in this stage
 * @param {number} [stage.slaHours] SLA time in hours
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const addWorkflowStage = async (stage) => {
  return await supabase
    .from('workflow_stages')
    .insert([{
      workflow_id: stage.workflowId,
      name: stage.name,
      description: stage.description,
      order: stage.order,
      is_final: stage.isFinal || false,
      actions: stage.actions,
      sla_hours: stage.slaHours
    }])
    .select()
    .single()
}

/**
 * Update a workflow stage
 * @param {string} stageId The stage ID
 * @param {Object} updates The updates to apply
 * @param {string} [updates.name] New name
 * @param {string} [updates.description] New description
 * @param {number} [updates.order] New order
 * @param {boolean} [updates.isFinal] New final status
 * @param {Object} [updates.actions] New actions
 * @param {number} [updates.slaHours] New SLA hours
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const updateWorkflowStage = async (stageId, updates) => {
  return await supabase
    .from('workflow_stages')
    .update({
      name: updates.name,
      description: updates.description,
      order: updates.order,
      is_final: updates.isFinal,
      actions: updates.actions,
      sla_hours: updates.slaHours
    })
    .eq('id', stageId)
    .select()
    .single()
}

/**
 * Delete a workflow stage
 * @param {string} stageId The stage ID
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const deleteWorkflowStage = async (stageId) => {
  return await supabase
    .from('workflow_stages')
    .delete()
    .eq('id', stageId)
}

/**
 * Move a ticket to a different workflow stage
 * @param {Object} params The move parameters
 * @param {string} params.ticketId Ticket ID
 * @param {string} params.stageId Target stage ID
 * @param {string} [params.comment] Comment explaining the move
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const moveTicketToStage = async ({ ticketId, stageId, comment }) => {
  const { data: ticket, error: updateError } = await supabase
    .from('tickets')
    .update({
      current_stage_id: stageId,
      stage_changed_at: new Date().toISOString()
    })
    .eq('id', ticketId)
    .select()
    .single()

  if (updateError) return { error: updateError }
  
  // Add comment if provided
  if (comment) {
    await supabase
      .from('ticket_comments')
      .insert([{
        ticket_id: ticketId,
        content: `Stage changed: ${comment}`,
        is_system: true
      }])
  }

  return { data: ticket }
}

/**
 * Add a hook to a stage
 * @param {Object} hook The hook data
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const addStageHook = async (hook) => {
  return await supabase
    .from('workflow_stage_hooks')
    .insert([hook])
}

/**
 * Update a stage hook
 * @param {string} hookId The hook ID
 * @param {Object} updates The updates to apply
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const updateStageHook = async (hookId, updates) => {
  return await supabase
    .from('workflow_stage_hooks')
    .update(updates)
    .eq('id', hookId)
}

/**
 * Send a workflow notification
 * @param {string} hookId The hook ID
 * @param {string} ticketId The ticket ID
 * @param {string} userId The user ID
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const sendWorkflowNotification = async (hookId, ticketId, userId) => {
  return await supabase
    .rpc('send_workflow_notification', {
      p_hook_id: hookId,
      p_ticket_id: ticketId,
      p_user_id: userId
    })
}

/**
 * Delete a workflow
 * @param {string} workflowId The workflow ID
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const deleteWorkflow = async (workflowId) => {
  return await supabase
    .from('workflows')
    .delete()
    .eq('id', workflowId)
}

/**
 * Delete a stage hook
 * @param {string} hookId The hook ID
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const deleteStageHook = async (hookId) => {
  return await supabase
    .from('workflow_stage_hooks')
    .delete()
    .eq('id', hookId)
} 
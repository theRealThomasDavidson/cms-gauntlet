import { supabase } from '../supabaseClient'

/**
 * Get or create the default organization
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const getOrCreateDefaultOrg = async () => {
  return await supabase
    .rpc('get_or_create_default_org')
}

/**
 * Get an organization by ID
 * @param {string} orgId The organization ID
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const getOrganization = async (orgId) => {
  return await supabase
    .from('organizations')
    .select(`
      *,
      departments (
        id,
        name,
        parent_id
      ),
      teams (
        id,
        name,
        department_id
      )
    `)
    .eq('id', orgId)
    .single()
}

/**
 * Get all organizations visible to the current user
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const getOrganizations = async () => {
  return await supabase
    .from('organizations')
    .select('*')
}

/**
 * Create a new organization
 * @param {Object} org Organization data
 * @param {string} org.name Organization name
 * @param {string} org.slug Organization URL slug
 * @param {Object} [org.settings] Organization settings
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const createOrganization = async (org) => {
  return await supabase
    .from('organizations')
    .insert([{
      name: org.name,
      slug: org.slug,
      settings: org.settings || {},
      is_active: true
    }])
    .select()
    .single()
}

/**
 * Update organization details
 * @param {string} orgId Organization ID
 * @param {Object} updates Updates to apply
 * @param {string} [updates.name] New name
 * @param {string} [updates.settings] New settings
 * @param {boolean} [updates.isActive] New active status
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const updateOrganization = async (orgId, updates) => {
  return await supabase
    .from('organizations')
    .update({
      name: updates.name,
      settings: updates.settings,
      is_active: updates.isActive
    })
    .eq('id', orgId)
    .select()
    .single()
}

/**
 * Delete an organization
 * @param {string} orgId The organization ID
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const deleteOrganization = async (orgId) => {
  return await supabase
    .from('organizations')
    .delete()
    .eq('id', orgId)
}

/**
 * Get organization by slug
 * @param {string} slug Organization slug
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const getOrganizationBySlug = async (slug) => {
  return await supabase
    .from('organizations')
    .select('*')
    .eq('slug', slug)
    .single()
}

/**
 * Add a user to an organization
 * @param {Object} params Parameters
 * @param {string} params.orgId Organization ID
 * @param {string} params.userId User ID
 * @param {string} params.role User's role ('admin', 'agent', 'member')
 * @param {string[]} [params.permissions] Additional permissions
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const addOrganizationMember = async ({ orgId, userId, role, permissions = [] }) => {
  return await supabase
    .from('organization_members')
    .insert([{
      org_id: orgId,
      user_id: userId,
      role,
      permissions
    }])
    .select()
    .single()
}

/**
 * Update organization member
 * @param {string} orgId Organization ID
 * @param {string} userId User ID
 * @param {Object} updates Updates to apply
 * @param {string} [updates.role] New role
 * @param {string[]} [updates.permissions] New permissions
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const updateOrganizationMember = async (orgId, userId, updates) => {
  return await supabase
    .from('organization_members')
    .update({
      role: updates.role,
      permissions: updates.permissions
    })
    .match({ org_id: orgId, user_id: userId })
    .select()
    .single()
}

/**
 * Remove a user from an organization
 * @param {string} orgId Organization ID
 * @param {string} userId User ID
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const removeOrganizationMember = async (orgId, userId) => {
  return await supabase
    .from('organization_members')
    .delete()
    .match({ org_id: orgId, user_id: userId })
}

/**
 * Create a new department
 * @param {Object} dept Department data
 * @param {string} dept.orgId Organization ID
 * @param {string} dept.name Department name
 * @param {string} [dept.parentId] Parent department ID
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const createDepartment = async (dept) => {
  return await supabase
    .from('departments')
    .insert([{
      org_id: dept.orgId,
      name: dept.name,
      parent_id: dept.parentId
    }])
    .select()
    .single()
}

/**
 * Create a new team
 * @param {Object} team Team data
 * @param {string} team.orgId Organization ID
 * @param {string} team.name Team name
 * @param {string} team.departmentId Department ID
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const createTeam = async (team) => {
  return await supabase
    .from('teams')
    .insert([{
      org_id: team.orgId,
      name: team.name,
      department_id: team.departmentId
    }])
    .select()
    .single()
}

/**
 * Get organization members
 * @param {string} orgId Organization ID
 * @param {Object} [filters] Optional filters
 * @param {string} [filters.role] Filter by role
 * @param {string} [filters.departmentId] Filter by department
 * @param {string} [filters.teamId] Filter by team
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const getOrganizationMembers = async (orgId, filters = {}) => {
  let query = supabase
    .from('organization_members')
    .select(`
      *,
      profiles:user_id (
        id,
        name,
        avatar_url
      )
    `)
    .eq('org_id', orgId)

  if (filters.role) {
    query = query.eq('role', filters.role)
  }
  if (filters.departmentId) {
    query = query.eq('department_id', filters.departmentId)
  }
  if (filters.teamId) {
    query = query.eq('team_id', filters.teamId)
  }

  return await query.order('created_at', { ascending: false })
}

/**
 * Get user's organizations
 * @param {string} userId User ID
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const getUserOrganizations = async (userId) => {
  return await supabase
    .from('organization_members')
    .select(`
      role,
      permissions,
      organizations:org_id (
        id,
        name,
        slug,
        settings
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
} 
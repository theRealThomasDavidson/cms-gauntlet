import { supabase } from './supabaseClient'

// Types
type UserRole = 'customer' | 'agent' | 'admin'

interface Profile {
  id: string
  auth_id: string
  org_id?: string
  username?: string
  name?: string
  role: UserRole
  email: string
  teams: string[]
  created_at: string
  last_active?: string
  preferences: Record<string, unknown>
}

interface ProfileUpdate {
  username?: string
  name?: string
  email?: string
}

interface WorkflowCreate {
  name: string
  description?: string
  orgId: string
}

interface StageCreate {
  workflowId: string
  name: string
  description?: string
  isStart: boolean
  isEnd: boolean
  isOther: boolean
  nextStageId?: string
  prevStageId?: string
}

interface HookCreate {
  stageId: string
  hookType: string
  config: Record<string, unknown>
}

// Auth API
export const auth = {
  signUp: async ({ email, password }: { email: string; password: string }) => {
    return await supabase.auth.signUp({ email, password })
  },
  
  signIn: async ({ email, password }: { email: string; password: string }) => {
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
  get: async (userId: string) => {
    return await supabase
      .from('profiles')
      .select('*')
      .eq('auth_id', userId)
      .single()
  },
  
  update: async (profileId: string, updates: ProfileUpdate) => {
    return await supabase
      .rpc('update_profile', {
        profile_id: profileId,
        new_username: updates.username,
        new_name: updates.name,
        new_email: updates.email
      })
  },
  
  changeRole: async (userEmail: string, newRole: UserRole) => {
    return await supabase
      .rpc('change_role', { user_email: userEmail, new_role: newRole })
  },
  
  delete: async (email: string) => {
    return await supabase
      .rpc('delete_user', { target_email: email })
  }
}

// Workflow API
export const workflows = {
  create: async ({ name, description, orgId }: WorkflowCreate) => {
    return await supabase
      .from('workflows')
      .insert({
        name,
        description,
        org_id: orgId
      })
  },
  
  getStages: async (workflowId: string) => {
    return await supabase
      .rpc('get_workflow_stages', { workflow_uuid: workflowId })
  },
  
  addStage: async (stage: StageCreate) => {
    return await supabase
      .from('workflow_stages')
      .insert({
        workflow_id: stage.workflowId,
        name: stage.name,
        description: stage.description,
        is_start: stage.isStart,
        is_end: stage.isEnd,
        is_other: stage.isOther,
        next_stage_id: stage.nextStageId,
        prev_stage_id: stage.prevStageId
      })
  },
  
  addHook: async ({ stageId, hookType, config }: HookCreate) => {
    return await supabase
      .from('workflow_stage_hooks')
      .insert({
        stage_id: stageId,
        hook_type: hookType,
        config
      })
  },
  
  getStageHooks: async (stageId: string) => {
    return await supabase
      .rpc('get_stage_hooks', { stage_uuid: stageId })
  }
} 
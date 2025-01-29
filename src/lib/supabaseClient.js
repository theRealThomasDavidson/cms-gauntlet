import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Function to get visible profiles based on user role
export async function getVisibleProfiles() {
  const { data, error } = await supabase.rpc('get_visible_profiles')
  if (error) throw error
  return data
}

// Function to update a profile
export async function updateProfile(profileId, { username, name, email }) {
  const { error } = await supabase.rpc('update_profile', {
    profile_id: profileId,
    new_username: username,
    new_name: name,
    new_email: email
  })
  if (error) throw error
}

// Function to delete a user
export async function deleteUser(email) {
  const { data, error } = await supabase.rpc('delete_user', { target_email: email })
  if (error) throw error
  return data
}

// Create default organization if it doesn't exist
export async function ensureDefaultOrg() {
  const { data, error } = await supabase.rpc('get_or_create_default_org')
  if (error) return null
  return data
}

// Function to invoke Edge Functions
export async function invokeFunction(functionName, payload) {
  const { data, error } = await supabase.functions.invoke(functionName, {
    body: payload
  })
  if (error) throw error
  return data
} 
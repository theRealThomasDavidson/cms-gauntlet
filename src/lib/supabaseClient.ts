import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/supabase'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

// Admin client with service role key for admin operations
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Function to get visible profiles based on user role
export async function getVisibleProfiles() {
  const { data, error } = await supabase.rpc('get_visible_profiles')
  if (error) throw error
  return data
}

// Function to update a profile
export async function updateProfile(profileId: string, { username, name, email }: {
  username?: string
  name?: string
  email?: string
}) {
  const { error } = await supabase.rpc('update_profile', {
    profile_id: profileId,
    new_username: username,
    new_name: name,
    new_email: email
  })
  if (error) throw error
}

// Function to delete a user
export async function deleteUser(email: string) {
  const { data, error } = await supabase.rpc('delete_user', { target_email: email })
  if (error) throw error
  return data
} 
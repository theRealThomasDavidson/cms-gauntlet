import { supabase } from '../supabaseClient'

/**
 * Sign up a new user
 * @param {Object} params The signup parameters
 * @param {string} params.email User's email
 * @param {string} params.password User's password
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const signUp = async ({ email, password }) => {
  return await supabase.auth.signUp({
    email,
    password
  })
}

/**
 * Sign in a user with email and password
 * @param {Object} params The signin parameters
 * @param {string} params.email User's email
 * @param {string} params.password User's password
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const signIn = async ({ email, password }) => {
  return await supabase.auth.signInWithPassword({
    email,
    password
  })
}

/**
 * Sign in with OAuth provider
 * @param {Object} params The OAuth parameters
 * @param {string} params.provider The OAuth provider (e.g., 'github')
 * @returns {Promise<{ data, error }>} Supabase response
 */
export const signInWithOAuth = async ({ provider }) => {
  return await supabase.auth.signInWithOAuth({
    provider
  })
}

/**
 * Sign out the current user
 * @returns {Promise<{ error }>} Supabase response
 */
export const signOut = async () => {
  return await supabase.auth.signOut()
}

/**
 * Get the current session
 * @returns {Promise<{ data: { session }, error }>} Supabase response
 */
export const getSession = async () => {
  return await supabase.auth.getSession()
}

/**
 * Get the current user
 * @returns {Promise<{ data: { user }, error }>} Supabase response
 */
export const getUser = async () => {
  return await supabase.auth.getUser()
}

/**
 * Listen for auth state changes
 * @param {Function} callback The callback to run when auth state changes
 * @returns {Object} The subscription object
 */
export const onAuthStateChange = (callback) => {
  return supabase.auth.onAuthStateChange(callback)
} 
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      status: 200,
      headers: corsHeaders 
    })
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { user_id } = await req.json()
    console.log('Attempting to delete user with ID:', user_id)

    // Create admin client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get('PROJECT_URL') ?? '',
      Deno.env.get('SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
    })

    // Use the admin.deleteUser method
    const { data, error } = await supabaseAdmin.auth.admin.deleteUser(
      user_id
    )

    if (error) {
      console.error('Error deleting user:', error)
      throw error
    }

    console.log('Successfully deleted user:', data)
    return new Response(
      JSON.stringify({ success: true, data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in delete-user function:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.toString()
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
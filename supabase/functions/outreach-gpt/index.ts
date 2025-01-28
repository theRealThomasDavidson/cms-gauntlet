import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import OpenAI from "https://esm.sh/openai@4.20.1"
import { corsHeaders } from "../_shared/cors.ts"

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client for logging
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Initialize OpenAI with newer API
    const openai = new OpenAI({
      apiKey: Deno.env.get('OPENAI_API_KEY')
    })

    try {
      // Test a simple completion
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: "Say hello!" }
        ],
      })

      // Log successful response
      await supabaseClient
        .from('edge_function_logs')
        .insert({
          function_name: 'outreach-gpt',
          response: completion
        })

      return new Response(
        JSON.stringify({
          message: 'OpenAI test successful',
          response: completion.choices[0].message
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )

    } catch (error) {
      // Log error
      await supabaseClient
        .from('edge_function_logs')
        .insert({
          function_name: 'outreach-gpt',
          error: error.message
        })

      throw error
    }

  } catch (error) {
    return new Response(
      JSON.stringify({
        error: 'Error testing OpenAI',
        details: error.message
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
}) 
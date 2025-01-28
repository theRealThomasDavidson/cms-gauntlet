import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { ChatOpenAI } from "https://esm.sh/langchain/chat_models/openai"
import { 
  SystemMessage, 
  HumanMessage 
} from "https://esm.sh/langchain/schema"
import { PromptTemplate } from "https://esm.sh/langchain/prompts"
import { corsHeaders } from "../_shared/cors.ts"

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { context } = await req.json()
    
    // Initialize LangChain chat model
    const chat = new ChatOpenAI({
      temperature: 0.7,
      modelName: "gpt-3.5-turbo",
      openAIApiKey: Deno.env.get('OPENAI_API_KEY'),
    })

    // Create a prompt template
    const systemPromptTemplate = PromptTemplate.fromTemplate(`
      You are a helpful assistant generating responses for a customer service ticket.
      Use the following context to personalize your response:
      Student Name: {studentName}
      Recent Activity: {recentActivity}
      Upcoming Events: {upcomingEvents}
      Subject: {subject}
      
      Keep responses:
      - Professional and empathetic
      - Solution-focused
      - Clear and concise
      - Personalized to the student's context
    `)

    // Format the system prompt
    const systemPrompt = await systemPromptTemplate.format({
      studentName: context.studentName || 'the student',
      recentActivity: context.recentActivity?.join(', ') || 'none provided',
      upcomingEvents: context.upcomingEvents?.join(', ') || 'none provided',
      subject: context.ticketSubject || 'general inquiry'
    })

    // Use LangChain's messaging system
    const response = await chat.call([
      new SystemMessage(systemPrompt),
      new HumanMessage("Generate a helpful response for this ticket that addresses their needs and provides next steps.")
    ])

    return new Response(
      JSON.stringify({ response }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
}) 
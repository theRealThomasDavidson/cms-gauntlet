import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { ChatOpenAI } from "https://esm.sh/langchain@0.0.197/chat_models/openai"
import { SystemMessage, HumanMessage } from "https://esm.sh/langchain@0.0.197/schema"
import { PromptTemplate } from "https://esm.sh/langchain@0.0.197/prompts"
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

    // Updated prompt template with workflow context and proper signature
    const systemPromptTemplate = PromptTemplate.fromTemplate(`
      You are a helpful assistant named Otto generating responses for a {workflow.name} workflow ticket.
      
      Current Workflow Stage: {workflow.currentStage.name}
      Stage Description: {workflow.currentStage.description}

      Ticket Context:
      - Title: {ticketTitle}
      - Description: {ticketDescription}
      - Priority: {ticketPriority}
      - Status: {ticketStatus}

      Ticket History:
      {ticketHistory}
      
      Available Workflow Stages:
      {workflow.allStages}

      Relevant Knowledge Base Articles:
      {knowledgeBase}

      Guidelines:
      1. Consider the current stage's purpose: {workflow.currentStage.description}
      2. Keep responses professional and empathetic
      3. Focus on moving the ticket forward in the workflow
      4. Be solution-focused and clear
      5. Personalize the response for the customer
      6. Consider suggesting next steps or stage transitions if appropriate
      7. Reference specific pricing and specifications from the knowledge base when relevant
      8. Consider previous interactions from ticket history when responding
      9. Always sign responses as "Otto - Sales Specialist"

      Remember: You are Otto, representing a professional organization handling a {workflow.name} workflow ticket.
      Always end your response with:
      "Best regards,
      Otto - Sales Specialist"
    `)

    // Format the workflow stages for the prompt
    const formattedStages = context.workflow.allStages
      .map(stage => `- ${stage.name}: ${stage.description}`)
      .join('\n')

    // Format the system prompt
    const systemPrompt = await systemPromptTemplate.format({
      ...context,
      'workflow.name': context.workflow.name,
      'workflow.currentStage.name': context.workflow.currentStage.name,
      'workflow.currentStage.description': context.workflow.currentStage.description,
      'workflow.allStages': formattedStages,
      'ticketHistory': context.ticketHistory
        .map(h => `- ${new Date(h.timestamp).toLocaleString()}: ${h.action}${h.description ? ` - ${h.description}` : ''}${h.change ? ` (${h.change})` : ''}`)
        .join('\n'),
      'knowledgeBase': context.knowledgeBase
        .map(article => `
          ${article.title}:
          ${article.content}
        `).join('\n\n')
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

// Test with this sample context
const sampleContext = {
  customerName: "John Smith",
  ticketTitle: "Late Assignment Submission",
  ticketDescription: "I submitted my homework late",
  ticketPriority: "high",
  ticketStatus: "open",
  ticketHistory: [
    {
      description: "Ticket created",
      action: "create",
      timestamp: "2024-01-28T13:00:00Z",
    },
    {
      description: "Status updated",
      action: "update_status",
      timestamp: "2024-01-28T13:05:00Z",
      change: "new → open"
    }
  ]
} 
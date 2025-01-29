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
    
    // Debug log the incoming context
    console.log('Received context:', JSON.stringify({
      customerName: context.customerName,
      ticketTitle: context.ticketTitle,
      currentStage: context.workflow.currentStage,
      historyCount: context.ticketHistory?.length,
      knowledgeBaseCount: context.knowledgeBase?.length
    }, null, 2))

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
      
      Available Stage Transitions:
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

    // Filter function to get relevant history entries
    const filterRelevantHistory = (h: any) => {
      // Keep initial ticket creation
      if (h.changes.action === 'created') return true;
      // Keep customer messages (non-AI responses)
      if (h.changes.change_reason && 
          !h.changes.change_reason.includes('AI response') &&
          !h.changes.change_reason.includes('Stage changed') &&
          !h.changes.change_reason.includes('Stage updated')) return true;
      return false;
    };

    // Format the history for debugging
    const formattedHistory = context.ticketHistory
      .filter(filterRelevantHistory)
      .map(h => ({
        timestamp: new Date(h.changed_at).toLocaleString(),
        action: h.changes.action || 'update',
        description: h.description,
        reason: h.changes.change_reason
      }));

    // Format the system prompt
    const systemPrompt = await systemPromptTemplate.format({
      ...context,
      'workflow.name': context.workflow.name,
      'workflow.currentStage.name': context.workflow.currentStage.name,
      'workflow.currentStage.description': context.workflow.currentStage.description,
      'workflow.allStages': formattedStages,
      'ticketHistory': context.ticketHistory
        .filter(filterRelevantHistory)
        .map(h => `- ${new Date(h.changed_at).toLocaleString()}: ${h.changes.action || 'update'}${h.description ? ` - ${h.description}` : ''}${h.changes.change_reason ? ` (${h.changes.change_reason})` : ''}`)
        .join('\n'),
      'knowledgeBase': context.knowledgeBase
        .map(article => `
          ${article.title}:
          ${article.content}
        `).join('\n\n')
    })

    // Debug log the formatted prompt
    console.log('Formatted prompt:', systemPrompt)

    // Return the AI response instead of just the prompt
    const response = await chat.call([
      new SystemMessage(systemPrompt),
      new HumanMessage("Generate a helpful response for this ticket that addresses their needs and provides next steps.")
    ])

    // Get stage recommendation
    const stageAnalysisPrompt = `Given this customer service response:
    "{previousResponse}"

    And these available stages:
    ${context.workflow.allStages.map(stage => 
      `- ${stage.name}${stage.is_start ? ' (start)' : ''}${stage.is_end ? ' (end)' : ''}`
    ).join('\n')}

    Current stage: ${context.workflow.currentStage.name}

    Provide ONLY the name of the stage we should be in after this response. 
    Use EXACTLY one of the stage names listed above.
    Do not provide explanation or additional text.`;

    const stageRecommendation = await chat.call([
      new SystemMessage(stageAnalysisPrompt
        .replace("{previousResponse}", response.content)
      ),
      new HumanMessage("What stage should this ticket be in?(please only say the stage name and nothing else)")
    ]);

    return new Response(
      JSON.stringify({ 
        response,
        stageRecommendation,
        debug: {
          historyCount: context.ticketHistory?.length,
          currentStage: context.workflow.currentStage,
          formattedHistory
        }
      }),
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

const messagePrompt = `You are a helpful CRM assistant for a canoe company. 
Your task is to help manage customer interactions and suggest appropriate workflow stages.

Current workflow stages available:
- New Ticket (start)
- Triage Damage
- Complete (end)

For each response:
1. Generate a helpful message for the customer
2. End your message with one of these transition phrases:
   - "We'll stay in the current stage because..." (if staying)
   - "We'll move on to <stage_name> because..." (if moving)

Format your response as:
---
MESSAGE: Your message to the customer...

[Your transition phrase explaining the stage decision]

Best regards,
Otto - Sales Specialist
---`;

const stageAnalysisPrompt = `Given this customer service response:
"{previousResponse}"

And these available stages:
- New Ticket (start)
- Triage Damage
- Complete (end)

Current stage: {currentStage}

Provide ONLY the name of the stage we should be in after this response. 
Use EXACTLY one of the stage names listed above.
Do not provide explanation or additional text.`;

const userPrompt = `Context:
Current Stage: {currentStage}
Customer Name: {customerName}
Previous Messages: {previousMessages}

Generate a response with a stage transition explanation.`; 
// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { ChatOpenAI } from "npm:@langchain/openai"
import { SystemMessage, HumanMessage } from "https://esm.sh/langchain@0.0.197/schema"
import { PromptTemplate } from "https://esm.sh/langchain@0.0.197/prompts"
import { LangChainTracer } from "https://esm.sh/langchain@0.0.197/callbacks"
import { Client } from 'npm:langsmith'

// Configure LangSmith for tracing
const client = new Client({
  apiKey: Deno.env.get("LANGCHAIN_API_KEY"),
  endpoint: Deno.env.get("LANGSMITH_ENDPOINT") || "https://api.smith.langchain.com",
});

const projectName = Deno.env.get("LANGSMITH_PROJECT");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',  // More permissive for testing
  'Access-Control-Allow-Methods': '*',
  'Access-Control-Max-Age': '86400',  // Cache preflight for 24 hours
  'Access-Control-Allow-Credentials': 'true'  // Since you're using authorization
}

// Initialize tracer with more configuration
const tracer = new LangChainTracer({
  projectName: Deno.env.get("LANGSMITH_PROJECT"),
  apiKey: Deno.env.get("LANGSMITH_API_KEY"),
  endpoint: Deno.env.get("LANGSMITH_ENDPOINT") || "https://api.smith.langchain.com"
});

console.log("LangSmith Config:", {
  project: Deno.env.get("LANGSMITH_PROJECT"),
  hasApiKey: !!Deno.env.get("LANGSMITH_API_KEY"),
  hasTracing: Deno.env.get("LANGSMITH_TRACING"),
});

// Initialize chat with proper tracing configuration
const chat = new ChatOpenAI({
  temperature: 0.7,
  modelName: "gpt-3.5-turbo",
  openAIApiKey: Deno.env.get('OPENAI_API_KEY'),
  configuration: {
    baseOptions: {
      headers: {
        "Langchain-Project": projectName,
        "Langchain-Trace-V2": "true"
      }
    }
  }
})

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...corsHeaders,
        'Vary': 'Origin'  // Important for caching with multiple origins
      }
    })
  }

  try {
    const { context } = await req.json()

    // Start timing
    const startTime = performance.now()

    // Format history and stages
    const formattedHistory = context.ticketHistory
      .filter(h => h.changes.action === 'created' || 
        (h.changes.change_reason && 
         !h.changes.change_reason.includes('AI response') &&
         !h.changes.change_reason.includes('Stage changed') &&
         !h.changes.change_reason.includes('Stage updated')))
      .map(h => ({
        timestamp: new Date(h.changed_at).toLocaleString(),
        action: h.changes.action || 'update',
        description: h.description,
        reason: h.changes.change_reason
      }))
      .map(h => `${h.timestamp}: ${h.description}`)  // Convert to string
      .join('\n');  // Join with newlines

    const formattedStages = context.workflow.allStages
      .map(stage => `- ${stage.name}: ${stage.description}`)
      .join('\n')

    // Format the knowledge base articles
    const formattedKnowledgeBase = context.knowledgeBase
    ? context.knowledgeBase
        .map(article => `
          Title: ${article.title}
          Content: ${article.content}
        `).join('\n\n')
    : 'No knowledge base articles available';

    // Generate response
    const systemPrompt = await PromptTemplate.fromTemplate(`
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
    `).format({
      ...context,
      'workflow.name': context.workflow.name,
      'workflow.currentStage.name': context.workflow.currentStage.name,
      'workflow.currentStage.description': context.workflow.currentStage.description,
      'workflow.allStages': formattedStages,
      'ticketHistory': formattedHistory,
      'knowledgeBase': formattedKnowledgeBase
    });

    const response = await chat.call([
      new SystemMessage(systemPrompt),
      new HumanMessage("Generate a helpful response for this ticket that addresses their needs and provides next steps.")
    ])

    // Get stage recommendation
    const stageAnalysisPrompt = `Given this customer service response:
    "${response.content}"

    And these available stages:
    ${context.workflow.allStages.map(stage => 
      `- ${stage.name}${stage.is_start ? ' (start)' : ''}${stage.is_end ? ' (end)' : ''}`
    ).join('\n')}

    Current stage: ${context.workflow.currentStage.name}

    Provide ONLY the name of the stage we should be in after this response. 
    Use EXACTLY one of the stage names listed above.
    Do not provide explanation or additional text.`;

    const stageRecommendation = await chat.call([
      new SystemMessage(stageAnalysisPrompt),
      new HumanMessage("What stage should this ticket be in?(please only say the stage name and nothing else)")
    ])

    // End timing
    const endTime = performance.now()

    return new Response(
      JSON.stringify({ 
        response,
        stageRecommendation,
        debug: {
          historyCount: context.ticketHistory?.length,
          currentStage: context.workflow.currentStage,
          formattedHistory,
          timing: {
            totalMs: endTime - startTime
          }
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
});

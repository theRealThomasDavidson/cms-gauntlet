# OutreachGPT Implementation Checklist

## Database Setup
- [x] Create generate_ticket_message function
- [x] Set up basic permissions
- [ ] Add RLS policies for ticket history AI messages
- [ ] Add indexes for AI message lookups
  - [ ] Index on ticket_history(changes) WHERE changes->>'action' = 'ai_message'
  - [ ] Index on edge_function_logs(function_name, created_at)
  - [ ] Index on edge_function_logs(response) WHERE function_name = 'outreach-gpt'
  - [ ] Test index performance with EXPLAIN ANALYZE

## Edge Function
- [x] Basic edge function structure
- [x] Add CORS handling
- [x] Add shared CORS module
- [x] Deploy function
- [x] Add LangChain Integration
  - [x] Add API key to .env
  - [x] Set up secret in Supabase
  - [x] Set up LangChain basics
    - [x] Import ChatOpenAI from LangChain
    - [x] Import PromptTemplate
    - [x] Basic message chain setup
  - [ ] Implement LangChain features
    - [x] Set up proper prompt templates
      - [x] Define system message template
      - [x] Define user message template
      - [x] Test template variables
    - [ ] Add structured output (optional)
    - [ ] Add conversation memory (optional)
    - [ ] Add knowledge base (optional)
- [x] Add error handling
  - [x] Handle API errors
  - [x] Handle context validation
  - [ ] Handle rate limits
- [x] Add logging using edge_function_logs table
  - [x] Log API calls
  - [x] Log errors
  - [x] Log usage metrics
  - [ ] Verify indexes are being used
- [ ] Add rate limiting
- [ ] Add secret management for AI API keys

## Frontend
- [ ] Add "Generate AI Message" button to ticket view
- [ ] Create context builder UI
  - [ ] Student info selector
  - [ ] Template selector
  - [ ] Custom parameters
- [ ] Add message preview/edit interface
  - [ ] Show original vs AI message
  - [ ] Allow edits
  - [ ] Save edit history
- [ ] Add loading states
- [ ] Add error handling
- [ ] Add success notifications

## Testing
- [ ] Test database function permissions
- [ ] Test edge function
  - [ ] Test with sample context
  - [ ] Test with invalid inputs
  - [ ] Test rate limits
- [ ] Test AI integration
  - [ ] Test prompt effectiveness
  - [ ] Test response handling
  - [ ] Test error scenarios
- [ ] Test frontend components
  - [ ] Test UI flows
  - [ ] Test error states
  - [ ] Test loading states

## Documentation
- [ ] Document context format
- [ ] Document AI prompt templates
- [ ] Document rate limits
- [ ] Document permissions
- [ ] Add usage examples

## Files to Update
- [x] supabase/schema/58_outreach_gpt.sql
- [x] supabase/schema/57_edge_function_logs.sql
- [ ] .env (for AI API keys)
- [ ] package.json (for new dependencies) 
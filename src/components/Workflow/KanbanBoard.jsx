import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Plus, ChevronDown, X, Sparkles } from 'lucide-react';
import PropTypes from 'prop-types';
import { getTicketById } from '../../lib/api/tickets';
import { MessagePreviewDialog } from '../Tickets/MessagePreviewDialog';

export default function KanbanBoard({ workflowId, profile }) {
  const [stages, setStages] = useState([]);
  const [ticketsByStage, setTicketsByStage] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [movingTicket, setMovingTicket] = useState(null);
  const [showCommentDialog, setShowCommentDialog] = useState(false);
  const [transitionComment, setTransitionComment] = useState('');
  const [pendingTransition, setPendingTransition] = useState(null);
  const [showMessageDialog, setShowMessageDialog] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [generatingMessage, setGeneratingMessage] = useState(false);
  const [generatedMessage, setGeneratedMessage] = useState('');
  const [generationStep, setGenerationStep] = useState('');

  // Add knowledgeBase constant
  const knowledgeBase = {
    articles: [
      {
        title: "Canoe Pricing Guide",
        content: `# Comprehensive Canoe Pricing Guide

## Base Pricing By Material (Length-Based)
### Aluminum ($30/ft)
- 10ft: $300 base
- 14ft: $420 base
- 18ft: $540 base
- 20ft: $600 base

### Fiberglass ($25/ft)
- 10ft: $250 base
- 14ft: $350 base
- 18ft: $450 base
(Not available in 20ft)

### Wood ($70/ft)
- 10ft: $700 base
- 14ft: $980 base
- 18ft: $1,260 base
- 20ft: $1,400 base`
      },
      {
        title: "Canoe Specifications",
        content: `# Detailed Canoe Specifications

## Material Characteristics
### Aluminum
- Hull thickness: 0.080 inches
- Marine-grade aluminum alloy
- Maintenance: Low
- Durability: High
- Weight: Medium (65-85 lbs)
- Best for: Durability, low maintenance`
      }
    ]
  };

  useEffect(() => {
    if (workflowId) {
      fetchStagesAndTickets();
    }
  }, [workflowId]);

  async function fetchStagesAndTickets() {
    try {
      // Fetch stages
      const { data: stagesData, error: stagesError } = await supabase
        .rpc('get_workflow_stages', { workflow_uuid: workflowId });

      if (stagesError) throw stagesError;
      setStages(stagesData || []);

      // Fetch tickets
      const { data: tickets, error: ticketsError } = await supabase
        .rpc('get_tickets_by_workflow', {
          p_workflow_id: workflowId
        });

      if (ticketsError) throw ticketsError;

      // Organize tickets by stage
      const ticketMap = {};
      tickets?.forEach(ticket => {
        if (!ticketMap[ticket.current_stage_id]) {
          ticketMap[ticket.current_stage_id] = [];
        }
        ticketMap[ticket.current_stage_id].push(ticket);
      });
      setTicketsByStage(ticketMap);

    } catch (err) {
      setError('Error loading kanban board');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }

  const getStageHeaderColor = (index) => {
    const colors = [
      'bg-pink-100 border-pink-200',
      'bg-yellow-100 border-yellow-200'
    ];
    return colors[index % colors.length];
  };

  function openMessageDialog(ticket, stageId) {
    setShowMessageDialog(true);
    setSelectedTicket({
      ...ticket,
      currentStageId: stageId
    });
    setGeneratedMessage('');
    setGenerationStep('');
  }

  async function generateAIResponse(ticket) {
    setGeneratingMessage(true);
    setGenerationStep('Preparing context...');
    try {
      // Fetch ticket history using RPC
      const { data: ticketHistory, error: historyError } = await supabase
        .rpc('get_ticket_history', {
          p_ticket_id: ticket.id
        });

      if (historyError) {
        console.error('Error fetching ticket history:', historyError);
      }

      // Find current stage info
      const currentStage = stages.find(s => s.id === ticket.current_stage_id);

      // Prepare context object
      const requestBody = {
        context: {
          customerName: ticket.assigned_to_name || 'Customer',
          ticketTitle: ticket.title,
          ticketDescription: ticket.description,
          ticketPriority: ticket.priority,
          ticketStatus: ticket.status || 'open',
          ticketHistory: ticketHistory || [],
          workflow: {
            name: ticket.workflow_name,
            currentStage: {
              name: currentStage?.name || 'Unknown',
              description: currentStage?.description || '',
            },
            allStages: stages.map(stage => ({
              name: stage.name,
              description: stage.description
            }))
          },
          knowledgeBase: knowledgeBase.articles
        }
      };

      setGenerationStep('Connecting to AI service...');
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/outreach-gpt`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();
      setGenerationStep('Finalizing response...');
      
      if (data.response?.kwargs?.content) {
        setGeneratedMessage(data.response.kwargs.content);
      } else {
        console.error('Unexpected response format:', data);
        setGeneratedMessage('Error: Unexpected response format');
      }

    } catch (err) {
      console.error('Error generating message:', err);
      setGeneratedMessage('Error generating response. Please try again.');
    } finally {
      setGeneratingMessage(false);
    }
  }

  async function generateAndOpenDialog(ticket, stageId) {
    // Open dialog first
    openMessageDialog(ticket, stageId);
    // Then generate AI response
    await generateAIResponse(ticket);
  }

  if (loading) return <div>Loading kanban board...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <div className="p-4">
      <div className="flex gap-4 overflow-x-auto min-h-[calc(100vh-12rem)] pb-4">
        {stages.map((stage, index) => (
          <div
            key={stage.id}
            className="flex-none w-80 bg-gray-50 rounded-lg shadow-sm"
          >
            {/* Stage Header */}
            <div className={`p-3 border-b flex justify-between items-center rounded-t-lg ${getStageHeaderColor(index)}`}>
              <div>
                <h3 className="font-semibold text-gray-900">{stage.name}</h3>
                <p className="text-sm text-gray-500">{stage.description}</p>
              </div>
              <button
                className="p-1.5 hover:bg-white/50 rounded-lg transition-all"
                title="Add ticket"
              >
                <Plus size={20} className="text-gray-500" />
              </button>
            </div>

            {/* Stage Content - Tickets */}
            <div className="p-2 space-y-2">
              {ticketsByStage[stage.id]?.length === 0 ? (
                <div className="text-sm text-gray-500 italic p-3">No tickets in this stage</div>
              ) : (
                ticketsByStage[stage.id]?.map(ticket => (
                  <div 
                    key={ticket.id}
                    className="bg-white p-3 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-all"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-grow">
                        <div className="text-sm font-medium">{ticket.title}</div>
                        {ticket.description && (
                          <div className="text-xs text-gray-600 mt-1 line-clamp-2">{ticket.description}</div>
                        )}
                        <div className="text-xs text-gray-500 mt-1">
                          {ticket.priority && (
                            <span className="mr-2">Priority: {ticket.priority}</span>
                          )}
                          {ticket.assigned_to_name && (
                            <span>Assigned to: {ticket.assigned_to_name}</span>
                          )}
                        </div>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            await generateAndOpenDialog(ticket, stage.id);
                          }}
                          className="mt-2 text-xs flex items-center text-blue-600 hover:text-blue-700"
                        >
                          <Sparkles className="h-3 w-3 mr-1" />
                          Generate Response
                        </button>
                      </div>
                      <div className="relative">
                        <button
                          onClick={() => openMessageDialog(ticket, stage.id)}
                          className="text-xs flex items-center text-gray-600 hover:text-gray-700 border rounded px-2 py-1 hover:bg-gray-50"
                        >
                          <ChevronDown size={14} className="mr-1" />
                          Move Ticket
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Stage Footer - Stats */}
            <div className="p-3 border-t bg-white rounded-b-lg">
              <div className="text-xs text-gray-500">
                {ticketsByStage[stage.id]?.length || 0} tickets
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Message Preview Dialog */}
      {showMessageDialog && selectedTicket && (
        <MessagePreviewDialog
          isOpen={showMessageDialog}
          onClose={() => {
            setShowMessageDialog(false);
            setSelectedTicket(null);
            setGeneratedMessage('');
            setGenerationStep('');
          }}
          onConfirm={async (message, newStageId) => {
            try {
              // First update the message with all required fields
              const { error: messageError } = await supabase.rpc('update_ticket_data', {
                p_ticket_id: selectedTicket.id,
                p_title: selectedTicket.title,
                p_description: message || selectedTicket.description,
                p_status: selectedTicket.status || 'open',
                p_priority: selectedTicket.priority || 'medium',
                p_assigned_to: selectedTicket.assigned_to,
                p_change_reason: message ? 'Response added' : 'Stage changed'
              });

              if (messageError) throw messageError;

              // Create notification if there's a message
              if (message) {
                const { error: notificationError } = await supabase.rpc('create_notification', {
                  p_user_id: selectedTicket.created_by,
                  p_type: 'ticket_update',
                  p_title: 'Response Added to Your Ticket',
                  p_description: `A response has been added to your ticket: ${selectedTicket.title}`,
                  p_metadata: JSON.stringify({
                    ticket_id: selectedTicket.id,
                    action: 'response_added',
                    workflow_id: selectedTicket.workflow_id
                  })
                });

                if (notificationError) {
                  console.error('Error creating notification:', notificationError);
                }
              }

              // Then update the stage if it changed
              if (newStageId && newStageId !== selectedTicket.currentStageId) {
                const { error: stageError } = await supabase.rpc('update_ticket_stage', {
                  p_ticket_id: selectedTicket.id,
                  p_stage_id: newStageId,
                  p_change_reason: message ? 'Stage updated with response' : 'Stage changed'
                });
                if (stageError) throw stageError;

                // Create stage change notification
                const { error: stageNotificationError } = await supabase.rpc('create_notification', {
                  p_user_id: selectedTicket.created_by,
                  p_type: 'ticket_stage_change',
                  p_title: 'Ticket Stage Updated',
                  p_description: `Your ticket "${selectedTicket.title}" has been moved to a new stage`,
                  p_metadata: JSON.stringify({
                    ticket_id: selectedTicket.id,
                    action: 'stage_change',
                    workflow_id: selectedTicket.workflow_id,
                    new_stage_id: newStageId
                  })
                });

                if (stageNotificationError) {
                  console.error('Error creating stage change notification:', stageNotificationError);
                }
              }

              await fetchStagesAndTickets(); // Refresh the board
            } catch (err) {
              console.error('Error updating ticket:', err);
            }
            setShowMessageDialog(false);
            setSelectedTicket(null);
          }}
          ticketContext={{
            title: selectedTicket.title,
            description: selectedTicket.description,
            currentStageId: selectedTicket.currentStageId,
            stages: stages,
            knowledgeKeywords: [],
            customerInfo: {}
          }}
          generatedMessage={generatedMessage}
          isLoading={generatingMessage}
          loadingStep={generationStep}
        />
      )}
    </div>
  );
}

KanbanBoard.propTypes = {
  workflowId: PropTypes.string.isRequired,
  profile: PropTypes.shape({
    id: PropTypes.string.isRequired,
    // Add other profile shape requirements as needed
  }).isRequired
}; 
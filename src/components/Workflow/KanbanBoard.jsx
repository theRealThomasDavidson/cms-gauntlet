import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Plus, ChevronDown, X } from 'lucide-react';
import PropTypes from 'prop-types';
import { getTicketById } from '../../lib/api/tickets';

export default function KanbanBoard({ workflowId, profile }) {
  const [stages, setStages] = useState([]);
  const [ticketsByStage, setTicketsByStage] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [movingTicket, setMovingTicket] = useState(null);
  const [showCommentDialog, setShowCommentDialog] = useState(false);
  const [transitionComment, setTransitionComment] = useState('');
  const [pendingTransition, setPendingTransition] = useState(null);

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

  function handleStageChangeStart(ticketId, newStageId) {
    setPendingTransition({ ticketId, newStageId });
    setShowCommentDialog(true);
  }

  async function handleStageChange(comment = '') {
    if (!pendingTransition) return;
    
    try {
      setMovingTicket(pendingTransition.ticketId);

      // Get current ticket data
      const { data: currentTicket, error: fetchError } = await getTicketById(pendingTransition.ticketId);

      if (fetchError) throw fetchError;

      // Update ticket data with stage change
      const { error: updateError } = await supabase.rpc('update_ticket_data', {
        p_ticket_id: pendingTransition.ticketId,
        p_title: currentTicket.title,
        p_description: currentTicket.description,
        p_status: currentTicket.status || 'open',
        p_priority: currentTicket.priority,
        p_assigned_to: currentTicket.assigned_to,
        p_change_reason: comment || 'Stage changed'
      });

      if (updateError) throw updateError;

      // Update the stage using RPC function
      const { error: stageError } = await supabase
        .rpc('update_ticket_stage', {
          p_ticket_id: pendingTransition.ticketId,
          p_stage_id: pendingTransition.newStageId,
          p_change_reason: comment || 'Stage changed'
        });

      if (stageError) throw stageError;

      await fetchStagesAndTickets(); // Refresh the board
      setShowCommentDialog(false);
      setTransitionComment('');
      setPendingTransition(null);
    } catch (err) {
      console.error('Error moving ticket:', err);
      // You might want to show a toast notification here
    } finally {
      setMovingTicket(null);
    }
  }

  const getStageHeaderColor = (index) => {
    const colors = [
      'bg-pink-100 border-pink-200',
      'bg-yellow-100 border-yellow-200'
    ];
    return colors[index % colors.length];
  };

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
                      </div>
                      <div className="relative">
                        <select
                          onChange={(e) => handleStageChangeStart(ticket.id, e.target.value)}
                          value={stage.id}
                          disabled={movingTicket === ticket.id}
                          className="appearance-none bg-transparent pr-6 py-1 pl-2 text-sm border rounded hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                        >
                          {stages.map(s => (
                            <option key={s.id} value={s.id}>
                              Move to {s.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown size={14} className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500" />
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

      {/* Comment Dialog */}
      {showCommentDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Add Transition Comment</h3>
              <button 
                onClick={() => {
                  setShowCommentDialog(false);
                  setPendingTransition(null);
                  setTransitionComment('');
                }}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X size={20} />
              </button>
            </div>
            <textarea
              value={transitionComment}
              onChange={(e) => setTransitionComment(e.target.value)}
              placeholder="Why is this ticket being moved? (Optional)"
              className="w-full p-2 border rounded-lg mb-4 h-32 resize-none"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowCommentDialog(false);
                  setPendingTransition(null);
                  setTransitionComment('');
                }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => handleStageChange(transitionComment)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Move Ticket
              </button>
            </div>
          </div>
        </div>
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
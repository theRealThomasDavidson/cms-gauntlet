import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Plus } from 'lucide-react';
import PropTypes from 'prop-types';

export default function KanbanBoard({ workflowId }) {
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

      // TODO: Fetch tickets when ticket table is ready
      // const { data: ticketsData, error: ticketsError } = await supabase
      //   .from('tickets')
      //   .select('*')
      //   .eq('workflow_id', workflowId);

      // if (ticketsError) throw ticketsError;
      // setTickets(ticketsData || []);

    } catch (err) {
      setError('Error loading kanban board');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div>Loading kanban board...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <div className="p-4">
      <div className="flex gap-4 overflow-x-auto min-h-[calc(100vh-12rem)] pb-4">
        {stages.map((stage) => (
          <div
            key={stage.id}
            className="flex-none w-80 bg-gray-50 rounded-lg shadow-sm"
          >
            {/* Stage Header */}
            <div className="p-3 bg-white border-b flex justify-between items-center rounded-t-lg">
              <div>
                <h3 className="font-semibold text-gray-900">{stage.name}</h3>
                <p className="text-sm text-gray-500">{stage.description}</p>
              </div>
              <button
                className="p-1.5 hover:bg-gray-50 rounded-lg transition-all"
                title="Add ticket"
              >
                <Plus size={20} className="text-gray-500" />
              </button>
            </div>

            {/* Stage Content - Tickets */}
            <div className="p-2 space-y-2">
              {/* Placeholder tickets until we implement the tickets table */}
              <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-all cursor-pointer">
                <div className="text-sm font-medium">Sample Ticket</div>
                <div className="text-xs text-gray-500 mt-1">No tickets yet - coming soon!</div>
              </div>
            </div>

            {/* Stage Footer - Stats */}
            <div className="p-3 border-t bg-white rounded-b-lg">
              <div className="text-xs text-gray-500">
                0 tickets
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

KanbanBoard.propTypes = {
  workflowId: PropTypes.string.isRequired
}; 
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { X } from 'lucide-react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';

export function AssignWorkflowModal({ ticket, onClose, onAssigned, profile }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [workflows, setWorkflows] = useState([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [stages, setStages] = useState([]);
  const [selectedStage, setSelectedStage] = useState(null);

  useEffect(() => {
    loadWorkflows();
  }, []);

  useEffect(() => {
    if (selectedWorkflow) {
      loadStages(selectedWorkflow);
    }
  }, [selectedWorkflow]);

  async function loadWorkflows() {
    try {
      const { data, error } = await supabase.rpc('get_active_workflows');
      if (error) throw error;
      setWorkflows(data || []);
    } catch (err) {
      setError('Failed to load workflows');
      console.error('Error loading workflows:', err);
    }
  }

  async function loadStages(workflowId) {
    try {
      const { data, error } = await supabase.rpc('get_workflow_stages', {
        workflow_uuid: workflowId
      });

      if (error) throw error;
      setStages(data || []);
      if (data?.length > 0) {
        setSelectedStage(data[0].id);
      }
    } catch (err) {
      setError('Failed to load stages');
      console.error('Error loading stages:', err);
    }
  }

  async function handleAssign() {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase.rpc('assign_ticket_to_workflow', {
        p_ticket_id: ticket.id,
        p_workflow_id: selectedWorkflow,
        p_initial_stage_id: selectedStage,
        p_reason: 'Manual workflow assignment'
      });

      if (error) {
        console.error('Detailed error:', {
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        throw error;
      }

      onAssigned();
      navigate(`/workflows/${selectedWorkflow}/kanban`);
    } catch (err) {
      console.error('Error assigning workflow:', err);
      setError(err.message || 'Failed to assign workflow');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Assign Workflow</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X size={20} />
          </button>
        </div>

        <div className="mb-6">
          <h3 className="font-semibold mb-2">Current Ticket</h3>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="font-medium">{ticket.title}</p>
            <p className="text-sm text-gray-600 mt-1">{ticket.description}</p>
          </div>
        </div>

        <form onSubmit={handleAssign} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Select Workflow</label>
            <select
              value={selectedWorkflow || ''}
              onChange={(e) => setSelectedWorkflow(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">Choose a workflow...</option>
              {workflows.map(workflow => (
                <option key={workflow.id} value={workflow.id}>
                  {workflow.name}
                </option>
              ))}
            </select>
          </div>

          {selectedWorkflow && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Initial Stage</label>
              <select
                value={selectedStage || ''}
                onChange={(e) => setSelectedStage(e.target.value)}
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="">Choose a stage...</option>
                {stages.map(stage => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {error && (
            <div className="text-red-600">{error}</div>
          )}

          <div className="flex justify-end gap-4 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg font-semibold hover:bg-gray-200 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !selectedWorkflow || !selectedStage}
              className="px-4 py-2 text-white bg-blue-600 rounded-lg font-semibold hover:bg-blue-700 transition-all disabled:opacity-50"
            >
              {loading ? 'Assigning...' : 'Assign Workflow'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

AssignWorkflowModal.propTypes = {
  ticket: PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    description: PropTypes.string
  }).isRequired,
  onClose: PropTypes.func.isRequired,
  onAssigned: PropTypes.func.isRequired,
  profile: PropTypes.object.isRequired
}; 
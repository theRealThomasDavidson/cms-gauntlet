import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { ArrowLeft, Edit } from 'lucide-react';
import PropTypes from 'prop-types';

export default function WorkflowDetail({ id, onBack, onEdit, profile }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [workflow, setWorkflow] = useState(null);
  const [stages, setStages] = useState([]);

  useEffect(() => {
    fetchWorkflowDetails();
  }, [id]);

  async function fetchWorkflowDetails() {
    try {
      // Fetch workflow details using get_workflow_by_id RPC
      const { data: workflowData, error: workflowError } = await supabase
        .rpc('get_workflow_by_id', { workflow_uuid: id });

      if (workflowError) throw workflowError;
      setWorkflow(workflowData);

      // Fetch stages using get_workflow_stages RPC
      const { data: stagesData, error: stagesError } = await supabase
        .rpc('get_workflow_stages', { workflow_uuid: id });

      if (stagesError) throw stagesError;
      setStages(stagesData || []);
    } catch (err) {
      console.error('Error fetching workflow details:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="text-red-500">{error}</div>;
  if (!workflow) return <div>Workflow not found</div>;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Workflows
        </button>
        <button
          onClick={() => onEdit(id)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Edit className="w-4 h-4 mr-2" />
          Edit Workflow
        </button>
      </div>

      {/* Workflow Details */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <h1 className="text-2xl font-bold mb-2">{workflow.name}</h1>
        <p className="text-gray-600 mb-4">{workflow.description || 'No description'}</p>
        <div className="text-sm text-gray-500">
          <p>Created: {new Date(workflow.created_at).toLocaleString()}</p>
          <p>Last Updated: {new Date(workflow.updated_at).toLocaleString()}</p>
          <p>Status: {workflow.is_active ? 'Active' : 'Inactive'}</p>
        </div>
      </div>

      {/* Stages */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold mb-4">Workflow Stages</h2>
        <div className="space-y-4">
          {stages.map((stage, index) => (
            <div
              key={stage.id}
              className="border rounded-lg p-4 relative"
            >
              <div className="absolute -left-3 top-1/2 transform -translate-y-1/2 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm">
                {index + 1}
              </div>
              <h3 className="font-medium mb-2">{stage.name}</h3>
              <p className="text-gray-600 text-sm">{stage.description || 'No description'}</p>
              <div className="mt-2 flex gap-2">
                {stage.is_start && (
                  <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">Start</span>
                )}
                {stage.is_end && (
                  <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded">End</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

WorkflowDetail.propTypes = {
  id: PropTypes.string.isRequired,
  onBack: PropTypes.func.isRequired,
  onEdit: PropTypes.func.isRequired,
  profile: PropTypes.object.isRequired
}; 
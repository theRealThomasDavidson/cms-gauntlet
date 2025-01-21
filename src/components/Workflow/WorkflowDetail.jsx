import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Edit, ArrowLeft } from 'lucide-react';
import PropTypes from 'prop-types';

export default function WorkflowDetail({ id, onBack, onEdit }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [workflow, setWorkflow] = useState(null);
  const [stages, setStages] = useState([]);

  useEffect(() => {
    fetchWorkflow();
  }, [id]);

  async function fetchWorkflow() {
    try {
      console.log('Fetching workflow with ID:', id);
      
      // Fetch workflow details
      const { data: workflowData, error: workflowError } = await supabase
        .from('workflows')
        .select('*')
        .eq('id', id)
        .single();

      if (workflowError) {
        console.error('Error fetching workflow:', workflowError);
        throw workflowError;
      }
      console.log('Workflow data:', workflowData);
      setWorkflow(workflowData);

      // Fetch stages
      console.log('Fetching stages for workflow:', id);
      const { data: stagesData, error: stagesError } = await supabase
        .from('workflow_stages')
        .select('*')
        .eq('workflow_id', id)
        .order('created_at');

      if (stagesError) {
        console.error('Error fetching stages:', stagesError);
        throw stagesError;
      }
      console.log('Stages data:', stagesData);
      
      if (stagesData && Array.isArray(stagesData)) {
        setStages(stagesData);
      }
    } catch (err) {
      console.error('Error in fetchWorkflow:', err);
      setError('Error loading workflow');
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div>Loading workflow details...</div>;
  if (error) return <div className="text-red-500">{error}</div>;
  if (!workflow) return <div>Workflow not found</div>;

  return (
    <div className="p-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
            title="Back to workflows"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold">{workflow.name}</h1>
        </div>
        <button
          onClick={() => onEdit(id)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all"
        >
          <Edit size={16} />
          Edit Workflow
        </button>
      </div>

      {/* Workflow Info */}
      <div className="mb-8">
        <p className="text-gray-600">{workflow.description}</p>
        <div className="mt-2">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            workflow.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
          }`}>
            {workflow.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      {/* Stages */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Workflow Stages</h2>
        <div className="space-y-4">
          {stages.map((stage, index) => (
            <div 
              key={stage.id}
              className="bg-white p-4 rounded-lg shadow-sm border border-gray-200"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium text-lg">{stage.name}</h3>
                  <p className="text-gray-600 mt-1">{stage.description}</p>
                  <div className="flex gap-2 mt-2">
                    {stage.is_start && (
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm">
                        Start
                      </span>
                    )}
                    {stage.is_end && (
                      <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-sm">
                        End
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-sm text-gray-500">
                  Stage {index + 1} of {stages.length}
                </div>
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
  onEdit: PropTypes.func.isRequired
}; 
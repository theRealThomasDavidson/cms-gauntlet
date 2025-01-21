import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { Plus, Edit, Trash2, ArrowRight, ArrowLeft } from 'lucide-react';

export default function WorkflowDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [workflow, setWorkflow] = useState(null);
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchWorkflowAndStages();
  }, [id]);

  async function fetchWorkflowAndStages() {
    try {
      // Fetch workflow details
      const { data: workflowData, error: workflowError } = await supabase
        .from('workflows')
        .select('*')
        .eq('id', id)
        .single();

      if (workflowError) throw workflowError;
      setWorkflow(workflowData);

      // Fetch stages using our helper function
      const { data: stagesData, error: stagesError } = await supabase
        .rpc('get_workflow_stages', { workflow_uuid: id });

      if (stagesError) throw stagesError;
      setStages(stagesData || []);
    } catch (err) {
      setError('Error loading workflow details');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteStage(stageId) {
    if (!confirm('Are you sure you want to delete this stage?')) return;

    try {
      const { error } = await supabase
        .from('workflow_stages')
        .delete()
        .eq('id', stageId);

      if (error) throw error;
      await fetchWorkflowAndStages(); // Refresh stages
    } catch (err) {
      setError('Error deleting stage');
      console.error('Error:', err);
    }
  }

  if (loading) return <div>Loading workflow details...</div>;
  if (error) return <div className="text-red-500">{error}</div>;
  if (!workflow) return <div>Workflow not found</div>;

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">{workflow.name}</h1>
          <p className="text-gray-600">{workflow.description}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate(`/workflows/${id}/edit`)}
            className="flex items-center gap-2 bg-gray-100 px-4 py-2 rounded hover:bg-gray-200"
          >
            <Edit size={20} />
            Edit Workflow
          </button>
          <button
            onClick={() => navigate(`/workflows/${id}/stages/new`)}
            className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            <Plus size={20} />
            Add Stage
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Workflow Stages</h2>
        {stages.length === 0 ? (
          <p>No stages defined yet. Add your first stage!</p>
        ) : (
          <div className="flex flex-col gap-4">
            {stages.map((stage, index) => (
              <div
                key={stage.id}
                className="bg-white p-4 rounded-lg shadow flex items-center gap-4"
              >
                <div className="flex-1">
                  <h3 className="font-semibold">{stage.name}</h3>
                  <p className="text-gray-600">{stage.description}</p>
                  <div className="flex gap-2 mt-2 text-sm text-gray-500">
                    {stage.is_start && (
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded">
                        Start
                      </span>
                    )}
                    {stage.is_end && (
                      <span className="bg-red-100 text-red-800 px-2 py-1 rounded">
                        End
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {stage.prev_stage_id && (
                    <ArrowLeft size={20} className="text-gray-400" />
                  )}
                  {stage.next_stage_id && (
                    <ArrowRight size={20} className="text-gray-400" />
                  )}
                  <button
                    onClick={() => navigate(`/workflows/${id}/stages/${stage.id}/edit`)}
                    className="p-2 text-gray-500 hover:bg-gray-50 rounded"
                    title="Edit stage"
                  >
                    <Edit size={20} />
                  </button>
                  <button
                    onClick={() => handleDeleteStage(stage.id)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded"
                    title="Delete stage"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 
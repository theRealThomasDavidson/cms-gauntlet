import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Plus, Trash2, ArrowDown, ArrowUp } from 'lucide-react';
import PropTypes from 'prop-types';

export default function WorkflowForm({ id, onCancel }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [workflow, setWorkflow] = useState({
    name: '',
    description: '',
    is_active: true,
    org_id: null
  });
  const [stages, setStages] = useState([
    { 
      name: 'New Ticket',
      description: 'Initial stage when a ticket is created',
      is_start: true,
      is_end: false,
      is_other: false
    }
  ]);
  const [newStageName, setNewStageName] = useState('');
  const [newStageDesc, setNewStageDesc] = useState('');

  useEffect(() => {
    if (id) {
      fetchWorkflow();
    }
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
        .from('workflow_stages')  // Try direct table query instead of RPC
        .select('*')
        .eq('workflow_id', id)
        .order('created_at');

      if (stagesError) {
        console.error('Error fetching stages:', stagesError);
        throw stagesError;
      }
      console.log('Stages data:', stagesData);
      
      if (stagesData) {
        if (Array.isArray(stagesData) && stagesData.length > 0) {
          setStages(stagesData);
        } else {
          console.log('No stages found or invalid data format:', stagesData);
        }
      }
    } catch (err) {
      console.error('Error in fetchWorkflow:', err);
      setError('Error loading workflow');
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Get current user session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session) throw new Error('No active session');

      // Get user's org_id at save time
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, org_id')
        .eq('auth_id', session.user.id)
        .single();
      
      if (profileError) throw profileError;
      if (!profile?.org_id) throw new Error('User not associated with an organization');

      let workflowId = id;
      
      // Create or update workflow
      if (id) {
        const { error } = await supabase
          .from('workflows')
          .update({
            name: workflow.name,
            description: workflow.description,
            is_active: workflow.is_active,
            updated_at: new Date().toISOString()
          })
          .eq('id', id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('workflows')
          .insert([{
            name: workflow.name,
            description: workflow.description,
            is_active: workflow.is_active,
            org_id: profile.org_id,
            created_by: profile.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }])
          .select();
        if (error) throw error;
        if (!data?.[0]?.id) throw new Error('No workflow ID returned');
        workflowId = data[0].id;
      }

      // First create/update all stages without links
      const updatedStages = [];
      for (let i = 0; i < stages.length; i++) {
        const stage = stages[i];
        const stageData = {
          workflow_id: workflowId,
          name: stage.name,
          description: stage.description,
          is_start: i === 0,
          is_end: i === stages.length - 1,
          is_other: false
        };

        if (stage.id) {
          const { data, error } = await supabase
            .from('workflow_stages')
            .update(stageData)
            .eq('id', stage.id)
            .select();
          if (error) throw error;
          updatedStages.push(data[0]);
        } else {
          const { data, error } = await supabase
            .from('workflow_stages')
            .insert([stageData])
            .select();
          if (error) throw error;
          updatedStages.push(data[0]);
        }
      }

      // Now update the links
      for (let i = 0; i < updatedStages.length; i++) {
        const stage = updatedStages[i];
        const nextStage = updatedStages[i + 1];
        const prevStage = updatedStages[i - 1];

        console.log(`Updating stage ${stage.name} (${stage.id}):`, {
          next: nextStage?.name,
          next_id: nextStage?.id,
          prev: prevStage?.name,
          prev_id: prevStage?.id
        });

        const { error } = await supabase
          .from('workflow_stages')
          .update({
            next_stage_id: nextStage?.id || null,
            prev_stage_id: prevStage?.id || null
          })
          .eq('id', stage.id);
        
        if (error) {
          console.error('Error updating stage links:', error);
          throw error;
        }
      }

      onCancel(); // Go back to list view
    } catch (err) {
      console.error('Error:', err);
      setError(err.message || 'Error saving workflow');
    } finally {
      setLoading(false);
    }
  }

  function handleAddStage() {
    if (!newStageName.trim()) return;

    setStages([
      ...stages,
      {
        name: newStageName,
        description: newStageDesc,
        is_start: false,
        is_end: false,
        is_other: false
      }
    ]);

    setNewStageName('');
    setNewStageDesc('');
  }

  function handleRemoveStage(index) {
    if (index === 0) return; // Can't remove first stage
    setStages(stages.filter((_, i) => i !== index));
  }

  function handleMoveStage(index, direction) {
    if (
      (index === 0 && direction === -1) || 
      (index === stages.length - 1 && direction === 1)
    ) return;

    const newStages = [...stages];
    const temp = newStages[index];
    newStages[index] = newStages[index + direction];
    newStages[index + direction] = temp;
    setStages(newStages);
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">
          {id ? 'Edit Workflow' : 'Create New Workflow'}
        </h1>
        <div className="flex gap-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-3 text-gray-700 bg-gray-100 rounded-lg font-semibold hover:bg-gray-200 transition-all shadow-md border border-gray-200 m-1"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="workflow-form"
            disabled={loading}
            className="px-6 py-3 text-white bg-blue-600 rounded-lg font-semibold hover:bg-blue-700 transition-all shadow-lg border border-blue-700 m-1 disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Workflow'}
          </button>
        </div>
      </div>

      <form id="workflow-form" onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Name</label>
            <input
              type="text"
              value={workflow.name}
              onChange={(e) => setWorkflow({ ...workflow, name: e.target.value })}
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={workflow.description || ''}
              onChange={(e) => setWorkflow({ ...workflow, description: e.target.value })}
              rows={3}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              checked={workflow.is_active}
              onChange={(e) => setWorkflow({ ...workflow, is_active: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label className="ml-2 block text-sm text-gray-900">Active</label>
          </div>
        </div>

        <div className="border-t pt-6">
          <h2 className="text-lg font-semibold mb-4">Workflow Stages</h2>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 border border-gray-200">
              <tbody className="bg-white divide-y divide-gray-200">
                {stages.map((stage, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td colSpan={6} className="px-3 py-4">
                      <div style={{ border: '2px solid #fbcfe8', backgroundColor: '#fdf2f8', padding: '12px', borderRadius: '6px', boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)' }}>
                        <div className="space-y-3">
                          <div className="flex flex-col space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center">
                                <div className="font-medium text-gray-900 text-lg">{stage.name}</div>
                                {index === 0 && (
                                  <span className="ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                    Start
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  className="px-3 py-1 bg-gray-50 text-blue-600 hover:bg-blue-50 rounded-lg transition-all text-sm border border-gray-200 m-1"
                                >
                                  Configure Hooks
                                </button>
                                {index > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => handleMoveStage(index, -1)}
                                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-all border border-gray-200 m-1"
                                  >
                                    <ArrowUp size={16} />
                                  </button>
                                )}
                                {index > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveStage(index)}
                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all border border-gray-200 m-1"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                )}
                                {index < stages.length - 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleMoveStage(index, 1)}
                                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-all border border-gray-200 m-1"
                                  >
                                    <ArrowDown size={16} />
                                  </button>
                                )}
                              </div>
                            </div>
                            <textarea
                              value={stage.description}
                              onChange={(e) => {
                                const newStages = [...stages];
                                newStages[index].description = e.target.value;
                                setStages(newStages);
                              }}
                              rows={2}
                              className="w-full text-sm text-gray-500 bg-white rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-4 p-4 border border-yellow-300 rounded-lg bg-yellow-50">
              <div className="space-y-3  border-yellow-300 ">
                <input
                  type="text"
                  value={newStageName}
                  onChange={(e) => setNewStageName(e.target.value)}
                  placeholder="New stage name"
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
                <br/>
                <textarea 
                  value={newStageDesc}
                  onChange={(e) => setNewStageDesc(e.target.value)}
                  placeholder="Stage description (optional)"
                  rows={5}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
                <br/>
                <button
                  type="button"
                  onClick={handleAddStage}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 text-white bg-blue-600 rounded-lg font-semibold hover:bg-blue-700 transition-all shadow-lg border border-blue-700 m-1"
                >
                  <Plus size={16} />
                  Add Stage
                </button>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="text-red-500 text-sm">{error}</div>
        )}
      </form>
    </div>
  );
}

WorkflowForm.propTypes = {
  id: PropTypes.string,
  onCancel: PropTypes.func.isRequired
}; 
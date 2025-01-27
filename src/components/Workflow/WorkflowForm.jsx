import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Plus, Trash2, X, ChevronDown, ChevronUp } from 'lucide-react';
import PropTypes from 'prop-types';
import StageHookForm from './StageHookForm';

export default function WorkflowForm({ id, onCancel, profile }) {
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
  const [selectedStage, setSelectedStage] = useState(null);
  const [showHookModal, setShowHookModal] = useState(false);
  const [stageHooks, setStageHooks] = useState({});
  const [expandedStage, setExpandedStage] = useState(null);
  const [userNames, setUserNames] = useState({});

  useEffect(() => {
    if (id) {
      fetchWorkflow();
    }
  }, [id]);

  async function fetchWorkflow() {
    try {
      console.log('Fetching workflow with ID:', id);
      
      // Fetch workflow details using RPC
      const { data: workflowData, error: workflowError } = await supabase
        .rpc('get_workflow_by_id', { workflow_uuid: id });

      if (workflowError) {
        console.error('Error fetching workflow:', workflowError);
        throw workflowError;
      }

      console.log('Raw workflow data:', workflowData);
      
      // Handle both single object and array responses
      const workflowDetails = Array.isArray(workflowData) ? workflowData[0] : workflowData;
      
      if (!workflowDetails) {
        throw new Error('No workflow found');
      }

      console.log('Setting workflow state to:', workflowDetails);
      setWorkflow({
        name: workflowDetails.name || '',
        description: workflowDetails.description || '',
        is_active: workflowDetails.is_active ?? true,
        org_id: workflowDetails.org_id
      });

      // Fetch stages using RPC
      console.log('Fetching stages for workflow:', id);
      const { data: stagesData, error: stagesError } = await supabase
        .rpc('get_workflow_stages', { workflow_uuid: id });

      if (stagesError) {
        console.error('Error fetching stages:', stagesError);
        throw stagesError;
      }
      console.log('Stages data:', stagesData);
      
      if (stagesData && Array.isArray(stagesData) && stagesData.length > 0) {
        // Order stages based on linked list structure
        const orderedStages = [];
        const stagesMap = new Map(stagesData.map(stage => [stage.id, stage]));
        
        // Find the start stage
        let currentStage = stagesData.find(stage => stage.is_start);
        
        // Build the ordered list by following next_stage_id
        while (currentStage) {
          orderedStages.push(currentStage);
          currentStage = currentStage.next_stage_id ? stagesMap.get(currentStage.next_stage_id) : null;
        }

        // Verify we got all stages
        if (orderedStages.length !== stagesData.length) {
          console.warn('Some stages were not included in the ordered list');
          // Fall back to original array if there's an issue with the linked list
          setStages(stagesData);
        } else {
          setStages(orderedStages);
        }
      } else {
        console.log('No stages found or invalid data format:', stagesData);
      }
    } catch (err) {
      console.error('Error in fetchWorkflow:', err);
      setError('Error loading workflow');
    }
  }

  async function fetchUserName(userId) {
    try {
      const { data, error } = await supabase
        .rpc('get_profile_by_id', { p_profile_id: userId });

      if (error) throw error;
      
      if (data && data.length > 0) {
        setUserNames(prev => ({
          ...prev,
          [userId]: data[0].name
        }));
      }
    } catch (err) {
      console.error('Error fetching user name:', err);
    }
  }

  async function fetchStageHooks(stageId) {
    try {
      console.log('Fetching webhooks for stage:', stageId);
      const { data, error } = await supabase
        .rpc('get_stage_webhooks', { stage_uuid: stageId });

      if (error) throw error;
      
      console.log('Webhook data received:', data);
      if (!data || data.length === 0) {
        console.log('No webhooks found for stage');
      }
      
      // Fetch usernames for any specific user notifications
      if (data) {
        data.forEach(hook => {
          if (hook.config.target_type === 'specific_user' && hook.config.target_user_id) {
            fetchUserName(hook.config.target_user_id);
          }
        });
      }
      
      setStageHooks(prev => ({
        ...prev,
        [stageId]: data || []
      }));
    } catch (err) {
      console.error('Error fetching stage webhooks:', err);
    }
  }

  function toggleHookList(stageId) {
    if (expandedStage === stageId) {
      setExpandedStage(null);
    } else {
      setExpandedStage(stageId);
      fetchStageHooks(stageId);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      console.log('Starting workflow submission...');
      let workflowId = id;
      
      // Create or update workflow
      if (id) {
        console.log('Updating existing workflow...');
        let { data, error } = await supabase
          .rpc('update_workflow', {
            p_id: id,
            p_name: workflow.name,
            p_description: workflow.description,
            p_is_active: workflow.is_active
          });
        if (error) throw error;
        console.log('Workflow updated successfully');
      } else {
        console.log('Creating new workflow...');
        let { data, error } = await supabase
          .rpc('create_workflow', {
            p_auth_id: profile.auth_id,
            p_description: workflow.description,
            p_name: workflow.name
          });
        if (error) throw error;
        else {
          workflowId = data.id;
          console.log('New workflow created with ID:', workflowId);
        }
      }

      // First create/update all stages without links
      console.log('Creating/updating stages...');
      const updatedStages = [];
      for (let i = 0; i < stages.length; i++) {
        const stage = stages[i];
        console.log(`Processing stage ${i + 1}/${stages.length}: ${stage.name}`);
        
        if (stage.id) {
          console.log('Updating existing stage:', stage.id);
          let { data, error } = await supabase
            .rpc('update_workflow_stage', {
              p_id: stage.id,
              p_name: stage.name,
              p_description: stage.description,
              p_is_start: i === 0,
              p_is_end: i === stages.length - 1,
              p_is_other: false,
              p_next_stage_id: null,
              p_prev_stage_id: null,
              p_org_id: profile.org_id,
              p_role: profile.role
            });
          if (error) {
            console.error('Error updating stage:', error);
            throw error;
          }
          updatedStages.push(data);
          console.log('Stage updated successfully');
        } else {
          console.log('Creating new stage for workflow:', workflowId);
          let { data, error } = await supabase
            .rpc('create_workflow_stage', {
              p_workflow_id: workflowId,
              p_name: stage.name,
              p_description: stage.description,
              p_is_start: i === 0,
              p_is_end: i === stages.length - 1,
              p_is_other: false
            });
          if (error) {
            console.error('Error creating stage:', error);
            throw error;
          }
          updatedStages.push(data);
          console.log('New stage created successfully');
        }
      }

      // Now update the links
      console.log('Updating stage links...');
      for (let i = 0; i < updatedStages.length; i++) {
        const stage = updatedStages[i];
        const nextStage = updatedStages[i + 1];
        const prevStage = updatedStages[i - 1];

        console.log(`Updating links for stage ${i + 1}/${updatedStages.length}`);
        let { error } = await supabase
          .rpc('update_workflow_stage_links', {
            p_stage_id: stage.id,
            p_next_stage_id: nextStage?.id || null,
            p_prev_stage_id: prevStage?.id || null
          });
        
        if (error) {
          console.error('Error updating stage links:', error);
          throw error;
        }
        console.log('Stage links updated successfully');
      }

      console.log('Workflow saved successfully!');
      onCancel(); // Go back to list view
    } catch (err) {
      console.error('Error saving workflow:', err);
      setError(err.message || 'An unexpected error occurred');
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

  async function handleRemoveStage(index) {
    const stage = stages[index];
    if (!stage.id) {
      // Stage hasn't been saved yet, just remove from state
      setStages(stages.filter((_, i) => i !== index));
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase
        .rpc('delete_workflow_stage', {
          p_stage_id: stage.id,
          p_org_id: profile.org_id,
          p_role: profile.role
        });

      if (error) throw error;

      // Remove from local state if delete was successful
      setStages(stages.filter((_, i) => i !== index));
    } catch (err) {
      console.error('Error deleting stage:', err);
      setError(err.message || 'Error deleting stage');
    } finally {
      setLoading(false);
    }
  }

  function handleConfigureHooks(stage) {
    setSelectedStage(stage);
    setShowHookModal(true);
  }

  function handleSaveHook() {
    setShowHookModal(false);
    setSelectedStage(null);
  }

  async function handleDeleteHook(hookId, stageId) {
    try {
      const { error } = await supabase
        .rpc('delete_workflow_stage_hook', {
          p_id: hookId
        });

      if (error) throw error;

      // Refresh the hooks list for this stage
      fetchStageHooks(stageId);
    } catch (err) {
      console.error('Error deleting hook:', err);
      setError('Failed to delete notification');
    }
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
                                  onClick={() => handleConfigureHooks(stage)}
                                  disabled={!stage.id}
                                  className="px-3 py-1 bg-gray-50 text-blue-600 hover:bg-blue-50 rounded-lg transition-all text-sm border border-gray-200 m-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Configure Hooks
                                </button>
                                {index > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveStage(index)}
                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all border border-gray-200 m-1"
                                  >
                                    <Trash2 size={16} />
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
                            
                            {stage.id && (
                              <div className="mt-2">
                                <button
                                  type="button"
                                  onClick={() => toggleHookList(stage.id)}
                                  className="flex items-center text-sm text-gray-600 hover:text-gray-800"
                                >
                                  {expandedStage === stage.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                  <span className="ml-1">View Notifications</span>
                                </button>
                                
                                {expandedStage === stage.id && (
                                  <div className="mt-2 space-y-2">
                                    {stageHooks[stage.id]?.length > 0 ? (
                                      stageHooks[stage.id].map(hook => (
                                        <div key={hook.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                          <div className="flex flex-col">
                                            <span className="font-medium">
                                              Notify: {hook.config.target_type === 'specific_user' ? 
                                                      (userNames[hook.config.target_user_id] || 'Loading...') :
                                                      hook.config.target_type === 'role' ? `All ${hook.config.target_role}s` :
                                                      hook.config.target_type === 'ticket_creator' ? 'Ticket Creator' : 
                                                      'Organization Admins'}
                                            </span>
                                            <span className="text-sm text-gray-600">
                                              Message: {hook.config.message}
                                            </span>
                                          </div>
                                          <button
                                            type="button"
                                            className="text-sm text-red-600 hover:text-red-800"
                                            onClick={() => handleDeleteHook(hook.id, stage.id)}
                                          >
                                            Delete
                                          </button>
                                        </div>
                                      ))
                                    ) : (
                                      <div className="text-sm text-gray-500 italic">
                                        No notifications configured for this stage
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
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

      {showHookModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Configure Stage Hooks</h2>
              <button
                type="button"
                onClick={() => setShowHookModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>
            <StageHookForm
              stageId={selectedStage?.id}
              onSave={handleSaveHook}
              onCancel={() => setShowHookModal(false)}
              profile={profile}
            />
          </div>
        </div>
      )}
    </div>
  );
}

WorkflowForm.propTypes = {
  id: PropTypes.string,
  onCancel: PropTypes.func.isRequired,
  profile: PropTypes.object.isRequired
}; 
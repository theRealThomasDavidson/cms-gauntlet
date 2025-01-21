import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Plus, Edit, Trash2, ArrowRight } from 'lucide-react';
import PropTypes from 'prop-types';

export default function WorkflowList({ onCreateWorkflow, onEditWorkflow, onViewWorkflow }) {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchWorkflows();
  }, []);

  async function fetchWorkflows() {
    try {
      const { data, error } = await supabase
        .from('workflows')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWorkflows(data);
    } catch (err) {
      setError('Error loading workflows');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Are you sure you want to delete this workflow?')) return;

    try {
      const { error } = await supabase
        .from('workflows')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setWorkflows(workflows.filter(w => w.id !== id));
    } catch (err) {
      setError('Error deleting workflow');
      console.error('Error:', err);
    }
  }

  if (loading) return <div>Loading workflows...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Workflows</h1>
        <button
          onClick={onCreateWorkflow}
          className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold shadow-lg hover:bg-blue-700 transition-all"
        >
          <Plus size={20} />
          New Workflow
        </button>
      </div>

      <div className="grid gap-4">
        {workflows.length === 0 ? (
          <p>No workflows found. Create your first one!</p>
        ) : (
          workflows.map(workflow => (
            <div
              key={workflow.id}
              className="bg-white p-4 rounded-lg shadow flex justify-between items-center"
            >
              <div>
                <h2 className="text-xl font-semibold">{workflow.name}</h2>
                <p className="text-gray-600">{workflow.description}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onViewWorkflow(workflow.id)}
                  className="p-3 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                  title="View workflow"
                >
                  <ArrowRight size={20} />
                </button>
                <button
                  onClick={() => onEditWorkflow(workflow.id)}
                  className="p-3 text-gray-600 hover:bg-gray-50 rounded-lg transition-all"
                  title="Edit workflow"
                >
                  <Edit size={20} />
                </button>
                <button
                  onClick={() => handleDelete(workflow.id)}
                  className="p-3 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                  title="Delete workflow"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

WorkflowList.propTypes = {
  onCreateWorkflow: PropTypes.func.isRequired,
  onEditWorkflow: PropTypes.func.isRequired,
  onViewWorkflow: PropTypes.func.isRequired
}; 
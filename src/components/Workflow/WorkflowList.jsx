import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { Plus, Edit, Trash2, ArrowRight } from 'lucide-react';

export default function WorkflowList() {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

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
          onClick={() => navigate('/workflows/new')}
          className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
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
                  onClick={() => navigate(`/workflows/${workflow.id}`)}
                  className="p-2 text-blue-500 hover:bg-blue-50 rounded"
                  title="View workflow"
                >
                  <ArrowRight size={20} />
                </button>
                <button
                  onClick={() => navigate(`/workflows/${workflow.id}/edit`)}
                  className="p-2 text-gray-500 hover:bg-gray-50 rounded"
                  title="Edit workflow"
                >
                  <Edit size={20} />
                </button>
                <button
                  onClick={() => handleDelete(workflow.id)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded"
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
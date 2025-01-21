import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

export default function WorkflowForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [workflow, setWorkflow] = useState({
    name: '',
    description: '',
    is_active: true
  });

  useEffect(() => {
    if (id) {
      fetchWorkflow();
    }
  }, [id]);

  async function fetchWorkflow() {
    try {
      const { data, error } = await supabase
        .from('workflows')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setWorkflow(data);
    } catch (err) {
      setError('Error loading workflow');
      console.error('Error:', err);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let result;
      if (id) {
        // Update existing workflow
        result = await supabase
          .from('workflows')
          .update(workflow)
          .eq('id', id);
      } else {
        // Create new workflow
        result = await supabase
          .from('workflows')
          .insert([workflow]);
      }

      if (result.error) throw result.error;
      navigate('/workflows');
    } catch (err) {
      setError('Error saving workflow');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setWorkflow(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">
        {id ? 'Edit Workflow' : 'Create New Workflow'}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Name
          </label>
          <input
            type="text"
            name="name"
            value={workflow.name}
            onChange={handleChange}
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Description
          </label>
          <textarea
            name="description"
            value={workflow.description || ''}
            onChange={handleChange}
            rows={3}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            name="is_active"
            checked={workflow.is_active}
            onChange={handleChange}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <label className="ml-2 block text-sm text-gray-900">
            Active
          </label>
        </div>

        {error && (
          <div className="text-red-500 text-sm">{error}</div>
        )}

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Workflow'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/workflows')}
            className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
} 
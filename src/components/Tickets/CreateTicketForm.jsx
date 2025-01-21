import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { createTicket, getActiveWorkflows } from '../../lib/ticketService';
import { useAuth } from '../../hooks/useAuth';

export default function CreateTicketForm({ onClose, onCreated }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [workflows, setWorkflows] = useState([]);
  const { isAgent } = useAuth();
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'low',
    workflowId: ''
  });

  useEffect(() => {
    if (isAgent) {
      loadWorkflows();
    }
  }, [isAgent]);

  async function loadWorkflows() {
    try {
      const { data: workflows, error } = await getActiveWorkflows();
      if (error) throw error;
      
      setWorkflows(workflows);
      
      // Set default workflow to the first one
      if (workflows.length > 0) {
        setFormData(prev => ({ ...prev, workflowId: workflows[0].id }));
      }
    } catch (err) {
      console.error('Error loading workflows:', err);
      setError('Failed to load workflows');
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await createTicket(formData);
      if (result.error) throw result.error;
      onCreated();
    } catch (err) {
      console.error('Error creating ticket:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
        <h2 className="text-2xl font-bold mb-4">Create New Ticket</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Priority</label>
            <select
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          {isAgent && workflows.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Workflow</label>
              <select
                value={formData.workflowId}
                onChange={(e) => setFormData({ ...formData, workflowId: e.target.value })}
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                {workflows.map(workflow => (
                  <option key={workflow.id} value={workflow.id}>
                    {workflow.name}
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
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

CreateTicketForm.propTypes = {
  onClose: PropTypes.func.isRequired,
  onCreated: PropTypes.func.isRequired
}; 
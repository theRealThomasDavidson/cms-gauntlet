import { useState, useEffect } from 'react';
import { Plus, ArrowRight, Workflow } from 'lucide-react';
import { fetchTicketsDirect, createTicket } from '../../lib/ticketService';
import AssignWorkflowModal from './AssignWorkflowModal';

export default function TicketsView() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(0);

  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showWorkflowModal, setShowWorkflowModal] = useState(false);

  useEffect(() => {
    loadTickets();
  }, [page]);

  async function loadTickets() {
    try {
      setLoading(true);
      const { data, error, pagination } = await fetchTicketsDirect({
        page,
        pageSize
      });

      if (error) throw error;
      setTickets(data || []);
      setTotalPages(pagination.totalPages);
    } catch (err) {
      console.error('Error fetching tickets:', err);
      setError('Failed to load tickets');
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div>Loading tickets...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Tickets</h1>
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold shadow-lg hover:bg-blue-700 transition-all"
        >
          <Plus size={20} />
          New Ticket
        </button>
      </div>

      {showCreateForm && (
        <CreateTicketForm
          onClose={() => setShowCreateForm(false)}
          onCreated={() => {
            setShowCreateForm(false);
            loadTickets();
          }}
        />
      )}

      <div className="grid gap-4">
        {tickets.length === 0 ? (
          <p>No tickets found. Create your first one!</p>
        ) : (
          tickets.map(ticket => (
            <div
              key={ticket.id}
              className="bg-white p-4 rounded-lg shadow flex justify-between items-center hover:bg-gray-50 transition-all"
            >
              <div className="flex-grow">
                <h2 className="text-lg font-semibold">{ticket.title}</h2>
                <div className="flex gap-4 text-sm text-gray-600 mt-1">
                  <span>{ticket.stage_name || 'No Workflow'}</span>
                  <span>•</span>
                  <span>{ticket.assigned_to_name || 'Unassigned'}</span>
                </div>
              </div>
              <div className="flex gap-2">
                {!ticket.workflow_id && (
                  <button
                    onClick={() => {
                      setSelectedTicket(ticket);
                      setShowWorkflowModal(true);
                    }}
                    className="p-3 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                    title="Assign workflow"
                  >
                    <Workflow size={20} />
                  </button>
                )}
                <button
                  onClick={() => {/* TODO: Navigate to TicketDetails */}}
                  className="p-3 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                  title="View ticket details"
                >
                  <ArrowRight size={20} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {showWorkflowModal && selectedTicket && (
        <AssignWorkflowModal
          ticket={selectedTicket}
          onClose={() => {
            setShowWorkflowModal(false);
            setSelectedTicket(null);
          }}
          onAssigned={() => {
            setShowWorkflowModal(false);
            setSelectedTicket(null);
            loadTickets();
          }}
        />
      )}
    </div>
  );
}

function CreateTicketForm({ onClose, onCreated }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'low'
  });

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
      setError(err.message || 'Failed to create ticket');
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
              className="px-4 py-2 text-white bg-blue-600 rounded-lg font-semibold hover:bg-blue-700 transition-all disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function getStatusColor(status) {
  const colors = {
    new: 'bg-blue-100 text-blue-800',
    open: 'bg-yellow-100 text-yellow-800',
    pending: 'bg-purple-100 text-purple-800',
    resolved: 'bg-green-100 text-green-800',
    closed: 'bg-gray-100 text-gray-800'
  };
  return colors[status] || colors.new;
}

function getPriorityColor(priority) {
  const colors = {
    low: 'bg-gray-100 text-gray-800',
    medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-orange-100 text-orange-800',
    urgent: 'bg-red-100 text-red-800'
  };
  return colors[priority] || colors.low;
} 
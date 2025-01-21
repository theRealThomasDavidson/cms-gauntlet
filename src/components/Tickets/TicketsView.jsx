import { useState, useEffect } from 'react';
import { Plus, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

export default function TicketsView() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    fetchTickets();
  }, []);

  async function fetchTickets() {
    try {
      const { data: ticketsData, error: ticketsError } = await supabase
        .from('tickets')
        .select(`
          id,
          latest_history_id,
          created_at,
          created_by,
          ticket_history!inner (
            title,
            description,
            status,
            priority,
            assigned_to
          )
        `)
        .order('created_at', { ascending: false });

      if (ticketsError) throw ticketsError;
      setTickets(ticketsData || []);
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
            fetchTickets();
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
              className="bg-white p-4 rounded-lg shadow flex justify-between items-center"
            >
              <div>
                <h2 className="text-xl font-semibold">{ticket.ticket_history.title}</h2>
                <p className="text-gray-600">{ticket.ticket_history.description}</p>
                <div className="flex gap-2 mt-2">
                  <span className={`px-2 py-1 rounded text-sm ${
                    getStatusColor(ticket.ticket_history.status)
                  }`}>
                    {ticket.ticket_history.status}
                  </span>
                  <span className={`px-2 py-1 rounded text-sm ${
                    getPriorityColor(ticket.ticket_history.priority)
                  }`}>
                    {ticket.ticket_history.priority}
                  </span>
                </div>
              </div>
              <button
                onClick={() => {/* TODO: View ticket details */}}
                className="p-3 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                title="View ticket details"
              >
                <ArrowRight size={20} />
              </button>
            </div>
          ))
        )}
      </div>
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
      // Get current user's profile
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, org_id')
        .eq('auth_id', session.user.id)
        .single();
      
      if (profileError) throw profileError;

      // Get the earliest active workflow for the org
      const { data: workflow, error: workflowError } = await supabase
        .from('workflows')
        .select('id')
        .eq('org_id', profile.org_id)
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

      if (workflowError) throw workflowError;

      // Get the start stage of the workflow
      const { data: startStage, error: stageError } = await supabase
        .from('workflow_stages')
        .select('id')
        .eq('workflow_id', workflow.id)
        .eq('is_start', true)
        .single();

      if (stageError) throw stageError;

      // Create the ticket
      const { data: ticket, error: ticketError } = await supabase
        .from('tickets')
        .insert([{
          created_by: profile.id
        }])
        .select()
        .single();

      if (ticketError) throw ticketError;

      // Create initial ticket history
      const { error: historyError } = await supabase
        .from('ticket_history')
        .insert([{
          ticket_id: ticket.id,
          title: formData.title,
          description: formData.description,
          status: 'new',
          priority: formData.priority,
          changed_by: profile.id,
          changes: {
            title: { old: null, new: formData.title },
            description: { old: null, new: formData.description },
            status: { old: null, new: 'new' },
            priority: { old: null, new: formData.priority }
          },
          workflow_stage_id: startStage.id
        }]);

      if (historyError) throw historyError;

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
import { useState, useEffect } from 'react';
import { Plus, ArrowRight, Workflow } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import AssignWorkflowModal from './AssignWorkflowModal';
import AssignedUserDisplay from './AssignedUserDisplay';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import TicketDetail from './TicketDetail';
import MyTickets from './MyTickets';

export default function TicketsView({ profile }) {
  const navigate = useNavigate();
  console.log('Current profile:', profile);
  console.log('User role:', profile?.role);
  
  const [unassignedTickets, setUnassignedTickets] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [workflowTickets, setWorkflowTickets] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showWorkflowModal, setShowWorkflowModal] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState(null);

  useEffect(() => {
    loadData();
  }, [profile?.org_id]);

  async function loadData() {
    if (!profile?.org_id) return;
    
    try {
      setLoading(true);
      setError(null);

      // Only fetch unassigned tickets if user is admin or agent
      if (profile.role === 'admin' || profile.role === 'agent') {
        const { data: unassigned, error: unassignedError } = await supabase
          .rpc('get_unassigned_tickets', {
            p_org_id: profile.org_id
          });

        if (unassignedError) throw unassignedError;
        setUnassignedTickets(unassigned || []);

        // Fetch agent tickets
        const { data: agentTickets, error: agentError } = await supabase
          .rpc('get_agent_tickets', {
            p_org_id: profile.org_id
          });

        if (agentError) throw agentError;

        // Group tickets by workflow
        const ticketsByWorkflow = {};
        for (const ticket of agentTickets || []) {
          if (ticket.workflow_id) {
            if (!ticketsByWorkflow[ticket.workflow_id]) {
              ticketsByWorkflow[ticket.workflow_id] = [];
            }
            ticketsByWorkflow[ticket.workflow_id].push(ticket);
          }
        }
        setWorkflowTickets(ticketsByWorkflow);
      } else {
        // For customers, fetch only their tickets
        const { data: customerTickets, error: customerError } = await supabase
          .rpc('get_customer_tickets');

        if (customerError) throw customerError;

        // Group customer tickets by workflow
        const ticketsByWorkflow = {};
        for (const ticket of customerTickets || []) {
          if (ticket.workflow_id) {
            if (!ticketsByWorkflow[ticket.workflow_id]) {
              ticketsByWorkflow[ticket.workflow_id] = [];
            }
            ticketsByWorkflow[ticket.workflow_id].push(ticket);
          }
        }
        setWorkflowTickets(ticketsByWorkflow);
      }

      // Fetch active workflows
      const { data: activeWorkflows, error: workflowsError } = await supabase
        .rpc('get_active_workflows');

      if (workflowsError) throw workflowsError;
      setWorkflows(activeWorkflows || []);

    } catch (err) {
      console.error('Error loading tickets:', err);
      setError(err.message || 'Failed to load tickets');
    } finally {
      setLoading(false);
    }
  }

  function renderTicketList(tickets, showWorkflowButton = true) {
    return tickets.map(ticket => (
      <div
        key={ticket.id}
        className="bg-white p-4 rounded-lg shadow flex justify-between items-center hover:bg-gray-50 transition-all"
      >
        <div className="flex-grow">
          <div className="flex gap-4 text-sm text-gray-600 mt-1">
            <span>{ticket?.title || 'Untitled Ticket'}</span>
            <span>{ticket?.stage_name || 'No Workflow'}</span>
            <span>•</span>
            <AssignedUserDisplay userId={ticket.assigned_to} />
          </div>
        </div>
        <div className="flex gap-2">
          {showWorkflowButton && !ticket.workflow_id && (
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
            onClick={() => setSelectedTicketId(ticket.id)}
            className="p-3 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
            title="View ticket details"
          >
            <ArrowRight size={20} />
          </button>
        </div>
      </div>
    ));
  }

  if (selectedTicketId) {
    return (
      <TicketDetail 
        ticketId={selectedTicketId} 
        onBack={() => setSelectedTicketId(null)}
      />
    );
  }

  if (loading) return <div>Loading tickets...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Tickets</h1>
        
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold shadow-lg hover:bg-blue-700 transition-all"
          >
            <Plus size={20} />
            New Ticket
          </button>
        </div>
      </div>

      {showCreateForm && (
        <CreateTicketForm
          profile={profile}
          onClose={() => setShowCreateForm(false)}
          onCreated={() => {
            setShowCreateForm(false);
            loadData();
          }}
        />
      )}

      {/* Unassigned Tickets Section - Only show for admin/agent */}
      {(profile.role === 'admin' || profile.role === 'agent') && (
        <div className="mb-8 border border-gray-200 rounded-lg p-6 bg-white shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Unassigned Tickets</h2>
          <div className="grid gap-4">
            {unassignedTickets.length === 0 ? (
              <p className="text-gray-500 italic">No unassigned tickets</p>
            ) : renderTicketList(unassignedTickets)}
          </div>
        </div>
      )}

      {/* Workflow Sections */}
      {(profile.role === 'admin' || profile.role === 'agent') &&
        workflows.map(workflow => (
          <div key={workflow.id} className="mb-8 border border-gray-200 rounded-lg p-6 bg-white shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">{workflow.name}</h2>
              <button
                onClick={() => navigate(`/workflows/${workflow.id}/kanban`)}
                className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all flex items-center gap-2"
              >
                <ArrowRight size={20} />
                View Kanban
              </button>
            </div>
            <div className="grid gap-4">
              {workflowTickets[workflow.id]?.length === 0 ? (
                <p className="text-gray-500 italic">No tickets in this workflow</p>
              ) : renderTicketList(workflowTickets[workflow.id] || [], false)}
            </div>
          </div>
        ))}

      {/* My Tickets Section - Show for all users */}
      <div className="mb-8 border border-gray-200 rounded-lg p-6 bg-white shadow-sm">
        <MyTickets onSelectTicket={setSelectedTicketId} />
      </div>

      {showWorkflowModal && selectedTicket && (
        <AssignWorkflowModal
          ticket={selectedTicket}
          profile={profile}
          onClose={() => {
            setShowWorkflowModal(false);
            setSelectedTicket(null);
          }}
          onAssigned={() => {
            setShowWorkflowModal(false);
            setSelectedTicket(null);
            loadData();
          }}
        />
      )}
    </div>
  );
}

TicketsView.propTypes = {
  profile: PropTypes.shape({
    org_id: PropTypes.string.isRequired,
    role: PropTypes.string.isRequired
  }).isRequired
};

function CreateTicketForm({ onClose, onCreated, profile }) {
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
      const { error } = await supabase.rpc('create_ticket', {
        p_title: formData.title,
        p_description: formData.description,
        p_priority: formData.priority,
        p_org_id: profile.org_id
      });
      
      if (error) throw error;
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

CreateTicketForm.propTypes = {
  onClose: PropTypes.func.isRequired,
  onCreated: PropTypes.func.isRequired,
  profile: PropTypes.shape({
    org_id: PropTypes.string.isRequired
  }).isRequired
};

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
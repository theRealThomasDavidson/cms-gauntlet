import { useState, useEffect } from 'react';
import { fetchTickets, getActiveWorkflows, updateTicket } from '../../lib/ticketService';

export default function UnassignedTicketsView() {
  const [tickets, setTickets] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadUnassignedTickets();
    loadWorkflows();
  }, []);

  async function loadUnassignedTickets() {
    try {
      const { data, error } = await fetchTickets({
        workflowId: null // Fetch tickets without workflows
      });
      if (error) throw error;
      setTickets(data || []);
    } catch (err) {
      console.error('Error loading unassigned tickets:', err);
      setError('Failed to load tickets');
    } finally {
      setLoading(false);
    }
  }

  async function loadWorkflows() {
    try {
      const { data, error } = await getActiveWorkflows();
      if (error) throw error;
      setWorkflows(data || []);
    } catch (err) {
      console.error('Error loading workflows:', err);
      setError('Failed to load workflows');
    }
  }

  async function assignWorkflow(ticketId, workflowId) {
    try {
      setLoading(true);
      const { error } = await updateTicket(ticketId, { workflow_id: workflowId });
      if (error) throw error;
      
      // Refresh the list
      await loadUnassignedTickets();
    } catch (err) {
      console.error('Error assigning workflow:', err);
      setError('Failed to assign workflow');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-600">{error}</div>;
  }

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Unassigned Tickets</h2>
      
      {tickets.length === 0 ? (
        <p className="text-gray-500">No unassigned tickets found.</p>
      ) : (
        <div className="space-y-4">
          {tickets.map(ticket => (
            <div key={ticket.id} className="border rounded-lg p-4 bg-white shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold">{ticket.title}</h3>
                  <p className="text-sm text-gray-600">Priority: {ticket.priority}</p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    onChange={(e) => assignWorkflow(ticket.id, e.target.value)}
                    className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    defaultValue=""
                  >
                    <option value="" disabled>Select Workflow</option>
                    {workflows.map(workflow => (
                      <option key={workflow.id} value={workflow.id}>
                        {workflow.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => assignWorkflow(ticket.id, workflows[0]?.id)}
                    disabled={!workflows.length}
                    className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    Assign
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 
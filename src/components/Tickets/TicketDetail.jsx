import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import PropTypes from 'prop-types';
import { TicketHistory } from './TicketHistory';

export function TicketDetail({ ticketId, onBack }) {
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTicket = async () => {
      try {
        const { data, error } = await supabase
          .rpc('get_ticket_details', {
            p_ticket_id: ticketId
          });

        if (error) throw error;
        setTicket(data[0]); // The function returns a table type, so we take the first row
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTicket();
  }, [ticketId]);

  if (loading) return <div>Loading ticket details...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!ticket) return <div>Ticket not found</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <button
          onClick={onBack}
          className="text-gray-600 hover:text-gray-800"
        >
          ← Back to Tickets
        </button>
        <span className={`px-3 py-1 rounded-full text-sm font-medium
          ${ticket.status === 'open' ? 'bg-green-100 text-green-800' : 
            ticket.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
            'bg-gray-100 text-gray-800'}`}
        >
          {ticket.status}
        </span>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6">
        <h1 className="text-2xl font-bold mb-2">{ticket.title}</h1>
        
        <div className="grid grid-cols-2 gap-4 mb-6 text-sm text-gray-600">
          <div>
            <p>Priority: {ticket.priority}</p>
            <p>Created at: {new Date(ticket.changed_at).toLocaleString()}</p>
          </div>
          <div>
            <p>Stage: {ticket.stage_name || 'Unassigned'}</p>
            <p>Assigned to: {ticket.assigned_to_name || 'Unassigned'}</p>
          </div>
        </div>

        <div className="prose max-w-none">
          <h3 className="text-lg font-semibold mb-2">Description</h3>
          <p className="whitespace-pre-wrap">{ticket.description}</p>
        </div>
      </div>

      <TicketHistory ticketId={ticketId} />
    </div>
  );
}

TicketDetail.propTypes = {
  ticketId: PropTypes.string.isRequired,
  onBack: PropTypes.func.isRequired
}; 
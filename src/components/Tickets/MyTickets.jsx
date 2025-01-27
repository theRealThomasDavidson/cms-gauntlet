import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { ArrowRight } from 'lucide-react';
import PropTypes from 'prop-types';

const MyTickets = ({ onSelectTicket }) => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchMyTickets = async () => {
      try {
        const { data, error } = await supabase.rpc('get_customer_tickets');
        if (error) throw error;
        setTickets(data || []);
      } catch (err) {
        console.error('Error loading tickets:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchMyTickets();
  }, []);

  if (loading) return <div>Loading your tickets...</div>;
  if (error) return <div>Error loading tickets: {error}</div>;
  if (!tickets.length) return <div>You don't have any tickets yet.</div>;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold mb-4">My Tickets</h2>
      {tickets.map((ticket) => (
        <div
          key={ticket.id}
          className="bg-white p-4 rounded-lg shadow hover:shadow-md transition-all"
        >
          <div className="flex justify-between items-start">
            <div className="flex-grow">
              <h3 className="font-medium text-gray-900">{ticket.title}</h3>
              <div className="flex gap-3 mt-2 text-sm text-gray-600">
                <span className={`px-2 py-1 rounded-full ${
                  ticket.priority === 'high' ? 'bg-red-100 text-red-800' :
                  ticket.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-green-100 text-green-800'
                }`}>
                  {ticket.priority}
                </span>
                <span>•</span>
                <span>{ticket.stage_name || 'Unassigned'}</span>
                {ticket.public_comment_count > 0 && (
                  <>
                    <span>•</span>
                    <span>{ticket.public_comment_count} comment{ticket.public_comment_count !== 1 ? 's' : ''}</span>
                  </>
                )}
              </div>
              <div className="mt-2 text-sm text-gray-500">
                Created {new Date(ticket.created_at).toLocaleDateString()}
              </div>
            </div>
            <button
              onClick={() => onSelectTicket(ticket.id)}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
              title="View ticket details"
            >
              <ArrowRight size={20} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

MyTickets.propTypes = {
  onSelectTicket: PropTypes.func.isRequired
};

export default MyTickets; 
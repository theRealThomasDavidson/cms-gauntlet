import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import PropTypes from 'prop-types';

const TicketHistory = ({ ticketId }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const { data, error } = await supabase
          .rpc('get_ticket_history', {
            p_ticket_id: ticketId
          });

        if (error) throw error;
        setHistory(data || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [ticketId]);

  if (loading) return <div>Loading history...</div>;
  if (error) return <div>Error loading history: {error}</div>;
  if (!history.length) return <div>No history available</div>;

  return (
    <div className="mt-8">
      <h2 className="text-xl font-semibold mb-4">Ticket History</h2>
      <div className="space-y-4">
        {history.map((entry) => (
          <div 
            key={entry.id} 
            className="bg-gray-50 p-4 rounded-lg border border-gray-200"
          >
            <div className="flex justify-between items-start mb-2">
              <div className="text-sm font-medium text-gray-900">
                {new Date(entry.changed_at).toLocaleString()}
              </div>
              <div className="text-sm text-gray-500">
                Changed by: {entry.changed_by}
              </div>
            </div>
            
            {/* Changes */}
            <div className="text-sm text-gray-600">
              {entry.changes && (
                <div className="space-y-1">
                  {entry.changes.action === 'stage_changed' && (
                    <p>
                      Stage changed: {entry.changes.previous_stage_id} →{' '}
                      {entry.changes.new_stage_id}
                      {entry.changes.change_reason && (
                        <span className="text-gray-500 ml-2">
                          Reason: {entry.changes.change_reason}
                        </span>
                      )}
                    </p>
                  )}
                  {/* Add more change types as needed */}
                </div>
              )}
            </div>

            {/* Other ticket details that changed */}
            <div className="mt-2 text-sm text-gray-600">
              <p>Title: {entry.title}</p>
              {entry.description && (
                <p className="mt-1">Description: {entry.description}</p>
              )}
              <p className="mt-1">Priority: {entry.priority}</p>
              <p>Assigned to: {entry.assigned_to || 'Unassigned'}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

TicketHistory.propTypes = {
  ticketId: PropTypes.string.isRequired
};

export default TicketHistory; 
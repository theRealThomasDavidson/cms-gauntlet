import { useState, useEffect } from 'react';
import { fetchTicketDetails, addComment } from '../../lib/ticketService';
import { useAuth } from '../../hooks/useAuth';

export default function TicketDetails({ ticketId }) {
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newComment, setNewComment] = useState('');
  const [isInternalComment, setIsInternalComment] = useState(false);
  const { user, isAgent } = useAuth();

  useEffect(() => {
    loadTicketDetails();
  }, [ticketId]);

  async function loadTicketDetails() {
    try {
      setLoading(true);
      const result = await fetchTicketDetails(ticketId);
      if (result.error) throw result.error;
      setTicket(result);
    } catch (err) {
      console.error('Error loading ticket:', err);
      setError('Failed to load ticket details');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddComment(e) {
    e.preventDefault();
    try {
      await addComment(ticketId, newComment, isInternalComment);
      setNewComment('');
      loadTicketDetails();
    } catch (err) {
      console.error('Error adding comment:', err);
    }
  }

  if (loading) return <div>Loading ticket details...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!ticket) return <div>Ticket not found</div>;

  // Combine history and comments for chronological display
  const timeline = [
    ...ticket.history.map(h => ({
      ...h,
      type: 'history',
      timestamp: h.changed_at
    })),
    ...ticket.comments.map(c => ({
      ...c,
      type: 'comment',
      timestamp: c.created_at
    }))
  ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  return (
    <div className="max-w-4xl mx-auto p-4">
      {/* Ticket Header */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h1 className="text-2xl font-bold mb-2">{ticket.ticket.latest_history.title}</h1>
        <div className="flex gap-4 text-sm text-gray-600 mb-4">
          <span>Created {new Date(ticket.ticket.created_at).toLocaleDateString()}</span>
          <span>•</span>
          <span>Status: {ticket.ticket.current_stage.name}</span>
          <span>•</span>
          <span>Priority: {ticket.ticket.latest_history.priority}</span>
        </div>
        <p className="text-gray-700 whitespace-pre-wrap">
          {ticket.ticket.latest_history.description}
        </p>
      </div>

      {/* Timeline */}
      <div className="space-y-4">
        {timeline.map(item => {
          // Skip internal comments for non-agents
          if (item.type === 'comment' && item.is_internal && !isAgent) {
            return null;
          }

          return (
            <div key={item.id} className="bg-white rounded-lg shadow p-4">
              {item.type === 'comment' ? (
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="font-semibold">
                        {isAgent ? item.author.name : 
                          (item.author.role === 'agent' ? 'Support Team' : item.author.name)}
                      </span>
                      {item.is_internal && (
                        <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                          Internal
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-gray-500">
                      {new Date(item.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-gray-700 whitespace-pre-wrap">{item.content}</p>
                </div>
              ) : (
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-semibold">
                      {isAgent ? item.changed_by_user.name : 'Support Team'}
                    </span>
                    <span className="text-sm text-gray-500">
                      {new Date(item.changed_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    {Object.entries(item.changes.fields).map(([field, value]) => (
                      <p key={field}>
                        Updated {field}: {value.toString()}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Comment Form */}
      <form onSubmit={handleAddComment} className="mt-6 bg-white rounded-lg shadow p-4">
        <textarea
          value={newComment}
          onChange={e => setNewComment(e.target.value)}
          placeholder="Add a comment..."
          className="w-full p-2 border rounded-lg mb-2"
          rows={3}
        />
        {isAgent && (
          <label className="flex items-center gap-2 mb-2">
            <input
              type="checkbox"
              checked={isInternalComment}
              onChange={e => setIsInternalComment(e.target.checked)}
            />
            <span className="text-sm text-gray-700">Internal comment</span>
          </label>
        )}
        <button
          type="submit"
          disabled={!newComment.trim()}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg disabled:opacity-50"
        >
          Add Comment
        </button>
      </form>
    </div>
  );
} 
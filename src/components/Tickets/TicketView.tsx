import { useState } from 'react'
import { Loader2, Sparkles } from "lucide-react"
import { supabase } from '../../lib/supabaseClient'
import { MessagePreviewDialog } from './MessagePreviewDialog.jsx'

interface TicketViewProps {
  ticket: {
    id: string;
    title: string;
    description?: string;
    created_by: string; // Customer who created the ticket
    status: 'open' | 'in_progress' | 'resolved' | 'closed' | 'on_hold';
    priority: 'low' | 'medium' | 'high' | 'urgent';
    customer?: {
      username?: string;
      full_name?: string;
    };
    history?: Array<{
      id: string;
      description?: string;
      changed_at: string;
      changes: {
        action?: string;
        from?: string;
        to?: string;
      };
    }>;
    current_stage_id?: string;
    stages?: Array<any>;
  }
}

export function TicketView({ ticket }: TicketViewProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [generatedMessage, setGeneratedMessage] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleGenerateMessage = async () => {
    try {
      setIsGenerating(true)
      setError(null)
      
      const context = {
        customerName: ticket.customer?.full_name || ticket.customer?.username,
        ticketTitle: ticket.title,
        ticketDescription: ticket.description,
        ticketPriority: ticket.priority,
        ticketStatus: ticket.status,
        ticketHistory: ticket.history?.map(h => ({
          description: h.description,
          action: h.changes.action,
          timestamp: h.changed_at,
          change: h.changes.from ? `${h.changes.from} → ${h.changes.to}` : undefined
        }))
      }

      console.log('Sending context:', context)

      const { data, error } = await supabase.functions.invoke('outreach-gpt', {
        body: { context }
      })
      
      if (error) throw error
      
      setGeneratedMessage(data.response.content || data.response.text)
      setShowPreview(true)

    } catch (error) {
      console.error('Full error:', error)
      setError('Failed to generate message')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleConfirmMessage = async (editedMessage: string) => {
    try {
      setError(null)
      const { error: historyError } = await supabase.rpc('update_ticket_data', {
        p_ticket_id: ticket.id,
        p_description: editedMessage,
        p_change_reason: 'AI message generated'
      })

      if (historyError) throw historyError
      setShowPreview(false)

    } catch (error) {
      console.error('Error:', error)
      setError('Failed to add message')
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="text-red-600 text-sm">{error}</div>
      )}
      
      <button 
        onClick={handleGenerateMessage}
        disabled={isGenerating}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
      >
        {isGenerating ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating message...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Generate Smart Message
          </>
        )}
      </button>

      <MessagePreviewDialog
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        onConfirm={handleConfirmMessage}
        ticketContext={{
          title: ticket.title,
          description: ticket.description || '',
          currentStageId: ticket.current_stage_id || '',
          stages: ticket.stages || [],
          knowledgeKeywords: [],
          customerInfo: {
            name: ticket.customer?.full_name || ticket.customer?.username,
            priority: ticket.priority,
            status: ticket.status
          }
        }}
        generatedMessage={generatedMessage}
        isLoading={isGenerating}
      />
    </div>
  )
} 
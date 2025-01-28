import React, { useState } from 'react'
import { X } from 'lucide-react'

interface TicketContext {
  title: string;
  description?: string;
  currentStageId: string;
  stages: Array<{
    id: string;
    name: string;
  }>;
  knowledgeKeywords?: any[];
  customerInfo?: Record<string, any>;
}

interface MessagePreviewDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (message: string, stageId: string) => void
  ticketContext: TicketContext
  generatedMessage: string
  isLoading: boolean
}

export function MessagePreviewDialog({
  isOpen,
  onClose,
  onConfirm,
  ticketContext,
  generatedMessage,
  isLoading
}: MessagePreviewDialogProps) {
  const [editedMessage, setEditedMessage] = useState(generatedMessage)

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Preview Generated Response</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X size={20} />
          </button>
        </div>

        <textarea
          value={editedMessage}
          onChange={(e) => setEditedMessage(e.target.value)}
          placeholder="Edit message before adding to ticket..."
          className="w-full p-2 border rounded-lg mb-4 h-64 resize-none"
          disabled={isLoading}
        />

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(editedMessage, ticketContext.currentStageId)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            disabled={isLoading}
          >
            Add to Ticket
          </button>
        </div>
      </div>
    </div>
  )
} 
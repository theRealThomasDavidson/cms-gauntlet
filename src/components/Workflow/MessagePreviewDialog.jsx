import { useState, useEffect } from 'react';

export default function MessagePreviewDialog({ 
  isOpen, 
  onClose, 
  onConfirm, 
  ticketContext, 
  generatedMessage,
  isLoading,
  loadingStep 
}) {
  const [message, setMessage] = useState('');
  const [selectedStageId, setSelectedStageId] = useState(ticketContext.currentStageId);

  // Initialize with empty message
  useEffect(() => {
    setMessage('');
    setSelectedStageId(ticketContext.currentStageId);
  }, [isOpen, ticketContext.currentStageId]);

  // Update message when AI response comes in
  useEffect(() => {
    if (generatedMessage) {
      setMessage(generatedMessage);
    }
  }, [generatedMessage]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full p-6">
        <h2 className="text-lg font-semibold mb-4">Preview Message</h2>
        
        {/* Show loading state with animation */}
        {isLoading && (
          <div className="mb-4 space-y-2">
            <div className="flex items-center text-blue-600">
              <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Working on your response...</span>
            </div>
            <div className="text-gray-600 text-sm">
              {loadingStep}
            </div>
          </div>
        )}

        {/* Message textarea - always show it */}
        <div className="mt-4">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={isLoading ? "Generating response..." : "Enter your message..."}
            className="w-full h-48 p-2 border rounded"
            disabled={isLoading}
          />
        </div>

        {/* Stage selection */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Move to Stage
          </label>
          <select
            value={selectedStageId}
            onChange={(e) => setSelectedStageId(e.target.value)}
            className="w-full p-2 border rounded"
            disabled={isLoading}
          >
            {ticketContext.stages.map(stage => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))}
          </select>
        </div>

        {/* Buttons */}
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(message, selectedStageId)}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            disabled={isLoading}
          >
            Send Response
          </button>
        </div>
      </div>
    </div>
  );
} 
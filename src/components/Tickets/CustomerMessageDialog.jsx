import { useState, useEffect } from 'react';

export default function CustomerMessageDialog({ 
  isOpen, 
  onClose, 
  onConfirm, 
  ticketContext,
  generatedMessage,
  isLoading,
  loadingStep 
}) {
  const [message, setMessage] = useState('');

  // Initialize with empty message
  useEffect(() => {
    setMessage('');
  }, [isOpen]);

  // Update message when AI response comes in
  useEffect(() => {
    if (generatedMessage) {
      setMessage(generatedMessage);
    }
  }, [generatedMessage]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full p-6">
        <h2 className="text-lg font-semibold mb-4">Add Additional Information</h2>
        
        {/* Show loading state */}
        {isLoading && (
          <div className="mb-4 space-y-2">
            <div className="flex items-center text-blue-600">
              <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Processing your message...</span>
            </div>
            <div className="text-gray-600 text-sm">
              {loadingStep}
            </div>
          </div>
        )}

        {/* Current Stage Info */}
        <div className="mb-4 bg-gray-50 p-3 rounded">
          <div className="text-sm font-medium text-gray-700">Current Stage</div>
          <div className="text-sm text-gray-600">{ticketContext.stageName}</div>
        </div>

        {/* Message textarea - always show it */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Your Message
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Add any additional information or context..."
            className="w-full h-48 p-2 border rounded"
            disabled={isLoading}
          />
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
            onClick={() => onConfirm(message, ticketContext.currentStageId)}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            disabled={isLoading || !message.trim()}
          >
            Add Message
          </button>
        </div>
      </div>
    </div>
  );
} 
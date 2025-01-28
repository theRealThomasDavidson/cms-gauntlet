import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { X } from 'lucide-react';

export function MessagePreviewDialog({ 
  isOpen, 
  onClose, 
  onConfirm, 
  ticketContext, 
  generatedMessage, 
  isLoading 
}) {
  const [message, setMessage] = useState(generatedMessage);
  const [selectedStage, setSelectedStage] = useState(ticketContext.currentStageId);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Preview Response</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X size={20} />
          </button>
        </div>

        {/* Stage Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Move to Stage
          </label>
          <select
            value={selectedStage}
            onChange={(e) => setSelectedStage(e.target.value)}
            className="w-full p-2 border rounded-lg"
          >
            {ticketContext.stages.map(stage => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))}
          </select>
        </div>

        {/* Message Preview */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Message
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full p-2 border rounded-lg h-48 resize-none"
            disabled={isLoading}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(message, selectedStage)}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

MessagePreviewDialog.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  ticketContext: PropTypes.shape({
    title: PropTypes.string.isRequired,
    description: PropTypes.string,
    currentStageId: PropTypes.string.isRequired,
    stages: PropTypes.arrayOf(PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired
    })).isRequired,
    knowledgeKeywords: PropTypes.array,
    customerInfo: PropTypes.object
  }).isRequired,
  generatedMessage: PropTypes.string.isRequired,
  isLoading: PropTypes.bool.isRequired
}; 
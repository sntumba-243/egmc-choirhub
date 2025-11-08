import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface MessageDetailProps {
  messageId: string;
  onBack: () => void;
}

export const MessageDetail: React.FC<MessageDetailProps> = ({ messageId, onBack }) => {
  const mockMessage = {
    id: messageId,
    subject: messageId === '1' ? 'Rehearsal Update' : 'Concert Details',
    from: messageId === '1' ? 'Director' : 'Admin',
    date: messageId === '1' ? '2024-03-10' : '2024-03-08',
    body: 'This is the message content. Please read carefully.',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-blue-900 font-semibold hover:text-blue-700 mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Messages
        </button>
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-3xl font-bold text-blue-900 mb-2">{mockMessage.subject}</h2>
          <p className="text-gray-600 mb-6">From: {mockMessage.from} • {mockMessage.date}</p>
          <div className="prose">
            <p className="text-gray-700">{mockMessage.body}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

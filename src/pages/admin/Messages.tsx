import React, { useState, useEffect } from 'react';
import { Mail, Send, AlertCircle, Users } from 'lucide-react';
import { messagesService, Message } from '../../lib/database';

interface AdminMessagesProps {
  onNavigateToForm: () => void;
  onNavigateToDetail: (messageId: string) => void;
}

export const AdminMessages: React.FC<AdminMessagesProps> = ({ onNavigateToForm, onNavigateToDetail }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMessages();
  }, []);

  const loadMessages = async () => {
    try {
      const data = await messagesService.getMessages();
      setMessages(data.sort((a, b) =>
        new Date(b.sent_date).getTime() - new Date(a.sent_date).getTime()
      ));
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getRecipientDisplay = (message: Message): string => {
    if (message.send_to === 'All') return 'All Members';
    if (message.send_to === 'Soprano') return 'Soprano Section';
    if (message.send_to === 'Alto') return 'Alto Section';
    if (message.send_to === 'Tenor') return 'Tenor Section';
    if (message.send_to === 'Bass') return 'Bass Section';
    return 'Selected Members';
  };

  const getRecipientIcon = (message: Message) => {
    if (message.send_to === 'All') {
      return <Users className="w-4 h-4" />;
    }
    return <Users className="w-4 h-4" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-600">Loading messages...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-blue-900">Messages</h2>
            <p className="text-gray-600 mt-1">{messages.length} sent messages</p>
          </div>
          <button
            onClick={onNavigateToForm}
            className="bg-blue-900 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-800 transition-colors flex items-center justify-center gap-2"
          >
            <Send className="w-5 h-5" />
            Send New Message
          </button>
        </div>

        {messages.length === 0 ? (
          <div className="text-center py-12">
            <Mail className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">No messages sent yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map(message => (
              <div
                key={message.id}
                onClick={() => onNavigateToDetail(message.id)}
                className="bg-white border-2 border-gray-200 rounded-xl p-5 hover:shadow-lg hover:border-blue-300 transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-bold text-blue-900 truncate">{message.subject}</h3>
                      {message.is_important && (
                        <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1 whitespace-nowrap">
                          <AlertCircle className="w-3 h-3" />
                          Important
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-sm text-gray-600 mb-2">
                      <div className="flex items-center gap-1">
                        {getRecipientIcon(message)}
                        <span className="font-medium">{getRecipientDisplay(message)}</span>
                      </div>
                      <span>•</span>
                      <span>{formatDate(message.sent_date)}</span>
                    </div>

                    <p className="text-gray-700 text-sm line-clamp-2">
                      {message.body.substring(0, 100)}
                      {message.body.length > 100 && '...'}
                    </p>
                  </div>

                  <Mail className="w-8 h-8 text-blue-200 flex-shrink-0" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

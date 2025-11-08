import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Mail, Send, Plus, Trash2, X, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

interface Message {
  id: string;
  subject: string;
  body: string;
  send_to: string;
  recipients: string;
  is_important: boolean;
  sent_date: string;
}

export const AdminMessages = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);

  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('sent_date', { ascending: false });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!confirm('Delete this message?')) return;

    try {
      const { error } = await supabase.from('messages').delete().eq('id', id);
      if (error) throw error;
      setMessages(messages.filter(m => m.id !== id));
      setSelectedMessage(null);
      toast.success('Message deleted');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to delete');
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getRecipientDisplay = (message: Message) => {
    if (message.send_to === 'all') return 'All Members';
    if (message.send_to === 'admin') return 'Admin';
    if (message.recipients && message.recipients.includes('-') && message.recipients.length > 50) {
      return 'Multiple Recipients';
    }
    return message.send_to || 'Unknown';
  };

  if (loading) {
    return <div className="flex justify-center p-12">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
    </div>;
  }

  // Message detail view
  if (selectedMessage) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setSelectedMessage(null)}
            className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Messages
          </button>
          <button
            onClick={(e) => handleDelete(selectedMessage.id, e)}
            className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg"
          >
            <Trash2 className="w-5 h-5" />
            Delete
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-2xl font-bold text-gray-900">{selectedMessage.subject}</h2>
              {selectedMessage.is_important && (
                <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded">
                  Important
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <Mail className="w-4 h-4" />
                <span>To: {getRecipientDisplay(selectedMessage)}</span>
              </div>
              <div className="flex items-center gap-1">
                <Send className="w-4 h-4" />
                <span>{formatDate(selectedMessage.sent_date)}</span>
              </div>
            </div>
          </div>

          <div className="prose max-w-none">
            <p className="text-gray-700 whitespace-pre-wrap">{selectedMessage.body}</p>
          </div>
        </div>
      </div>
    );
  }

  // Messages list view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Messages</h1>
          <p className="text-gray-600">{messages.length} total messages</p>
        </div>
        <button
          onClick={() => navigate('/admin/messages/new')}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:shadow-lg"
        >
          <Plus className="w-5 h-5" />
          New Message
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {messages.length === 0 ? (
          <div className="p-12 text-center">
            <Mail className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No messages yet</h3>
            <p className="text-gray-600 mb-6">Send your first message to the choir</p>
            <button
              onClick={() => navigate('/admin/messages/new')}
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:shadow-lg"
            >
              Send Message
            </button>
          </div>
        ) : (
          <div className="divide-y">
            {messages.map((message) => (
              <div
                key={message.id}
                onClick={() => setSelectedMessage(message)}
                className="p-6 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{message.subject}</h3>
                      {message.is_important && (
                        <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded">
                          Important
                        </span>
                      )}
                    </div>
                    <p className="text-gray-700 mb-3 line-clamp-2">
                      {message.body}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Mail className="w-4 h-4" />
                        <span>To: {getRecipientDisplay(message)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Send className="w-4 h-4" />
                        <span>{formatDate(message.sent_date)}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDelete(message.id, e)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg ml-4"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

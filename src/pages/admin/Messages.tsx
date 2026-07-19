import { useState, useEffect } from 'react';
import { useChurch } from '../../contexts/ChurchContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { getAuthUid } from '../../lib/authUid';
import { Mail, Send, Plus, Trash2, X, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

interface Message {
  id: string;
  subject: string;
  body: string;
  send_to: string;
  recipients: string;
  is_important: boolean;
  created_at: string;
}

export const AdminMessages = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const { church } = useChurch();
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchMessages();
    fetchReadStatus();
  }, [church?.id]);

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('church_id', church?.id)
        .order('created_at', { ascending: false });

      // Also fetch messages from members to admin
      const { data: memberMessages } = await supabase
        .from('messages')
        .select('*')
        .eq('church_id', church?.id)
        .eq('send_to', 'admin')
        .order('created_at', { ascending: false });

      // Merge and dedupe
      const allMessages = [...(data || []), ...(memberMessages || [])];
      const unique = Array.from(new Map(allMessages.map(m => [m.id, m])).values());
      unique.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      if (error) throw error;
      setMessages(unique || []);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const fetchReadStatus = async () => {
    const authId = await getAuthUid();
    if (!authId) return;
    const { data } = await supabase
      .from('read_messages')
      .select('message_id')
      .eq('user_id', authId);
    setReadIds(new Set(data?.map(r => r.message_id) || []));
  };

  const markAsRead = async (messageId: string) => {
    const authId = await getAuthUid();
    if (!authId) return;
    await supabase
      .from('read_messages')
      .upsert({ message_id: messageId, user_id: authId }, { onConflict: 'message_id,user_id' });
    setReadIds(prev => new Set([...prev, messageId]));
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
    const date = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getRecipientDisplay = (message: Message) => {
    if (message.send_to === 'all') return 'All Members';
    if (message.send_to === 'admin') return '📩 From: ' + (message.recipients || 'Member');
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
            className="flex items-center gap-2 text-blue-500 hover:text-blue-600 text-sm font-medium"
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

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-xl font-bold text-gray-900">{selectedMessage.subject}</h2>
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
                <span>{formatDate(selectedMessage.created_at)}</span>
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
          <h1 className="text-2xl font-bold">Messages</h1>
          <p className="text-xs text-gray-500">{messages.length} total messages</p>
        </div>
        <button
          onClick={() => navigate('/admin/messages/new')}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-500 text-white rounded-xl text-[13px] font-semibold hover:bg-blue-600 shadow-sm transition-all min-h-[44px]"
        >
          <Plus className="w-5 h-5" />
          New Message
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {messages.length === 0 ? (
          <div className="p-12 text-center">
            <Mail className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No messages yet</h3>
            <p className="text-gray-600 mb-6">Send your first message to the choir</p>
            <button
              onClick={() => navigate('/admin/messages/new')}
              className="px-4 py-2 bg-blue-500 text-white rounded-xl text-sm font-semibold hover:bg-blue-600 shadow-sm min-h-[44px]"
            >
              Send Message
            </button>
          </div>
        ) : (
          <div className="divide-y">
            {messages.map((message) => (
              <div
                key={message.id}
                onClick={() => { setSelectedMessage(message); markAsRead(message.id); }}
                className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer ${readIds.has(message.id) ? 'bg-white' : 'bg-blue-50/60 border-l-4 border-l-blue-500'}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className={`text-sm font-semibold ${readIds.has(message.id) ? 'text-gray-600' : 'text-gray-900'}`}>{message.subject}</h3>
                      {message.is_important && (
                        <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded">
                          Important
                        </span>
                      )}
                    </div>
                    <p className={`mb-2 line-clamp-2 text-xs ${readIds.has(message.id) ? 'text-gray-400' : 'text-gray-700 font-medium'}`}>
                      {message.body}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Mail className="w-4 h-4" />
                        <span>To: {getRecipientDisplay(message)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Send className="w-4 h-4" />
                        <span>{formatDate(message.created_at)}</span>
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

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Mail, AlertCircle, Send, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
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

export const MemberMessages = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [loading, setLoading] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

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
      const filtered = (data || []).filter(m => m.send_to === 'all' || m.send_to === user?.id);
      setMessages(filtered);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (messageId: string) => {
    try {
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('id', messageId);
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, is_read: true } : m));
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedMessage) return;

    setSending(true);
    try {
      const { error } = await supabase
        .from('messages')
        .insert([{
          subject: `Re: ${selectedMessage.subject}`,
          body: replyText,
          send_to: 'admin',
          recipients: 'admin',
          sender_id: user?.id,
          is_important: false
        }]);

      if (error) throw error;
      toast.success('Reply sent!');
      setReplyText('');
      setSelectedMessage(null);
      fetchMessages();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return <div className="flex justify-center p-12">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
    </div>;
  }

  // Message detail view
  if (selectedMessage) {
    return (
      <div className="space-y-4 pb-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setSelectedMessage(null)}
            className="flex items-center gap-2 text-purple-600 hover:text-purple-700"
          >
            <X className="w-5 h-5" />
            Back to Messages
          </button>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-md">
          <div className="flex items-start gap-3 mb-4">
            <div className={`p-3 rounded-lg ${
              selectedMessage.is_important ? 'bg-red-100' : 'bg-purple-100'
            }`}>
              {selectedMessage.is_important ? (
                <AlertCircle className="w-6 h-6 text-red-600" />
              ) : (
                <Mail className="w-6 h-6 text-purple-600" />
              )}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900 mb-1">{selectedMessage.subject}</h2>
              <p className="text-sm text-gray-600">{formatDate(selectedMessage.sent_date)}</p>
            </div>
          </div>

          <div className="prose max-w-none mb-6">
            <p className="text-gray-700 whitespace-pre-wrap">{selectedMessage.body}</p>
          </div>

          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4">Reply</h3>
            <form onSubmit={handleReply} className="space-y-4">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Type your reply..."
                rows={6}
                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-purple-500"
                required
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedMessage(null)}
                  className="flex-1 px-6 py-3 border text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sending || !replyText.trim()}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  <Send className="w-5 h-5" />
                  {sending ? 'Sending...' : 'Send Reply'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Messages list view
  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Messages</h1>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-6 py-2 rounded-full font-medium transition-colors ${
            filter === 'all'
              ? 'bg-purple-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`px-6 py-2 rounded-full font-medium transition-colors ${
            filter === 'unread'
              ? 'bg-purple-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Unread
        </button>
      </div>

      <div className="space-y-3">
        {messages.filter(m => filter === 'all' || !m.is_read).length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center">
            <Mail className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No messages yet</h3>
            <p className="text-gray-600">You'll see messages from your choir here</p>
          </div>
        ) : (
          messages.filter(m => filter === 'all' || !m.is_read).map((message) => (
            <div
              key={message.id}
              onClick={() => { setSelectedMessage(message); if (!message.is_read) markAsRead(message.id); }}
              className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-all"
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${
                  message.is_important ? 'bg-red-100' : 'bg-purple-100'
                }`}>
                  {message.is_important ? (
                    <AlertCircle className="w-5 h-5 text-red-600" />
                  ) : (
                    <Mail className="w-5 h-5 text-purple-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold text-gray-900 truncate">{message.subject}</h3>
                    <span className="text-xs text-gray-500 ml-2 flex-shrink-0">{formatDate(message.sent_date)}</span>
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2">{message.body}</p>
                  {message.is_important && (
                    <span className="inline-block mt-2 px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded">
                      Important
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

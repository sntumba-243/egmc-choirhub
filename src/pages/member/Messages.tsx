import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { MessageSquare, Plus, ArrowLeft, CheckCheck } from 'lucide-react';
import toast from 'react-hot-toast';

interface Message {
  id: string;
  subject: string;
  body: string;
  admin_id: string;
  send_to: string;
  created_at: string;
  is_read: boolean;
  is_important?: boolean;
  admin_name?: string;
}

export const MemberMessages = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchMessages = async () => {
    try {
      if (!user?.id) return;

      const { data, error } = await supabase
        .from('messages')
        .select(`
          id,
          subject,
          body,
          admin_id,
          send_to,
          created_at,
          is_read,
          is_important,
          members (name)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching messages:', error);
        return;
      }
      console.log("All messages send_to:", data?.map(m => m.send_to));
      const filteredData = data?.filter(msg => msg.send_to === 'all' || msg.send_to === user?.id) || [];

      const messagesWithNames = filteredData.map(msg => ({
        ...msg,
        admin_name: msg.members?.name || 'Admin'
      })) || [];

      setMessages(messagesWithNames);
      const unread = messagesWithNames.filter(m => !m.is_read).length;
      setUnreadCount(unread);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (messageId: string) => {
    try {
      if (!user?.id) return;
      const { error } = await supabase
        .from('message_reads')
        .upsert({ message_id: messageId, user_id: user.id }, { onConflict: 'message_id,user_id' });

      if (error) throw error;

      setMessages(prev => 
        prev.map(m => m.id === messageId ? { ...m, is_read: true } : m)
      );
      setSelectedMessage(prev => 
        prev && prev.id === messageId ? { ...prev, is_read: true } : prev
      );
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString.includes('T') ? dateString : dateString + 'T00:00:00');
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const filteredMessages = filter === 'unread' 
    ? messages.filter(m => !m.is_read)
    : messages;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mb-3"></div>
        <p className="text-gray-600 text-sm">Loading messages...</p>
      </div>
    );
  }

  // Message Detail View
  if (selectedMessage) {
    return (
      <div className="space-y-4 pb-4">
        {/* Header */}
        <button
          onClick={() => {
            setSelectedMessage(null);
            if (!selectedMessage.is_read) {
              markAsRead(selectedMessage.id);
            }
          }}
          className="flex items-center gap-2 text-orange-600 hover:text-orange-700 font-medium text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Messages
        </button>

        {/* Message Content */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-4">
          {/* Subject */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-xl font-bold text-gray-900">
                {selectedMessage.subject}
              </h1>
              {selectedMessage.is_important && (
                <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded-md">Important</span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">From: {selectedMessage.admin_name}</p>
              <p className="text-xs text-gray-500">{formatDate(selectedMessage.created_at)}</p>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200" />

          {/* Message Body */}
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">
              {selectedMessage.body}
            </p>
          </div>

          {/* Mark as Read Button */}
          {!selectedMessage.is_read && (
            <button
              onClick={() => markAsRead(selectedMessage.id)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors"
            >
              <CheckCheck className="w-4 h-4" />
              Mark as Read
            </button>
          )}
        </div>
      </div>
    );
  }

  // Messages List View
  return (
    <div className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
        <button
          onClick={() => navigate('/member/messages/compose')}
          className="flex items-center gap-1 px-3 py-1.5 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            filter === 'all'
              ? 'bg-orange-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all relative ${
            filter === 'unread'
              ? 'bg-orange-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Unread
          {unreadCount > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Messages List */}
      {filteredMessages.length === 0 ? (
        <div className="text-center py-12">
          <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600 text-sm">
            {filter === 'unread' ? 'No unread messages' : 'No messages yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredMessages.map(message => (
            <button
              key={message.id}
              onClick={() => {
                setSelectedMessage(message);
                if (!message.is_read) {
                  markAsRead(message.id);
                }
              }}
              className={`w-full text-left rounded-lg border transition-all ${
                message.is_read
                  ? 'bg-white border-gray-200 hover:border-gray-300'
                  : 'bg-orange-50/60 border-orange-200 border-l-4 border-l-orange-500 hover:border-orange-300'
              }`}
            >
              <div className="p-3 sm:p-4">
                <div className="flex items-start gap-3">
                  {/* Unread Indicator */}
                  {!message.is_read && (
                    <div className="flex-shrink-0 w-2 h-2 bg-orange-500 rounded-full mt-2" />
                  )}
                  
                  <div className="flex-1 min-w-0">
                    {/* Subject and Meta */}
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className={`text-sm truncate ${
                        message.is_read ? 'font-medium text-gray-600' : 'font-bold text-gray-900'
                      }`}>
                        {message.subject}
                      </h3>
                      {message.is_important && (
                        <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-[9px] font-semibold rounded-md flex-shrink-0">!</span>
                      )}
                      <span className="text-xs text-gray-500 flex-shrink-0 whitespace-nowrap">
                        {formatDate(message.created_at)}
                      </span>
                    </div>

                    {/* From and Preview */}
                    <p className="text-xs text-gray-600 mb-1">From: {message.admin_name}</p>
                    <p className={`text-xs line-clamp-2 ${
                      message.is_read ? 'text-gray-600' : 'text-gray-700 font-medium'
                    }`}>
                      {message.body}
                    </p>
                  </div>

                  {/* Arrow indicator */}
                  <div className="flex-shrink-0 text-gray-400 mt-1">→</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

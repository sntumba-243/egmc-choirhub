import React, { useState, useEffect } from 'react';
import { Mail, Plus, Send, X, ArrowLeft, Bell } from 'lucide-react';
import { directMessagesService, membersService, DirectMessage, Member } from '../../lib/database';
import { supabase } from '../../lib/supabase';

interface MemberMessagesProps {
  onNavigateToMessage: (messageId: string) => void;
}

export const MemberMessages: React.FC<MemberMessagesProps> = ({ onNavigateToMessage }) => {
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [admins, setAdmins] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    recipient_id: '',
    subject: '',
    body: '',
  });
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }

      const [messagesData, membersData] = await Promise.all([
        directMessagesService.getDirectMessages(),
        membersService.getMembers(),
      ]);
      setMessages(messagesData);
      setAdmins(membersData.filter(m => m.role === 'admin'));
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSenderName = (senderId: string): string => {
    const sender = admins.find(a => a.id === senderId);
    return sender ? sender.name : 'Unknown';
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.subject.trim() || !formData.body.trim()) return;

    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      await directMessagesService.createDirectMessage({
        sender_id: user.id,
        recipient_id: formData.recipient_id || null,
        subject: formData.subject,
        body: formData.body,
      });

      setFormData({ recipient_id: '', subject: '', body: '' });
      setShowCompose(false);
      await loadData();
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleViewMessage = async (message: DirectMessage) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user && message.recipient_id === user.id && !message.is_read) {
      try {
        await directMessagesService.markAsRead(message.id);
        await loadData();
      } catch (error) {
        console.error('Error marking message as read:', error);
      }
    }
    setSelectedMessageId(message.id);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-600">Loading messages...</div>
      </div>
    );
  }

  if (selectedMessageId) {
    const message = messages.find(m => m.id === selectedMessageId);
    if (!message) {
      setSelectedMessageId(null);
      return null;
    }

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-md p-6">
          <button
            onClick={() => setSelectedMessageId(null)}
            className="flex items-center gap-2 text-blue-900 font-semibold hover:text-blue-700 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Messages
          </button>

          <div className="mb-6">
            <h2 className="text-2xl font-bold text-blue-900 mb-2">{message.subject}</h2>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span>From: {getSenderName(message.sender_id)}</span>
              <span>•</span>
              <span>{formatDate(message.created_at || '')}</span>
            </div>
          </div>

          <div className="prose max-w-none">
            <p className="text-gray-700 whitespace-pre-wrap">{message.body}</p>
          </div>
        </div>
      </div>
    );
  }

  if (showCompose) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-blue-900">New Message to Director</h2>
            <button
              onClick={() => setShowCompose(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSendMessage} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Send To
              </label>
              <select
                value={formData.recipient_id}
                onChange={e => setFormData({ ...formData, recipient_id: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Directors</option>
                {admins.map(admin => (
                  <option key={admin.id} value={admin.id}>
                    {admin.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Subject
              </label>
              <input
                type="text"
                value={formData.subject}
                onChange={e => setFormData({ ...formData, subject: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Message subject..."
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Message
              </label>
              <textarea
                value={formData.body}
                onChange={e => setFormData({ ...formData, body: e.target.value })}
                rows={8}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="Type your message here..."
                required
              />
            </div>

            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setShowCompose(false)}
                className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={sending}
                className="flex-1 bg-blue-900 text-white py-3 rounded-lg font-semibold hover:bg-blue-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Send className="w-5 h-5" />
                {sending ? 'Sending...' : 'Send Message'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  const unreadCount = messages.filter(m => !m.is_read && m.recipient_id === currentUserId).length;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-blue-900 flex items-center gap-3">
              Messages
              {unreadCount > 0 && (
                <span className="inline-flex items-center justify-center w-8 h-8 text-sm font-bold text-white bg-blue-600 rounded-full">
                  {unreadCount}
                </span>
              )}
            </h2>
            <p className="text-gray-600 mt-1">{messages.length} total messages</p>
            {unreadCount > 0 && (
              <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                <Bell className="w-4 h-4 text-blue-700" />
                <span className="text-sm font-semibold text-blue-900">
                  You have {unreadCount} unread message{unreadCount > 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>
          <button
            onClick={() => setShowCompose(true)}
            className="bg-blue-900 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-800 transition-colors flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            New Message
          </button>
        </div>

        {messages.length === 0 ? (
          <div className="text-center py-12">
            <Mail className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">No messages yet</p>
            <button
              onClick={() => setShowCompose(true)}
              className="mt-4 text-blue-900 font-semibold hover:text-blue-700"
            >
              Send your first message to the director
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => (
              <button
                key={message.id}
                onClick={() => handleViewMessage(message)}
                className={`w-full p-4 rounded-lg hover:shadow-md transition-all text-left border-2 ${
                  !message.is_read && message.recipient_id === currentUserId
                    ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-400'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div className="flex-1 flex items-center gap-3">
                    <h3 className="font-bold text-blue-900 text-lg">
                      {message.subject}
                    </h3>
                    {!message.is_read && message.recipient_id === currentUserId && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-xs font-bold rounded-full">
                        <Mail className="w-3 h-3" />
                        NEW
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-gray-600 whitespace-nowrap">
                    {formatDate(message.created_at || '')}
                  </span>
                </div>
                <p className="text-gray-600 text-sm">
                  {message.sender_id === currentUserId ? (
                    <>To: {message.recipient_id ? getSenderName(message.recipient_id) : 'All Directors'}</>
                  ) : (
                    <>From: {getSenderName(message.sender_id)}</>
                  )}
                </p>
                <p className="text-gray-700 mt-2 line-clamp-2">{message.body}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

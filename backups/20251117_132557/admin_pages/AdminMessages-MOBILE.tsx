import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { isMobile } from '../../utils/mobile-helpers';
import '../../styles/mobile-optimization.css';

interface Message {
  id: string;
  sender_id: string;
  recipient_id: string | null;
  subject: string;
  content: string;
  is_read: boolean;
  created_at: string;
  sender: {
    full_name: string;
    email: string;
  };
  recipient?: {
    full_name: string;
    email: string;
  };
}

interface User {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

export function AdminMessages() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [filter, setFilter] = useState<'all' | 'sent' | 'received'>('all');
  
  // Compose form state
  const [composeRecipient, setComposeRecipient] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeContent, setComposeContent] = useState('');
  const [sending, setSending] = useState(false);

  const mobile = isMobile();

  useEffect(() => {
    loadData();
  }, [filter]);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      setCurrentUserId(user.id);

      // Load messages based on filter
      let query = supabase
        .from('messages')
        .select(`
          id,
          sender_id,
          recipient_id,
          subject,
          content,
          is_read,
          created_at,
          sender:profiles!messages_sender_id_fkey (
            full_name,
            email
          ),
          recipient:profiles!messages_recipient_id_fkey (
            full_name,
            email
          )
        `);

      if (filter === 'sent') {
        query = query.eq('sender_id', user.id);
      } else if (filter === 'received') {
        query = query.or(`recipient_id.eq.${user.id},recipient_id.is.null`);
      }

      const { data: messageData, error: messageError } = await query
        .order('created_at', { ascending: false });

      if (messageError) throw messageError;
      setMessages(messageData || []);

      // Load all users for compose
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .order('full_name');

      if (userError) throw userError;
      setUsers(userData || []);

    } catch (err) {
      console.error('Error loading messages:', err);
      setError('Failed to load messages');
    } finally {
      setLoading(false);
    }
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    
    if (!currentUserId || !composeSubject.trim() || !composeContent.trim()) {
      return;
    }

    try {
      setSending(true);

      const { error } = await supabase
        .from('messages')
        .insert({
          sender_id: currentUserId,
          recipient_id: composeRecipient || null, // null = broadcast to all
          subject: composeSubject.trim(),
          content: composeContent.trim(),
          is_read: false
        });

      if (error) throw error;

      // Reset form and close
      setComposeRecipient('');
      setComposeSubject('');
      setComposeContent('');
      setShowCompose(false);
      
      // Reload messages
      await loadData();
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to send message');
    } finally {
      setSending(false);
    }
  }

  async function markAsRead(messageId: string) {
    try {
      const { error } = await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('id', messageId);

      if (error) throw error;

      // Update local state
      setMessages(messages.map(m => 
        m.id === messageId ? { ...m, is_read: true } : m
      ));
    } catch (err) {
      console.error('Error marking message as read:', err);
    }
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  if (loading) {
    return (
      <div className={mobile ? 'mobile-container' : 'container mx-auto px-4 py-8'}>
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading messages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={mobile ? 'mobile-container' : 'container mx-auto px-4 py-8'}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className={mobile ? 'text-2xl font-bold text-gray-900' : 'text-3xl font-bold text-gray-900'}>
          Messages
        </h1>
        <button
          onClick={() => setShowCompose(true)}
          className={mobile ? 'mobile-button mobile-button-primary' : 'px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700'}
        >
          ✉️ Compose
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          {error}
        </div>
      )}

      {/* Filter Tabs */}
      <div className={mobile ? 'mobile-tabs mb-4' : 'flex gap-2 mb-6'}>
        <button
          onClick={() => setFilter('all')}
          className={`${mobile ? 'mobile-tab' : 'px-4 py-2 rounded-lg'} ${
            filter === 'all' 
              ? mobile ? 'mobile-tab-active' : 'bg-blue-600 text-white'
              : mobile ? '' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilter('received')}
          className={`${mobile ? 'mobile-tab' : 'px-4 py-2 rounded-lg'} ${
            filter === 'received'
              ? mobile ? 'mobile-tab-active' : 'bg-blue-600 text-white'
              : mobile ? '' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Received
        </button>
        <button
          onClick={() => setFilter('sent')}
          className={`${mobile ? 'mobile-tab' : 'px-4 py-2 rounded-lg'} ${
            filter === 'sent'
              ? mobile ? 'mobile-tab-active' : 'bg-blue-600 text-white'
              : mobile ? '' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Sent
        </button>
      </div>

      {/* Messages List */}
      {messages.length === 0 ? (
        <div className={mobile ? 'mobile-card' : 'bg-white rounded-lg shadow-md p-8'}>
          <div className="text-center text-gray-500">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-lg">No messages</p>
            <p className="text-sm mt-2">
              {filter === 'sent' ? 'Send a message to get started' : 'Your inbox is empty'}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map((message) => (
            <div
              key={message.id}
              onClick={() => {
                setSelectedMessage(message);
                if (!message.is_read && message.recipient_id === currentUserId) {
                  markAsRead(message.id);
                }
              }}
              className={`${mobile ? 'mobile-card' : 'bg-white rounded-lg shadow-md p-4'} cursor-pointer hover:shadow-lg transition-shadow ${
                !message.is_read && message.recipient_id === currentUserId ? 'border-l-4 border-blue-600' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {!message.is_read && message.recipient_id === currentUserId && (
                      <span className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0"></span>
                    )}
                    <p className="font-semibold text-gray-900 truncate">
                      {message.subject}
                    </p>
                  </div>
                  <p className="text-sm text-gray-600 mb-1">
                    {message.sender_id === currentUserId ? (
                      <>
                        To: {message.recipient_id ? message.recipient?.full_name : 'All Members'}
                      </>
                    ) : (
                      <>
                        From: {message.sender.full_name}
                      </>
                    )}
                  </p>
                  <p className="text-sm text-gray-500 line-clamp-2">
                    {message.content}
                  </p>
                </div>
                <div className="flex-shrink-0 text-xs text-gray-500">
                  {formatDate(message.created_at)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Compose Modal */}
      {showCompose && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={mobile ? 'mobile-card bg-white w-full max-w-lg max-h-[90vh] overflow-y-auto' : 'bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto'}>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Compose Message</h2>
            <form onSubmit={handleSendMessage} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  To
                </label>
                <select
                  value={composeRecipient}
                  onChange={(e) => setComposeRecipient(e.target.value)}
                  className={mobile ? 'mobile-input' : 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'}
                >
                  <option value="">All Members (Broadcast)</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name} ({user.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subject *
                </label>
                <input
                  type="text"
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  className={mobile ? 'mobile-input' : 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'}
                  placeholder="Enter subject..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Message *
                </label>
                <textarea
                  value={composeContent}
                  onChange={(e) => setComposeContent(e.target.value)}
                  rows={6}
                  className={mobile ? 'mobile-input' : 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'}
                  placeholder="Type your message..."
                  required
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCompose(false)}
                  disabled={sending}
                  className={mobile ? 'mobile-button mobile-button-secondary flex-1' : 'flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300'}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sending}
                  className={mobile ? 'mobile-button mobile-button-primary flex-1' : 'flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700'}
                >
                  {sending ? 'Sending...' : 'Send'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Message Detail Modal */}
      {selectedMessage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={mobile ? 'mobile-card bg-white w-full max-w-lg max-h-[90vh] overflow-y-auto' : 'bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto'}>
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {selectedMessage.subject}
              </h2>
              <p className="text-sm text-gray-600">
                {selectedMessage.sender_id === currentUserId ? (
                  <>
                    To: {selectedMessage.recipient_id ? selectedMessage.recipient?.full_name : 'All Members'}
                  </>
                ) : (
                  <>
                    From: {selectedMessage.sender.full_name} ({selectedMessage.sender.email})
                  </>
                )}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {new Date(selectedMessage.created_at).toLocaleString()}
              </p>
            </div>
            
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <p className="text-gray-800 whitespace-pre-wrap">
                {selectedMessage.content}
              </p>
            </div>

            <button
              onClick={() => setSelectedMessage(null)}
              className={mobile ? 'mobile-button mobile-button-secondary w-full' : 'w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300'}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Send, AlertCircle, Eye } from 'lucide-react';
import { messagesService, membersService, Member } from '../../lib/database';
import { useAuth } from '../../contexts/AuthContext';

interface MessageFormProps {
  onBack: () => void;
}

export const MessageForm: React.FC<MessageFormProps> = ({ onBack }) => {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    send_to: 'All',
    subject: '',
    body: '',
    is_important: false,
  });
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    try {
      const data = await membersService.getMembers();
      setMembers(data.filter(m => m.status === 'active'));
    } catch (error) {
      console.error('Error loading members:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.subject.trim() || !formData.body.trim()) {
      alert('Subject and Message are required');
      return;
    }

    if (formData.body.trim().length < 10) {
      alert('Message must be at least 10 characters');
      return;
    }

    setSending(true);
    try {
      await messagesService.createMessage({
        subject: formData.subject.trim(),
        body: formData.body.trim(),
        send_to: formData.send_to,
        is_important: formData.is_important,
        sent_by: user?.id || '',
        sent_date: new Date().toISOString(),
      });

      setSuccess(true);
      const recipientCount = getRecipientCount();
      setTimeout(() => {
        alert(`Message sent to ${recipientCount} members`);
        onBack();
      }, 1500);
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const getRecipientCount = (): number => {
    if (formData.send_to === 'All') {
      return members.length;
    }
    return members.filter(m => m.voice_part === formData.send_to.toLowerCase()).length;
  };

  const getRecipientLabel = (): string => {
    if (formData.send_to === 'All') return 'All Members';
    if (formData.send_to === 'Soprano') return 'Soprano Section';
    if (formData.send_to === 'Alto') return 'Alto Section';
    if (formData.send_to === 'Tenor') return 'Tenor Section';
    if (formData.send_to === 'Bass') return 'Bass Section';
    return 'Select Recipients';
  };

  const characterCount = formData.body.length;
  const isContentValid = characterCount >= 10;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="bg-white rounded-xl shadow-md p-6 mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-blue-900 font-semibold hover:text-blue-700 mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Messages
        </button>

        <h2 className="text-2xl font-bold text-blue-900 mb-2">Send New Message</h2>
        <p className="text-gray-600">Send a message to all members or specific sections</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-lg font-bold text-blue-900 mb-4">Message Details</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Recipients <span className="text-red-600">*</span>
                  </label>
                  <select
                    value={formData.send_to}
                    onChange={e => setFormData({ ...formData, send_to: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="All">All Members ({members.length})</option>
                    <option value="Soprano">
                      Soprano Section ({members.filter(m => m.voice_part === 'soprano').length})
                    </option>
                    <option value="Alto">
                      Alto Section ({members.filter(m => m.voice_part === 'alto').length})
                    </option>
                    <option value="Tenor">
                      Tenor Section ({members.filter(m => m.voice_part === 'tenor').length})
                    </option>
                    <option value="Bass">
                      Bass Section ({members.filter(m => m.voice_part === 'bass').length})
                    </option>
                  </select>
                  <p className="text-sm text-gray-500 mt-1">
                    Will be sent to {getRecipientCount()} active members
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Subject <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.subject}
                    onChange={e => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter message subject..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Message <span className="text-red-600">*</span>
                  </label>
                  <textarea
                    value={formData.body}
                    onChange={e => setFormData({ ...formData, body: e.target.value })}
                    rows={10}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    placeholder="Type your message here..."
                    required
                  />
                  <div className="flex items-center justify-between mt-2">
                    <p
                      className={`text-sm ${
                        isContentValid ? 'text-gray-500' : 'text-red-600 font-semibold'
                      }`}
                    >
                      {characterCount} characters {!isContentValid && '(minimum 10)'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                  <input
                    type="checkbox"
                    id="is_important"
                    checked={formData.is_important}
                    onChange={e => setFormData({ ...formData, is_important: e.target.checked })}
                    className="w-5 h-5 text-blue-900 rounded focus:ring-2 focus:ring-blue-500 mt-0.5"
                  />
                  <div className="flex-1">
                    <label htmlFor="is_important" className="text-sm font-semibold text-gray-700 cursor-pointer flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-600" />
                      Mark as Important
                    </label>
                    <p className="text-xs text-gray-600 mt-1">
                      Important messages appear at the top of member inboxes
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-md p-6 flex gap-4">
              <button
                type="button"
                onClick={onBack}
                className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={sending || !isContentValid}
                className="flex-1 bg-blue-900 text-white py-3 rounded-lg font-semibold hover:bg-blue-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5" />
                {sending ? 'Sending...' : 'Send Message'}
              </button>
            </div>
          </form>
        </div>

        <div>
          <div className="bg-white rounded-xl shadow-md p-6 sticky top-6">
            <h3 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Preview
            </h3>
            <p className="text-sm text-gray-600 mb-4">How members will see this message</p>

            <div className="border-2 border-gray-200 rounded-xl p-5 bg-gray-50">
              <div className="flex items-start gap-3 mb-4">
                {formData.is_important && (
                  <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1 whitespace-nowrap">
                    <AlertCircle className="w-3 h-3" />
                    Important
                  </span>
                )}
              </div>

              <h4 className="text-xl font-bold text-blue-900 mb-3">
                {formData.subject || 'Subject will appear here'}
              </h4>

              <div className="flex items-center gap-3 text-sm text-gray-600 mb-4 pb-4 border-b border-gray-300">
                <span className="font-semibold">From: {user?.name || 'Admin'}</span>
                <span>•</span>
                <span>To: {getRecipientLabel()}</span>
              </div>

              <div className="prose prose-sm max-w-none">
                <p className="text-gray-700 whitespace-pre-wrap">
                  {formData.body || 'Your message will appear here...'}
                </p>
              </div>

              {!formData.body && (
                <div className="mt-4 text-center">
                  <p className="text-sm text-gray-400 italic">
                    Start typing to see a preview
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {success && (
        <div className="fixed bottom-4 right-4 bg-green-600 text-white px-6 py-4 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in z-50">
          <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center">
            <span className="text-green-600 text-sm">✓</span>
          </div>
          Message sent successfully!
        </div>
      )}
    </div>
  );
};

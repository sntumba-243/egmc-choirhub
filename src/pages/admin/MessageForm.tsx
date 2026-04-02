import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { useChurch } from '../../contexts/ChurchContext';
import { useAuth } from '../../contexts/AuthContext';

export const MessageForm: React.FC = () => {
  const navigate = useNavigate();
  const { church } = useChurch();
  const { user } = useAuth();
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [recipientType, setRecipientType] = useState('all');
  const [loading, setLoading] = useState(false);
  const [isImportant, setIsImportant] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('messages')
        .insert([{
          subject,
          body: content,
          send_to: recipientType,
          recipients: recipientType,
          is_important: isImportant,
          is_read: false,
          created_at: new Date().toISOString(),
          sent_date: new Date().toISOString(),
          church_id: church?.id
        }]);

      if (error) throw error;
      toast.success('Message sent successfully');
      navigate('/admin/messages');
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast.error(error.message || 'Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/admin/messages')}
          className="flex items-center gap-1 text-blue-500 text-[15px] font-medium"
        >
          <ArrowLeft className="w-5 h-5" strokeWidth={2.5} />
          Messages
        </button>
        <h1 className="text-[17px] font-bold text-gray-900">New Message</h1>
        <div className="w-20" />
      </div>

      {/* Form Card */}
      <form onSubmit={handleSubmit}>
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-gray-200/60 shadow-sm overflow-hidden">
          {/* Recipients */}
          <div className="px-4 py-3 border-b border-gray-100">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">To *</label>
            <select
              value={recipientType}
              onChange={(e) => setRecipientType(e.target.value)}
              required
              className="w-full mt-1 text-[15px] text-gray-900 bg-transparent border-0 p-0 focus:ring-0 cursor-pointer"
            >
              <option value="all">All Members</option>
              <option value="soprano">Soprano Section</option>
              <option value="alto">Alto Section</option>
              <option value="tenor">Tenor Section</option>
              <option value="bass">Bass Section</option>
            </select>
          </div>

          {/* Subject */}
          <div className="px-4 py-3 border-b border-gray-100">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Subject *</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              placeholder="What is this about?"
              className="w-full mt-1 text-[15px] text-gray-900 font-medium bg-transparent border-0 p-0 focus:ring-0 placeholder-gray-300"
            />
          </div>

          {/* Message body */}
          <div className="px-4 py-3">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Message *</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              rows={6}
              placeholder="Type your message..."
              className="w-full mt-1 text-[15px] text-gray-900 bg-transparent border-0 p-0 focus:ring-0 placeholder-gray-300 resize-none"
            />
          </div>
        </div>

        {/* Important toggle */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-gray-200/60 shadow-sm overflow-hidden mt-3">
          <label className="flex items-center justify-between px-4 py-3 cursor-pointer">
            <div>
              <span className="text-[14px] font-semibold text-gray-900">Mark as Important</span>
              <p className="text-xs text-gray-400">Shows a red badge to recipients</p>
            </div>
            <div className={`relative w-12 h-7 rounded-full transition-colors ${isImportant ? 'bg-red-500' : 'bg-gray-300'}`}>
              <div className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${isImportant ? 'translate-x-5' : ''}`} />
              <input type="checkbox" checked={isImportant} onChange={(e) => setIsImportant(e.target.checked)} className="sr-only" />
            </div>
          </label>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 mt-5">
          <button
            type="button"
            onClick={() => navigate('/admin/messages')}
            className="flex-1 py-3 bg-white/80 backdrop-blur-xl text-gray-600 rounded-2xl text-[15px] font-medium border border-gray-200/60 hover:bg-gray-50 transition-all active:scale-[0.98]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !subject || !content}
            className="flex-1 py-3 bg-blue-500 text-white rounded-2xl text-[15px] font-semibold hover:bg-blue-600 shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? 'Sending...' : (
              <>
                <Send className="w-4 h-4" />
                Send
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

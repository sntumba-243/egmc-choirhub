import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

export const MessageCompose = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    setLoading(true);

    try {
      // Get member name
      const { data: member } = await supabase
        .from('members')
        .select('first_name, last_name')
        .eq('id', user.id)
        .single();

      const senderName = member ? `${member.first_name} ${member.last_name}` : 'Member';

      const { error } = await supabase
        .from('messages')
        .insert({
          subject,
          body,
          send_to: 'admin',
          recipients: senderName,
          is_important: false,
          is_read: false,
          created_at: new Date().toISOString(),
          sent_date: new Date().toISOString(),
          admin_id: user.id,
        });

      if (error) throw error;
      toast.success('Message sent to admin');
      navigate('/member/messages');
    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.message || 'Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 pb-4">
      <button
        onClick={() => navigate('/member/messages')}
        className="flex items-center gap-1 text-blue-500 text-[15px] font-medium"
      >
        <ArrowLeft className="w-5 h-5" strokeWidth={2.5} />
        Messages
      </button>

      <h1 className="text-xl font-bold text-gray-900">Message Admin</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">To</label>
          <p className="text-[14px] text-gray-900 mt-0.5">Admin Team</p>
        </div>

        <div className="px-4 py-3 border-b border-gray-100">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Subject *</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
            placeholder="What is this about?"
            className="w-full mt-1 text-[14px] text-gray-900 bg-transparent border-0 p-0 focus:ring-0 placeholder-gray-300"
          />
        </div>

        <div className="px-4 py-3">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Message *</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            rows={6}
            placeholder="Type your message..."
            className="w-full mt-1 text-[14px] text-gray-900 bg-transparent border-0 p-0 focus:ring-0 placeholder-gray-300 resize-none"
          />
        </div>
      </form>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => navigate('/member/messages')}
          className="flex-1 py-2.5 bg-white text-gray-600 rounded-xl text-[14px] font-medium border border-gray-200"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading || !subject || !body}
          className="flex-1 py-2.5 bg-blue-500 text-white rounded-xl text-[14px] font-semibold hover:bg-blue-600 shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? 'Sending...' : (
            <>
              <Send className="w-4 h-4" />
              Send
            </>
          )}
        </button>
      </div>
    </div>
  );
};

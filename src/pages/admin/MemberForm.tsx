import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, Lock, AlertCircle, Eye, EyeOff, Copy, KeyRound, Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { useChurch } from '../../contexts/ChurchContext';
import { generateMemorablePassword } from '../../lib/passwordUtils';
import { PasswordModal } from '../../components/PasswordModal';

export const MemberForm: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isSuperAdmin = user?.is_super_admin === true;
  const { church } = useChurch();
  const [searchParams] = useSearchParams();
  const churchIdParam = searchParams.get('church_id');
  const { id: memberId } = useParams();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [voicePart, setVoicePart] = useState('');
  const [role, setRole] = useState('member');
  const [status, setStatus] = useState('active');
  const [loading, setLoading] = useState(false);
  const [createAuthAccount, setCreateAuthAccount] = useState(true);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState<string>("");
  const [inlinePassword, setInlinePassword] = useState<string>('');
  const [showInlinePassword, setShowInlinePassword] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [sendingResetEmail, setSendingResetEmail] = useState(false);

  useEffect(() => {
    if (memberId) {
      loadMember();
      setCreateAuthAccount(false);
    }
  }, [memberId]);

  const loadMember = async () => {
    try {
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .eq('id', memberId)
        .single();

      if (error) throw error;
      if (data) {
        setFirstName(data.first_name || '');
        setLastName(data.last_name || '');
        setEmail(data.email);
        setPhone(data.phone || '');
        setVoicePart(data.voice_part || '');
        setRole(data.role || 'member');
        setStatus(data.status || 'active');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load member');
    }
  };

  const generateMemberId = (first: string, last: string): string => {
    const firstInitial = first.charAt(0).toUpperCase();
    const cleanLast = last.charAt(0).toUpperCase() + last.slice(1).toLowerCase().replace(/\s+/g, '');
    return `${firstInitial}${cleanLast}`;
  };

  const createAuthUser = async (email: string, password: string, userRole: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const churchId = churchIdParam || church?.id;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-member`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            password,
            name: `${firstName} ${lastName}`.trim(),
            role: userRole,
            voice_part: voicePart,
            status: 'active',
            church_id: churchId,
          }),
        }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to create auth account');
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Auth creation error:', error);
      throw error;
    }
  };

  const handleSendResetEmail = async () => {
    if (!email) return;
    setSendingResetEmail(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      toast.success('Reset email sent to ' + email);
    } catch (error: any) {
      console.error('Reset email error:', error);
      toast.error(error.message || 'Failed to send reset email');
    } finally {
      setSendingResetEmail(false);
    }
  };

  const handleGeneratePassword = async () => {
    setResettingPassword(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');

      // Look up the auth user_id from the users table by email
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single();
      if (userError || !userData) throw new Error('No auth account found for this member');

      const newPassword = generateMemorablePassword();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reset-password`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ user_id: userData.id, new_password: newPassword }),
        }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to reset password');
      }

      setInlinePassword(newPassword);
      setShowInlinePassword(true);
      toast.success('New password generated');
    } catch (error: any) {
      console.error('Generate password error:', error);
      toast.error(error.message || 'Failed to generate password');
    } finally {
      setResettingPassword(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!churchIdParam && !church?.id) {
        toast.error('No church selected');
        setLoading(false);
        return;
      }

      const memberData: any = {
        first_name: firstName,
        last_name: lastName,
        member_id: generateMemberId(firstName, lastName),
        email,
        phone,
        voice_part: voicePart,
        role,
        status,
        church_id: churchIdParam || church?.id,
      };

      if (memberId) {
        const { church_id, ...updateData } = memberData;
        const { error } = await supabase
          .from('members')
          .update(updateData)
          .eq('id', memberId);
        if (error) throw error;
        toast.success('Member updated');
        navigate(isSuperAdmin ? '/super-admin/members' : '/admin/members');
      } else {
        let authUserId: string | null = null;

        if (createAuthAccount) {
          try {
            const newPassword = generateMemorablePassword();
            setGeneratedPassword(newPassword);
            const authUser = await createAuthUser(email, newPassword, role);
            authUserId = authUser?.id || null;
          } catch (authError: any) {
            console.error('Auth creation failed:', authError);
            toast.error(`Auth account failed: ${authError.message}`);
            setLoading(false);
            return;
          }
        }

        // Add user_id if auth account was created
        if (authUserId) {
          // auth user created, member will be linked by email
        }

        const { error } = await supabase
          .from('members')
          .insert([memberData]);
        if (error) throw error;

        // Sync to public.users table so the auth user has a corresponding row
        if (authUserId) {
          const { error: usersError } = await supabase.from('users').upsert({
            id: authUserId,
            email,
            name: `${firstName} ${lastName}`.trim(),
            role,
            church_id: churchIdParam || church?.id,
          }, { onConflict: 'id' });
          if (usersError) {
            console.error('Failed to sync user to users table:', usersError);
            toast.error(`User sync failed: ${usersError.message}`);
          }
        }

        setShowPasswordModal(true);
      }
    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.message || 'Failed to save');
      setLoading(false);
    }
  };

  const handleClosePasswordModal = () => {
    setShowPasswordModal(false);
    setGeneratedPassword('');
    if (churchIdParam) {
      navigate(`/super-admin/churches/${churchIdParam}`);
    } else {
      navigate(isSuperAdmin ? '/super-admin/members' : '/admin/members');
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(isSuperAdmin ? '/super-admin/members' : '/admin/members')} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-3xl font-bold">{memberId ? 'Edit Member' : 'Add New Member'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-md p-6 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">First Name *</label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Last Name *</label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {firstName && lastName && (
          <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
            Member ID will be: <strong>{generateMemberId(firstName, lastName)}</strong>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 123-4567"
              className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Voice Part *</label>
          <select
            value={voicePart}
            onChange={(e) => setVoicePart(e.target.value)}
            required
            className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Select Voice Part</option>
            <option value="Soprano">Soprano</option>
            <option value="Alto">Alto</option>
            <option value="Tenor">Tenor</option>
            <option value="Bass">Bass</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
            <select 
              value={role} 
              onChange={(e) => setRole(e.target.value)} 
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="member">Member</option>
              <option value="guest">Guest</option>
              <option value="section leader">Section Leader</option>
              <option value="admin">Admin</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {role === 'admin' && '👑 Full access to admin features'}
              {role === 'member' && '👤 Regular choir member access'}
              {role === 'guest' && '👤 Temporary member access'}
              {role === 'section leader' && '📋 Can lead their section'}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select 
              value={status} 
              onChange={(e) => setStatus(e.target.value)} 
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {memberId && (
          <div className="border-t pt-6">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Password</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSendResetEmail}
                disabled={sendingResetEmail}
                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {sendingResetEmail ? 'Sending...' : 'Send reset email'}
              </button>
              <button
                type="button"
                onClick={handleGeneratePassword}
                disabled={resettingPassword}
                className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
              >
                <KeyRound className="w-4 h-4" />
                {resettingPassword ? 'Generating...' : 'Generate new password'}
              </button>
            </div>

            {inlinePassword && (
              <div className="mt-3 bg-gray-50 border border-gray-200 rounded-lg p-3 flex items-center gap-3">
                <code className="flex-1 text-sm font-mono">
                  {showInlinePassword ? inlinePassword : '••••••••••••'}
                </code>
                <button
                  type="button"
                  onClick={() => setShowInlinePassword(!showInlinePassword)}
                  className="p-1.5 text-gray-500 hover:text-gray-700 rounded"
                  title={showInlinePassword ? 'Hide password' : 'Show password'}
                >
                  {showInlinePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(inlinePassword);
                    toast.success('Password copied');
                  }}
                  className="p-1.5 text-gray-500 hover:text-gray-700 rounded"
                  title="Copy password"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {!memberId && (
          <div className="border-t pt-6">
            <div className="flex items-start gap-3 mb-4">
              <input
                type="checkbox"
                id="createAuth"
                checked={createAuthAccount}
                onChange={(e) => setCreateAuthAccount(e.target.checked)}
                className="mt-1 w-4 h-4 text-indigo-600 rounded focus:ring-2 focus:ring-indigo-500"
              />
              <div className="flex-1">
                <label htmlFor="createAuth" className="text-sm font-medium text-gray-700 cursor-pointer">
                  Create login account for this member
                </label>
                <p className="text-xs text-gray-500 mt-1">
                  If checked, member can login to the app immediately
                </p>
              </div>
            </div>

            {createAuthAccount && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Lock className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-yellow-900 mb-1">
                      Default Password Information
                    </h4>
                    <p className="text-xs text-yellow-800 mb-2">
                      Login credentials will be:
                    </p>
                    <div className="bg-white rounded p-2 border border-yellow-300 mb-2 font-mono text-xs">
                      <div><strong>Email:</strong> {email || '(enter email above)'}</div>
                      <div><strong>Password:</strong> {generatedPassword}</div>
                    </div>
                    <div className="flex items-start gap-2 text-xs text-yellow-800">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <p>
                        <strong>Member will be required to change password on first login.</strong>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-4 pt-4">
          <button
            type="button"
            onClick={() => navigate(isSuperAdmin ? '/super-admin/members' : '/admin/members')}
            className="flex-1 px-6 py-3 border text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-lg disabled:opacity-50 hover:bg-indigo-700"
          >
            {loading ? 'Saving...' : (memberId ? 'Update Member' : 'Add Member')}
          </button>
        </div>
      </form>

      <PasswordModal
        isOpen={showPasswordModal}
        email={email}
        password={generatedPassword}
        memberName={`${firstName} ${lastName}`}
        onClose={handleClosePasswordModal}
      />
    </div>
  );
};

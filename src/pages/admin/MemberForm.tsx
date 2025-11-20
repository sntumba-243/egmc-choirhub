import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, Lock, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { generateMemorablePassword } from '../../lib/passwordUtils';


export const MemberForm: React.FC = () => {
  const navigate = useNavigate();
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

  const [generatedPassword, setGeneratedPassword] = useState<string>("");
  useEffect(() => {
    if (memberId) {
      loadMember();
      setCreateAuthAccount(false); // Don't create auth for existing members
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
      // Create auth user using Supabase Admin API
      // Note: This requires admin privileges, so we'll use a workaround
      const { data: { user }, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role: userRole,
            force_password_change: true,
            first_login: true
          }
        }
      });

      if (error) throw error;
      
      if (user) {
        // Create/update profile with role and force password change flag
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: user.id,
            email: email,
            role: userRole,
            force_password_change: true,
            created_at: new Date().toISOString()
          });

        if (profileError) {
          console.error('Profile creation error:', profileError);
        }
      }

      return user;
    } catch (error) {
      console.error('Auth creation error:', error);
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const memberData = {
        first_name: firstName,
        last_name: lastName,
        member_id: generateMemberId(firstName, lastName),
        email,
        phone,
        voice_part: voicePart,
        role,
        status
      };

      if (memberId) {
        // UPDATE existing member
        const { error } = await supabase
          .from('members')
          .update(memberData)
          .eq('id', memberId);
        if (error) throw error;
        toast.success('Member updated');
      } else {
        // CREATE new member
        // Step 1: Create auth account if checkbox is checked
        if (createAuthAccount) {
          try {
      const newPassword = generateMemorablePassword();
      setGeneratedPassword(newPassword);
      await createAuthUser(email, newPassword, role);
            toast.success('Auth account created with default password');
          } catch (authError: any) {
            console.error('Auth creation failed:', authError);
            toast.error(`Member added, but auth account failed: ${authError.message}`);
          }
        }

        // Step 2: Create member record
        const { error } = await supabase
          .from('members')
          .insert([memberData]);
        if (error) throw error;
        
        toast.success(
          createAuthAccount 
            ? `Member added! Login: ${email} / ${generatedPassword}` 
            : 'Member added (no auth account)'
        );
      }

      navigate('/admin/members');
    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.message || 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/admin/members')} className="p-2 hover:bg-gray-100 rounded-lg">
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

        {/* Auth Account Creation */}
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
            onClick={() => navigate('/admin/members')}
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
    </div>
  );
};

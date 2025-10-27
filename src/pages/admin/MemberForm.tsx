import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, User, RefreshCw, Copy, Check } from 'lucide-react';
import { membersService, Member } from '../../lib/database';

interface MemberFormProps {
  memberId?: string;
  onBack: () => void;
  onSave?: () => void;
}

export const MemberForm: React.FC<MemberFormProps> = ({ memberId, onBack, onSave }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    member_id: '',
    voice_part: '',
    role: 'member',
    status: 'active',
    phone: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (memberId) {
      loadMember();
    }
  }, [memberId]);

  const loadMember = async () => {
    if (!memberId) return;
    setLoading(true);
    try {
      const members = await membersService.getMembers();
      const member = members.find(m => m.id === memberId);
      if (member) {
        setFormData({
          name: member.name,
          email: member.email,
          member_id: member.member_id || '',
          voice_part: member.voice_part || '',
          role: member.role,
          status: member.status,
          phone: member.phone || '',
          password: '',
        });
      }
    } catch (error) {
      console.error('Error loading member:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.email.trim() || !formData.voice_part) {
      alert('Name, Email, and Voice Part are required');
      return;
    }

    setSaving(true);
    try {
      if (memberId) {
        const memberData: Partial<Member> = {
          name: formData.name.trim(),
          email: formData.email.trim(),
          member_id: formData.member_id.trim() || undefined,
          voice_part: formData.voice_part as 'soprano' | 'alto' | 'tenor' | 'bass',
          role: formData.role as 'admin' | 'member',
          status: formData.status as 'active' | 'inactive',
          phone: formData.phone.trim() || undefined,
        };
        await membersService.updateMember(memberId, memberData);
      } else {
        const memberData = {
          name: formData.name.trim(),
          email: formData.email.trim(),
          voice_part: formData.voice_part as 'soprano' | 'alto' | 'tenor' | 'bass',
          role: formData.role as 'admin' | 'member',
          status: formData.status as 'active' | 'inactive',
          phone: formData.phone.trim() || undefined,
          password: formData.password || undefined,
        };
        const result = await membersService.createMember(memberData);

        if (result.password) {
          setGeneratedPassword(result.password);
          setShowPassword(true);
        }
      }

      setSuccess(true);
      if (onSave) {
        onSave();
      }

      if (!generatedPassword) {
        setTimeout(() => {
          onBack();
        }, 1500);
      }
    } catch (error) {
      console.error('Error saving member:', error);
      alert('Failed to save member');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-600">Loading member...</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-xl shadow-md p-6 mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-blue-900 font-semibold hover:text-blue-700 mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Members
        </button>

        <h2 className="text-2xl font-bold text-blue-900 mb-2">
          {memberId ? 'Edit Member' : 'Add New Member'}
        </h2>
        <p className="text-gray-600">
          {memberId ? 'Update member information' : 'Add a new member to the choir'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2">
            <User className="w-5 h-5" />
            Member Information
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Email <span className="text-red-600">*</span>
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Member ID <span className="text-gray-500 text-xs">(auto-generated)</span>
              </label>
              <input
                type="text"
                value={formData.member_id}
                onChange={e => setFormData({ ...formData, member_id: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '') })}
                placeholder="e.g., jsmith"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
              />
              <p className="text-xs text-gray-500 mt-1">
                Member ID can be used for login instead of email. Format: firstinitiallastname
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Phone <span className="text-gray-500 text-xs">(optional)</span>
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                placeholder="(555) 123-4567"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {!memberId && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Password <span className="text-gray-500 text-xs">(leave blank for auto-generated)</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Enter password or leave blank"
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const newPassword = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10).toUpperCase() + '1!';
                      setFormData({ ...formData, password: newPassword });
                    }}
                    className="px-4 py-3 bg-blue-100 text-blue-900 rounded-lg hover:bg-blue-200 transition-colors flex items-center gap-2"
                    title="Generate password"
                  >
                    <RefreshCw className="w-5 h-5" />
                  </button>
                </div>
                {formData.password && (
                  <p className="text-xs text-gray-600 mt-2 bg-gray-50 p-2 rounded border border-gray-200">
                    <strong>Password:</strong> {formData.password}
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Voice Part <span className="text-red-600">*</span>
              </label>
              <select
                value={formData.voice_part}
                onChange={e => setFormData({ ...formData, voice_part: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Select voice part</option>
                <option value="soprano">Soprano</option>
                <option value="alto">Alto</option>
                <option value="tenor">Tenor</option>
                <option value="bass">Bass</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Role</label>
              <select
                value={formData.role}
                onChange={e => setFormData({ ...formData, role: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
              <select
                value={formData.status}
                onChange={e => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
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
            disabled={saving}
            className="flex-1 bg-blue-900 text-white py-3 rounded-lg font-semibold hover:bg-blue-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            {saving ? 'Saving...' : 'Save Member'}
          </button>
        </div>
      </form>

      {success && !showPassword && (
        <div className="fixed bottom-4 right-4 bg-green-600 text-white px-6 py-4 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in">
          <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center">
            <span className="text-green-600 text-sm">✓</span>
          </div>
          Member saved successfully!
        </div>
      )}

      {showPassword && generatedPassword && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-2xl font-bold text-blue-900 mb-2">Member Created!</h3>
              <p className="text-gray-600">Save this password - it won't be shown again</p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Generated Password
              </label>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-white px-4 py-3 rounded border border-gray-300 font-mono text-lg">
                  {generatedPassword}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(generatedPassword);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="px-4 py-3 bg-blue-900 text-white rounded-lg hover:bg-blue-800 transition-colors flex items-center gap-2"
                  title="Copy password"
                >
                  {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
              {copied && (
                <p className="text-xs text-green-600 mt-2">Password copied to clipboard!</p>
              )}
            </div>

            <div className="space-y-2 text-sm text-gray-600 mb-6">
              <p><strong>Email:</strong> {formData.email}</p>
              <p><strong>Member ID:</strong> {formData.member_id || 'Not set'}</p>
              <p className="text-xs text-gray-500 mt-4">
                The member can login using either their email or member ID with this password.
              </p>
            </div>

            <button
              onClick={() => {
                setShowPassword(false);
                onBack();
              }}
              className="w-full bg-blue-900 text-white py-3 rounded-lg font-semibold hover:bg-blue-800 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getDbClient, supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Church, ArrowLeft, Save, Upload, Image as ImageIcon, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { generateMemorablePassword } from '../../lib/passwordUtils';

export const ChurchForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const isEdit = !!id;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [adminEmail, setAdminEmail] = useState('');
  const [assigningAdmin, setAssigningAdmin] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [form, setForm] = useState({
    name: '',
    short_name: '',
    primary_color: '#1e40af',
    secondary_color: '#3b82f6',
    accent_color: '#f59e0b',
    address: '',
    city: '',
    country: '',
    timezone: 'UTC',
    pastor_name: '',
    contact_email: '',
    contact_phone: '',
  });

  useEffect(() => {
    if (isEdit) fetchChurch();
  }, [id]);

  const fetchChurch = async () => {
    setLoading(true);
    try {
      const supabase = getDbClient();
      const { data, error } = await supabase
        .from('churches')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      if (data) {
        setLogoUrl(data.logo_url || null);
        setLogoPreview(data.logo_url || null);
        setForm({
          name: data.name || '',
          short_name: data.short_name || '',
          primary_color: data.primary_color || '#1e40af',
          secondary_color: data.secondary_color || '#3b82f6',
          accent_color: data.accent_color || '#f59e0b',
          address: data.address || '',
          city: data.city || '',
          country: data.country || '',
          timezone: data.timezone || 'UTC',
          pastor_name: data.pastor_name || '',
          contact_email: data.contact_email || '',
          contact_phone: data.contact_phone || '',
        });
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load church');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.short_name) {
      toast.error('Name and short name are required');
      return;
    }

    setSaving(true);
    try {
      const supabase = getDbClient();
      let churchId = id;

      if (isEdit) {
        const { error } = await supabase
          .from('churches')
          .update({ ...form, logo_url: logoUrl, updated_at: new Date().toISOString() })
          .eq('id', id);
        if (error) throw error;
        toast.success('Church updated!');
      } else {
        const { data: insertData, error } = await supabase
          .from('churches')
          .insert([{ ...form, logo_url: logoUrl, created_by: user?.id }])
          .select();
        if (error) throw error;
        churchId = insertData?.[0]?.id;
        toast.success('Church created!');
      }

      // Assign admin if email provided
      if (adminEmail.trim() && churchId) {
        await assignAdmin(churchId);
      }

      if (!showPasswordModal) {
        navigate('/super-admin/churches');
      }
    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.message || 'Failed to save church');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('Logo must be under 2MB'); return; }
    if (!file.type.startsWith('image/')) { toast.error('Please upload an image'); return; }

    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
      reader.readAsDataURL(file);

      const ext = file.name.split('.').pop();
      const path = `church-logos/${id || 'new-' + Date.now()}/logo.${ext}`;
      const { error: uploadError } = await supabase.storage.from('church-assets').upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('church-assets').getPublicUrl(path);
      setLogoUrl(publicUrl);
      toast.success('Logo uploaded!');
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error('Failed to upload logo');
    } finally {
      setUploading(false);
    }
  };

  const assignAdmin = async (churchId: string) => {
    if (!adminEmail.trim()) return;
    setAssigningAdmin(true);
    try {
      const db = getDbClient();
      const email = adminEmail.trim().toLowerCase();
      
      // Check if user already exists
      const { data: existingUser } = await db
        .from('users')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (existingUser) {
        // User exists — add/promote as admin
        const { data: existingMember } = await db
          .from('members')
          .select('id, role')
          .eq('email', email)
          .eq('church_id', churchId)
          .maybeSingle();

        if (existingMember) {
          await db.from('members').update({ role: 'admin' }).eq('id', existingMember.id);
          toast.success(`${email} promoted to admin`);
        } else {
          await db.from('members').insert({
                        church_id: churchId,
            member_id: email.split('@')[0].charAt(0).toUpperCase() + 'Admin',
            role: 'admin',
            voice_part: 'Soprano',
            status: 'active'
          });
          toast.success(`${email} added as admin`);
        }
      } else {
        // User doesn't exist — create via Edge Function
        const password = generateMemorablePassword();
        
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error('Not authenticated');

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
              name: email.split('@')[0],
              role: 'admin',
              voice_part: 'Soprano',
              status: 'active',
              church_id: churchId,
            }),
          }
        );

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Failed to create admin account');
        }

        // Link to church via members table
        const result = await response.json();
        if (result.data?.id) {
          await db.from('members').insert({
                        church_id: churchId,
            role: 'admin',
            voice_part: 'Soprano',
            status: 'active',
              church_id: churchId,
          });
        }

        setGeneratedPassword(password);
        setShowPasswordModal(true);
        toast.success(`Admin account created for ${email}`);
      }
    } catch (error: any) {
      console.error('Admin assign error:', error);
      toast.error(error.message || 'Failed to assign admin');
    } finally {
      setAssigningAdmin(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto pb-8">
      <button
        onClick={() => navigate('/super-admin/churches')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 text-sm"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Churches
      </button>

      <div className="flex items-center gap-3 mb-6">
        <div className="bg-amber-100 p-2 rounded-lg">
          <Church className="w-6 h-6 text-amber-600" />
        </div>
        <h1 className="text-2xl font-bold">{isEdit ? 'Edit Church' : 'Add New Church'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Church Name *</label>
            <input type="text" value={form.name} onChange={(e) => handleChange('name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Short Name *</label>
            <input type="text" value={form.short_name} onChange={(e) => handleChange('short_name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500" required maxLength={10} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Pastor / Leader Name</label>
          <input type="text" value={form.pastor_name} onChange={(e) => handleChange('pastor_name', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
            <input type="email" value={form.contact_email} onChange={(e) => handleChange('contact_email', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone</label>
            <input type="tel" value={form.contact_phone} onChange={(e) => handleChange('contact_phone', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
          <input type="text" value={form.address} onChange={(e) => handleChange('address', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
            <input type="text" value={form.city} onChange={(e) => handleChange('city', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
            <input type="text" value={form.country} onChange={(e) => handleChange('country', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
            <select value={form.timezone} onChange={(e) => handleChange('timezone', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500">
              <option value="UTC">UTC</option>
              <option value="America/New_York">US Eastern</option>
              <option value="America/Chicago">US Central</option>
              <option value="America/Denver">US Mountain</option>
              <option value="America/Los_Angeles">US Pacific</option>
              <option value="Europe/London">UK / London</option>
              <option value="Europe/Paris">Europe / Paris</option>
              <option value="Europe/Berlin">Europe / Berlin</option>
              <option value="Africa/Lagos">Africa / Lagos</option>
              <option value="Africa/Johannesburg">Africa / Johannesburg</option>
              <option value="Africa/Nairobi">Africa / Nairobi</option>
              <option value="Africa/Kinshasa">Africa / Kinshasa</option>
              <option value="Africa/Lubumbashi">Africa / Lubumbashi</option>
              <option value="Asia/Tokyo">Asia / Tokyo</option>
              <option value="Australia/Sydney">Australia / Sydney</option>
            </select>
        </div>
        </div>

        {/* Assign Admin */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <span className="flex items-center gap-1.5"><UserPlus className="w-4 h-4" /> Assign Admin</span>
          </label>
          <input
            type="email"
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
            placeholder="admin@example.com"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-400 mt-1">Email of the person who will manage this church. They must have an account.</p>
        </div>

        {/* Church Logo */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Church Logo</label>
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden cursor-pointer hover:border-gray-400 transition"
              onClick={() => fileInputRef.current?.click()}
            >
              {logoPreview ? (
                <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <ImageIcon className="w-6 h-6 text-gray-300" />
              )}
            </div>
            <div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="text-sm font-medium px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                {uploading ? 'Uploading...' : 'Upload Logo'}
              </button>
              <p className="text-[10px] text-gray-400 mt-1">PNG or JPG, max 2MB</p>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Theme Colors</label>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Primary</label>
              <input type="color" value={form.primary_color} onChange={(e) => handleChange('primary_color', e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border-0" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Secondary</label>
              <input type="color" value={form.secondary_color} onChange={(e) => handleChange('secondary_color', e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border-0" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Accent</label>
              <input type="color" value={form.accent_color} onChange={(e) => handleChange('accent_color', e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border-0" />
            </div>
            <div className="w-20 h-8 rounded-lg" style={{ background: `linear-gradient(135deg, ${form.primary_color}, ${form.secondary_color})` }} />
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button type="submit" disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 disabled:bg-gray-400">
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : isEdit ? 'Update Church' : 'Create Church'}
          </button>
          <button type="button" onClick={() => navigate('/super-admin/churches')}
            className="px-6 py-2.5 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </form>
      {/* Generated Password Modal */}
      {showPasswordModal && generatedPassword && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl">
            <div className="text-center mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <UserPlus className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Admin Account Created</h3>
              <p className="text-sm text-gray-500 mt-1">Share these credentials with the admin</p>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4 space-y-3 mb-4">
              <div>
                <p className="text-xs text-gray-500 font-medium">Email</p>
                <p className="text-sm font-mono font-semibold text-gray-900">{adminEmail}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Temporary Password</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-mono font-semibold text-gray-900 bg-amber-50 px-2 py-1 rounded border border-amber-200">{generatedPassword}</p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(generatedPassword);
                      toast.success('Password copied!');
                    }}
                    className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded font-medium hover:bg-amber-200"
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>

            <p className="text-xs text-red-500 mb-4">⚠️ This password will not be shown again. Please save it now.</p>

            <button
              onClick={() => {
                setShowPasswordModal(false);
                setGeneratedPassword(null);
                navigate('/super-admin/churches');
              }}
              className="w-full py-2.5 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 text-sm"
            >
              Done — Go to Churches
            </button>
          </div>
        </div>
      )}
      {/* Generated Password Modal */}
      {showPasswordModal && generatedPassword && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl">
            <div className="text-center mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <UserPlus className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Admin Account Created</h3>
              <p className="text-sm text-gray-500 mt-1">Share these credentials with the admin</p>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4 space-y-3 mb-4">
              <div>
                <p className="text-xs text-gray-500 font-medium">Email</p>
                <p className="text-sm font-mono font-semibold text-gray-900">{adminEmail}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Temporary Password</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-mono font-semibold text-gray-900 bg-amber-50 px-2 py-1 rounded border border-amber-200">{generatedPassword}</p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(generatedPassword);
                      toast.success('Password copied!');
                    }}
                    className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded font-medium hover:bg-amber-200"
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>

            <p className="text-xs text-red-500 mb-4">⚠️ This password will not be shown again. Please save it now.</p>

            <button
              onClick={() => {
                setShowPasswordModal(false);
                setGeneratedPassword(null);
                navigate('/super-admin/churches');
              }}
              className="w-full py-2.5 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 text-sm"
            >
              Done — Go to Churches
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

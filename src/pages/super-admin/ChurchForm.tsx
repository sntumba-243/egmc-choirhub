import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getDbClient, supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Church, ArrowLeft, Save, Upload, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';

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
  const [form, setForm] = useState({
    name: '',
    short_name: '',
    primary_color: '#1e40af',
    secondary_color: '#3b82f6',
    accent_color: '#f59e0b',
    address: '',
    city: '',
    country: '',
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

      if (isEdit) {
        const { error } = await supabase
          .from('churches')
          .update({ ...form, logo_url: logoUrl, updated_at: new Date().toISOString() })
          .eq('id', id);
        if (error) throw error;
        toast.success('Church updated!');
      } else {
        const { error } = await supabase
          .from('churches')
          .insert([{ ...form, logo_url: logoUrl, created_by: user?.id }]);
        if (error) throw error;
        toast.success('Church created!');
      }

      navigate('/super-admin/churches');
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
    </div>
  );
};

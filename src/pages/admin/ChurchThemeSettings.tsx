import { useState, useEffect, useRef } from 'react';
import { Palette, Upload, Check, RotateCcw, Image as ImageIcon, Music } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useChurch } from '../../contexts/ChurchContext';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

const PRESET_THEMES = [
  {
    name: 'Royal Blue',
    primary: '#1e40af',
    secondary: '#3b82f6',
    accent: '#f59e0b',
    desc: 'Classic & trustworthy',
  },
  {
    name: 'Warm Earth',
    primary: '#78350f',
    secondary: '#b45309',
    accent: '#facc15',
    desc: 'Earthy & grounded',
  },
  {
    name: 'Deep Indigo',
    primary: '#312e81',
    secondary: '#6366f1',
    accent: '#fbbf24',
    desc: 'Rich & elegant',
  },
  {
    name: 'Rose Gold',
    primary: '#9f1239',
    secondary: '#e11d48',
    accent: '#d4a853',
    desc: 'Warm & refined',
  },
];

export const ChurchThemeSettings = () => {
  const { user } = useAuth();
  const { church, refreshChurch } = useChurch();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [primaryColor, setPrimaryColor] = useState('#3b82f6');
  const [secondaryColor, setSecondaryColor] = useState('#1e40af');
  const [accentColor, setAccentColor] = useState('#f59e0b');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    if (church) {
      setPrimaryColor(church.primary_color || '#3b82f6');
      setSecondaryColor(church.secondary_color || '#1e40af');
      setAccentColor(church.accent_color || '#f59e0b');
      setLogoUrl(church.logo_url);
      setLogoPreview(church.logo_url);
    }
  }, [church]);

  const applyPreview = (primary: string, secondary: string, accent: string) => {
    setPrimaryColor(primary);
    setSecondaryColor(secondary);
    setAccentColor(accent);
    const root = document.documentElement;
    root.style.setProperty('--church-primary', primary);
    root.style.setProperty('--church-secondary', secondary);
    root.style.setProperty('--church-accent', accent);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.church_id) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo must be under 2MB');
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
      reader.readAsDataURL(file);

      const ext = file.name.split('.').pop();
      const path = `church-logos/${user.church_id}/logo.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('church-assets')
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('church-assets')
        .getPublicUrl(path);

      setLogoUrl(publicUrl);
      toast.success('Logo uploaded!');
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error('Failed to upload logo');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user?.church_id) return;
    setSaving(true);

    try {
      const { error } = await supabase
        .from('churches')
        .update({
          primary_color: primaryColor,
          secondary_color: secondaryColor,
          accent_color: accentColor,
          logo_url: logoUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.church_id);

      if (error) throw error;

      await refreshChurch();
      toast.success('Theme saved successfully!');
    } catch (error: any) {
      console.error('Save error:', error);
      toast.error('Failed to save theme');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (church) {
      applyPreview(
        church.primary_color || '#3b82f6',
        church.secondary_color || '#1e40af',
        church.accent_color || '#f59e0b'
      );
      setLogoPreview(church.logo_url);
      setLogoUrl(church.logo_url);
      toast.success('Reset to saved theme');
    }
  };

  const isPresetActive = (t: typeof PRESET_THEMES[0]) =>
    primaryColor === t.primary && secondaryColor === t.secondary;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Palette className="w-5 h-5" style={{ color: primaryColor }} />
          Church Theme
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Customize the look and feel for your church. Changes apply to all members.
        </p>
      </div>

      {/* Logo Upload */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Church Logo</h2>
        <div className="flex items-center gap-5">
          <div
            className="w-20 h-20 rounded-2xl border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden cursor-pointer hover:border-gray-400 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            {logoPreview ? (
              <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <ImageIcon className="w-8 h-8 text-gray-300" />
            )}
          </div>
          <div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="text-sm font-semibold px-4 py-2 rounded-lg theme-btn disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5 inline mr-1.5" />
              {uploading ? 'Uploading...' : 'Upload Logo'}
            </button>
            <p className="text-xs text-gray-400 mt-2">PNG or JPG, max 2MB. Square works best.</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleLogoUpload}
            className="hidden"
          />
        </div>
      </div>

      {/* Preset Themes */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Choose a Theme</h2>
        <div className="grid grid-cols-2 gap-3">
          {PRESET_THEMES.map((theme) => {
            const active = isPresetActive(theme);
            return (
              <button
                key={theme.name}
                onClick={() => applyPreview(theme.primary, theme.secondary, theme.accent)}
                className={`relative p-4 rounded-xl border-2 transition-all text-left ${
                  active
                    ? 'border-gray-900 shadow-lg ring-1 ring-gray-900'
                    : 'border-gray-200 hover:border-gray-300 hover:shadow'
                }`}
              >
                {/* Mini sidebar preview */}
                <div className="flex items-center gap-2.5 mb-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})` }}
                  >
                    <Music className="w-4 h-4 text-white" />
                  </div>
                  <div
                    className="font-bold text-sm"
                    style={{
                      background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})`,
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}
                  >
                    {church?.short_name || 'ChoirHub'}
                  </div>
                </div>

                {/* Color swatches */}
                <div className="flex gap-1.5 mb-2">
                  <div className="w-6 h-6 rounded-full shadow-sm" style={{ background: theme.primary }} />
                  <div className="w-6 h-6 rounded-full shadow-sm" style={{ background: theme.secondary }} />
                  <div className="w-6 h-6 rounded-full shadow-sm" style={{ background: theme.accent }} />
                </div>

                {/* Nav preview bar */}
                <div className="flex gap-1.5 mb-2.5">
                  <div className="h-2 rounded-full flex-[2]" style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})` }} />
                  <div className="h-2 rounded-full bg-gray-100 flex-1" />
                  <div className="h-2 rounded-full bg-gray-100 flex-1" />
                </div>

                <p className="text-xs font-semibold text-gray-800">{theme.name}</p>
                <p className="text-[10px] text-gray-400">{theme.desc}</p>

                {active && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: theme.primary }}>
                    <Check className="w-3 h-3 text-white" strokeWidth={3} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom Colors */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Custom Colors</h2>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Primary', value: primaryColor, set: (v: string) => applyPreview(v, secondaryColor, accentColor) },
            { label: 'Secondary', value: secondaryColor, set: (v: string) => applyPreview(primaryColor, v, accentColor) },
            { label: 'Accent', value: accentColor, set: (v: string) => applyPreview(primaryColor, secondaryColor, v) },
          ].map((c) => (
            <div key={c.label}>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">{c.label}</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={c.value}
                  onChange={(e) => c.set(e.target.value)}
                  className="w-10 h-10 rounded-lg cursor-pointer border-0 p-0"
                />
                <input
                  type="text"
                  value={c.value}
                  onChange={(e) => c.set(e.target.value)}
                  className="flex-1 text-xs px-2.5 py-2 border border-gray-200 rounded-lg font-mono text-gray-700 focus:ring-1 focus:ring-gray-300 focus:border-gray-300 outline-none"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Live Preview */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Preview</h2>
        <div className="rounded-xl border border-gray-100 overflow-hidden">
          {/* Mock sidebar header */}
          <div className="bg-white p-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              {logoPreview ? (
                <img src={logoPreview} alt="Logo" className="w-10 h-10 rounded-lg object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}>
                  <Music className="w-5 h-5 text-white" />
                </div>
              )}
              <div>
                <div className="font-bold text-base" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  {church?.short_name || 'ChoirHub'}
                </div>
                <div className="text-xs text-gray-400">Admin Panel</div>
              </div>
            </div>
          </div>

          {/* Mock nav */}
          <div className="p-3 space-y-1.5 bg-gray-50">
            <div className="px-3 py-2.5 rounded-lg text-white text-sm font-medium flex items-center gap-2" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
              Dashboard
            </div>
            <div className="px-3 py-2.5 rounded-lg bg-white text-gray-600 text-sm font-medium flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
              Repertoire
            </div>
            <div className="px-3 py-2.5 rounded-lg bg-white text-gray-600 text-sm font-medium flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
              Members
            </div>
          </div>

          {/* Mock button */}
          <div className="p-3 bg-gray-50">
            <div className="text-center py-2.5 rounded-lg text-white text-sm font-semibold" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}>
              Save Changes
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-3 rounded-xl font-semibold theme-btn disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Saving...
            </>
          ) : (
            <><Check className="w-4 h-4" /> Save Theme</>
          )}
        </button>
        <button
          onClick={handleReset}
          className="px-6 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition flex items-center gap-2 text-sm"
        >
          <RotateCcw className="w-4 h-4" /> Reset
        </button>
      </div>
    </div>
  );
};

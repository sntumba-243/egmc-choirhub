import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useChurch } from '../../contexts/ChurchContext';
import { Music, Upload, Link as LinkIcon, Trash2, FileText, Loader2, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';

interface ChurchSong {
  id: string;
  title: string;
  composer: string;
  partition_url: string | null;
  created_at: string;
}

export default function ChurchSongs() {
  const { church } = useChurch();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload form
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadComposer, setUploadComposer] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // URL form
  const [urlInput, setUrlInput] = useState('');
  const [urlTitle, setUrlTitle] = useState('');
  const [urlComposer, setUrlComposer] = useState('');
  const [addingUrl, setAddingUrl] = useState(false);

  // Song list
  const [songs, setSongs] = useState<ChurchSong[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (church?.id) fetchSongs();
  }, [church?.id]);

  const fetchSongs = async () => {
    if (!church?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('songs')
        .select('id, title, composer, partition_url, created_at')
        .eq('church_id', church.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setSongs(data || []);
    } catch (error) {
      console.error('Error fetching church songs:', error);
      toast.error('Failed to load songs');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!church?.id || !uploadFile) return;
    setUploading(true);
    try {
      const ext = uploadFile.name.split('.').pop();
      const path = `${church.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('partitions')
        .upload(path, uploadFile, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('partitions').getPublicUrl(path);

      const { error: insertError } = await supabase.from('songs').insert({
        title: uploadTitle.trim(),
        composer: uploadComposer.trim(),
        church_id: church.id,
        partition_url: publicUrl,
      });
      if (insertError) throw insertError;

      toast.success('Song uploaded successfully');
      setUploadTitle('');
      setUploadComposer('');
      setUploadFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchSongs();
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error?.message || 'Failed to upload song');
    } finally {
      setUploading(false);
    }
  };

  const handleAddFromUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!church?.id || !urlInput.trim()) return;
    setAddingUrl(true);
    try {
      const { error } = await supabase.from('songs').insert({
        title: urlTitle.trim(),
        composer: urlComposer.trim(),
        church_id: church.id,
        partition_url: urlInput.trim(),
      });
      if (error) throw error;

      toast.success('Song added successfully');
      setUrlInput('');
      setUrlTitle('');
      setUrlComposer('');
      fetchSongs();
    } catch (error: any) {
      console.error('Add URL error:', error);
      toast.error(error?.message || 'Failed to add song');
    } finally {
      setAddingUrl(false);
    }
  };

  const handleDelete = async (songId: string) => {
    if (!confirm('Delete this song?')) return;
    try {
      const { error } = await supabase.from('songs').delete().eq('id', songId);
      if (error) throw error;
      setSongs(songs.filter(s => s.id !== songId));
      toast.success('Song deleted');
    } catch (error) {
      toast.error('Failed to delete song');
    }
  };

  const openPartition = (url: string) => {
    window.open(url, '_blank', 'noopener');
  };

  const inputClass = 'w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none';

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Church Songs</h1>
        <p className="text-sm text-gray-500 mt-1">Upload partitions and manage your church's song library.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Upload Partition */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Upload className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Upload your own partition</h2>
          </div>
          <form onSubmit={handleUpload} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Song title</label>
              <input type="text" value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} className={inputClass} placeholder="Amazing Grace" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Artist / Composer</label>
              <input type="text" value={uploadComposer} onChange={e => setUploadComposer(e.target.value)} className={inputClass} placeholder="John Newton" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">File (PDF, PNG, JPG, MusicXML)</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.musicxml,.mxl"
                onChange={e => setUploadFile(e.target.files?.[0] || null)}
                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                required
              />
            </div>
            <button type="submit" disabled={uploading} className="w-full bg-slate-800 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</> : <><Upload className="w-4 h-4" /> Upload Song</>}
            </button>
          </form>
        </div>

        {/* Pull from URL */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <LinkIcon className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-900">Pull from internet</h2>
          </div>
          <form onSubmit={handleAddFromUrl} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Song title</label>
              <input type="text" value={urlTitle} onChange={e => setUrlTitle(e.target.value)} className={inputClass} placeholder="How Great Thou Art" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Artist / Composer</label>
              <input type="text" value={urlComposer} onChange={e => setUrlComposer(e.target.value)} className={inputClass} placeholder="Carl Boberg" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Paste a link to sheet music (PDF or image)</label>
              <input type="url" value={urlInput} onChange={e => setUrlInput(e.target.value)} className={inputClass} placeholder="https://example.com/sheet-music.pdf" required />
            </div>
            <button type="submit" disabled={addingUrl} className="w-full bg-slate-800 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {addingUrl ? <><Loader2 className="w-4 h-4 animate-spin" /> Adding...</> : <><ExternalLink className="w-4 h-4" /> Add from URL</>}
            </button>
          </form>
        </div>
      </div>

      {/* Song List */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Your church songs</h2>
          <p className="text-sm text-gray-500">{songs.length} song{songs.length !== 1 ? 's' : ''}</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : songs.length === 0 ? (
          <div className="text-center py-12">
            <Music className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No church songs yet. Upload your first partition above.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {songs.map(song => (
              <div key={song.id} className="px-6 py-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{song.title}</p>
                  <p className="text-sm text-gray-500 truncate">{song.composer}</p>
                </div>
                {song.partition_url && (
                  <button
                    onClick={() => openPartition(song.partition_url!)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    View
                  </button>
                )}
                <button
                  onClick={() => handleDelete(song.id)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

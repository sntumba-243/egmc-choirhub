import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Link as LinkIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

export const SongForm: React.FC = () => {
  const navigate = useNavigate();
  const { id: songId } = useParams();
  const [title, setTitle] = useState('');
  const [composer, setComposer] = useState('');
  const [arranger, setArranger] = useState('');
  const [language, setLanguage] = useState('');
  const [sheetMusicUrl, setSheetMusicUrl] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (songId) {
      loadSong();
    }
  }, [songId]);

  const loadSong = async () => {
    try {
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .eq('id', songId)
        .single();

      if (error) throw error;
      if (data) {
        setTitle(data.title);
        setComposer(data.composer || '');
        setArranger(data.arranger || '');
        setLanguage(data.language || '');
        setSheetMusicUrl(data.sheet_music_url || '');
      }
    } catch (error) {
      console.error('Error loading song:', error);
      toast.error('Failed to load song');
    }
  };

  const convertToEmbedUrl = (url: string): string => {
    if (!url) return '';
    
    // Handle Google Drive URLs
    if (url.includes('drive.google.com')) {
      // Extract file ID from various Google Drive URL formats
      let fileId = '';
      
      if (url.includes('/file/d/')) {
        fileId = url.split('/file/d/')[1]?.split('/')[0];
      } else if (url.includes('id=')) {
        fileId = url.split('id=')[1]?.split('&')[0];
      }
      
      if (fileId) {
        // Return embed URL for Google Drive
        return `https://drive.google.com/file/d/${fileId}/preview`;
      }
    }
    
    // Return original URL if not a Google Drive link
    return url;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Convert to embed URL before saving
      const embedUrl = convertToEmbedUrl(sheetMusicUrl);
      
      const songData = {
        title,
        composer,
        arranger,
        language,
        sheet_music_url: embedUrl,
        updated_at: new Date().toISOString()
      };

      if (songId) {
        const { error } = await supabase
          .from('songs')
          .update(songData)
          .eq('id', songId);

        if (error) throw error;
        toast.success('Song updated successfully');
      } else {
        const { error } = await supabase
          .from('songs')
          .insert([{ ...songData, created_at: new Date().toISOString() }]);

        if (error) throw error;
        toast.success('Song added successfully');
      }

      navigate('/admin/repertoire');
    } catch (error: any) {
      console.error('Error saving song:', error);
      toast.error(error.message || 'Failed to save song');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/admin/repertoire')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-3xl font-bold text-gray-900">
          {songId ? 'Edit Song' : 'Add New Song'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-md p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Composer *</label>
            <input
              type="text"
              value={composer}
              onChange={(e) => setComposer(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Language *</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select Language</option>
              <option value="English">English</option>
              <option value="French">French</option>
              <option value="Latin">Latin</option>
              <option value="Swahili">Swahili</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Arranger</label>
            <input
              type="text"
              value={arranger}
              onChange={(e) => setArranger(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Google Drive Sheet Music Link
          </label>
          <div className="relative">
            <LinkIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="url"
              value={sheetMusicUrl}
              onChange={(e) => setSheetMusicUrl(e.target.value)}
              placeholder="https://drive.google.com/file/d/..."
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            📝 How to get the link: Open your file in Google Drive → Click Share → Set to "Anyone with the link" → Copy link
          </p>
        </div>

        {sheetMusicUrl && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Preview:</p>
            <div className="aspect-video bg-white rounded border border-gray-300">
              <iframe
                src={convertToEmbedUrl(sheetMusicUrl)}
                className="w-full h-full rounded"
                title="Sheet Music Preview"
              />
            </div>
          </div>
        )}

        <div className="flex gap-4 pt-4">
          <button
            type="button"
            onClick={() => navigate('/admin/repertoire')}
            className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:shadow-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                {songId ? 'Update Song' : 'Add Song'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

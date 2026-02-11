import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Music } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

export const SongForm: React.FC = () => {
  const navigate = useNavigate();
  const { id: songId } = useParams();
  const [title, setTitle] = useState('');
  const [composer, setComposer] = useState('');
  const [language, setLanguage] = useState('');
  const [sheetMusicUrl, setSheetMusicUrl] = useState('');
  const [learningStatus, setLearningStatus] = useState<'learned' | 'learning' | 'not_yet'>('not_yet');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (songId) loadSong();
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
        setLanguage(data.language || '');
        setSheetMusicUrl(data.sheet_music_url || '');
        setLearningStatus(data.learning_status || 'not_yet');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load song');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const songData = {
        title,
        composer,
        language,
        sheet_music_url: sheetMusicUrl,
        learning_status: learningStatus,
      };

      if (songId) {
        const { error } = await supabase
          .from('songs')
          .update(songData)
          .eq('id', songId);

        if (error) throw error;
        toast.success('Song updated');
      } else {
        const { error } = await supabase
          .from('songs')
          .insert([songData]);

        if (error) throw error;
        toast.success('Song created');
      }

      navigate('/admin/repertoire');
    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.message || 'Failed to save song');
    } finally {
      setLoading(false);
    }
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'learned':
        return {
          label: '✅ Learned',
          description: 'The choir has mastered this song',
          color: 'text-green-700 bg-green-50 border-green-200'
        };
      case 'learning':
        return {
          label: '📚 Learning',
          description: 'Currently practicing this song',
          color: 'text-yellow-700 bg-yellow-50 border-yellow-200'
        };
      case 'not_yet':
        return {
          label: '⏳ Not Yet',
          description: 'Haven\'t started learning this song',
          color: 'text-gray-700 bg-gray-50 border-gray-200'
        };
      default:
        return { label: '', description: '', color: '' };
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/admin/repertoire')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Repertoire
        </button>
        <h1 className="text-3xl font-bold text-gray-900">
          {songId ? 'Edit Song' : 'Add New Song'}
        </h1>
        <div className="w-32" />
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-md p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Song Title *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="e.g. Amazing Grace"
            className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Composer
          </label>
          <input
            type="text"
            value={composer}
            onChange={(e) => setComposer(e.target.value)}
            placeholder="e.g. John Newton"
            className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Language
          </label>
          <input
            type="text"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            placeholder="e.g. English, French, Latin"
            className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Sheet Music URL
          </label>
          <input
            type="url"
            value={sheetMusicUrl}
            onChange={(e) => setSheetMusicUrl(e.target.value)}
            placeholder="https://drive.google.com/..."
            className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500"
          />
          <p className="text-sm text-gray-500 mt-1">
            Link to Google Drive PDF or other sheet music file
          </p>
        </div>

        {/* Learning Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Learning Status
          </label>
          <div className="space-y-3">
            {/* Learned */}
            <label className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
              learningStatus === 'learned' 
                ? 'border-green-500 bg-green-50' 
                : 'border-gray-200 hover:border-green-300'
            }`}>
              <input
                type="radio"
                value="learned"
                checked={learningStatus === 'learned'}
                onChange={(e) => setLearningStatus(e.target.value as any)}
                className="w-4 h-4 text-green-600"
              />
              <div className="flex-1">
                <div className="font-medium text-gray-900">✅ Learned</div>
                <div className="text-sm text-gray-600">The choir has mastered this song</div>
              </div>
            </label>

            {/* Learning */}
            <label className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
              learningStatus === 'learning' 
                ? 'border-yellow-500 bg-yellow-50' 
                : 'border-gray-200 hover:border-yellow-300'
            }`}>
              <input
                type="radio"
                value="learning"
                checked={learningStatus === 'learning'}
                onChange={(e) => setLearningStatus(e.target.value as any)}
                className="w-4 h-4 text-yellow-600"
              />
              <div className="flex-1">
                <div className="font-medium text-gray-900">📚 Learning</div>
                <div className="text-sm text-gray-600">Currently practicing this song</div>
              </div>
            </label>

            {/* Not Yet */}
            <label className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
              learningStatus === 'not_yet' 
                ? 'border-gray-500 bg-gray-50' 
                : 'border-gray-200 hover:border-gray-300'
            }`}>
              <input
                type="radio"
                value="not_yet"
                checked={learningStatus === 'not_yet'}
                onChange={(e) => setLearningStatus(e.target.value as any)}
                className="w-4 h-4 text-gray-600"
              />
              <div className="flex-1">
                <div className="font-medium text-gray-900">⏳ Not Yet</div>
                <div className="text-sm text-gray-600">Haven't started learning this song</div>
              </div>
            </label>
          </div>
        </div>

        <div className="flex gap-4 pt-4">
          <button
            type="button"
            onClick={() => navigate('/admin/repertoire')}
            className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Saving...' : (songId ? 'Update Song' : 'Create Song')}
          </button>
        </div>
      </form>
    </div>
  );
};

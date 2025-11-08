import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { isMobile } from '../../utils/mobile-helpers';
import '../../styles/mobile-optimization.css';

interface Song {
  id: string;
  title: string;
  composer: string | null;
  language: 'english' | 'french';
  sheet_music_url: string | null;
  practice_track_url: string | null;
  created_at: string;
}

export function AdminRepertoire() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLanguage, setFilterLanguage] = useState<'all' | 'english' | 'french'>('all');
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    composer: '',
    language: 'english' as 'english' | 'french',
    sheet_music_url: '',
    practice_track_url: ''
  });
  const [saving, setSaving] = useState(false);

  const mobile = isMobile();

  useEffect(() => {
    loadSongs();
  }, []);

  async function loadSongs() {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('songs')
        .select('*')
        .order('title');

      if (fetchError) throw fetchError;
      setSongs(data || []);
    } catch (err) {
      console.error('Error loading songs:', err);
      setError('Failed to load songs');
    } finally {
      setLoading(false);
    }
  }

  function handleAddSong() {
    setFormData({
      title: '',
      composer: '',
      language: 'english',
      sheet_music_url: '',
      practice_track_url: ''
    });
    setShowAddModal(true);
  }

  function handleEditSong(song: Song) {
    setSelectedSong(song);
    setFormData({
      title: song.title,
      composer: song.composer || '',
      language: song.language,
      sheet_music_url: song.sheet_music_url || '',
      practice_track_url: song.practice_track_url || ''
    });
    setShowEditModal(true);
  }

  async function handleSaveAdd(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSaving(true);

      const { error: insertError } = await supabase
        .from('songs')
        .insert({
          title: formData.title.trim(),
          composer: formData.composer.trim() || null,
          language: formData.language,
          sheet_music_url: formData.sheet_music_url.trim() || null,
          practice_track_url: formData.practice_track_url.trim() || null
        });

      if (insertError) throw insertError;

      await loadSongs();
      setShowAddModal(false);
    } catch (err) {
      console.error('Error adding song:', err);
      setError('Failed to add song');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSong) return;

    try {
      setSaving(true);

      const { error: updateError } = await supabase
        .from('songs')
        .update({
          title: formData.title.trim(),
          composer: formData.composer.trim() || null,
          language: formData.language,
          sheet_music_url: formData.sheet_music_url.trim() || null,
          practice_track_url: formData.practice_track_url.trim() || null
        })
        .eq('id', selectedSong.id);

      if (updateError) throw updateError;

      await loadSongs();
      setShowEditModal(false);
      setSelectedSong(null);
    } catch (err) {
      console.error('Error updating song:', err);
      setError('Failed to update song');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteSong() {
    if (!selectedSong) return;

    try {
      const { error: deleteError } = await supabase
        .from('songs')
        .delete()
        .eq('id', selectedSong.id);

      if (deleteError) throw deleteError;

      await loadSongs();
      setShowDeleteConfirm(false);
      setShowEditModal(false);
      setSelectedSong(null);
    } catch (err) {
      console.error('Error deleting song:', err);
      setError('Failed to delete song');
    }
  }

  function getLanguageFlag(language: string) {
    return language === 'english' ? '🇬🇧' : '🇫🇷';
  }

  // Filter songs
  const filteredSongs = songs.filter(song => {
    const matchesSearch = 
      song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (song.composer && song.composer.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesLanguage = filterLanguage === 'all' || song.language === filterLanguage;

    return matchesSearch && matchesLanguage;
  });

  const stats = {
    total: songs.length,
    english: songs.filter(s => s.language === 'english').length,
    french: songs.filter(s => s.language === 'french').length,
    withSheetMusic: songs.filter(s => s.sheet_music_url).length,
    withPracticeTracks: songs.filter(s => s.practice_track_url).length
  };

  if (loading) {
    return (
      <div className={mobile ? 'mobile-container' : 'container mx-auto px-4 py-8'}>
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading repertoire...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={mobile ? 'mobile-container' : 'container mx-auto px-4 py-8'}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className={mobile ? 'text-2xl font-bold text-gray-900' : 'text-3xl font-bold text-gray-900'}>
          Repertoire
        </h1>
        <button
          onClick={handleAddSong}
          className={mobile ? 'mobile-button mobile-button-primary' : 'px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700'}
        >
          ➕ Add Song
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 text-red-600 hover:text-red-800 font-semibold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className={mobile ? 'grid grid-cols-2 gap-3 mb-4' : 'grid grid-cols-2 md:grid-cols-5 gap-4 mb-6'}>
        <div className={mobile ? 'mobile-card bg-blue-50' : 'bg-blue-50 rounded-lg p-4'}>
          <div className="text-2xl mb-1">🎵</div>
          <div className="text-2xl font-bold text-blue-800">{stats.total}</div>
          <div className="text-sm text-blue-600">Total Songs</div>
        </div>
        <div className={mobile ? 'mobile-card bg-green-50' : 'bg-green-50 rounded-lg p-4'}>
          <div className="text-2xl mb-1">🇬🇧</div>
          <div className="text-2xl font-bold text-green-800">{stats.english}</div>
          <div className="text-sm text-green-600">English</div>
        </div>
        <div className={mobile ? 'mobile-card bg-purple-50' : 'bg-purple-50 rounded-lg p-4'}>
          <div className="text-2xl mb-1">🇫🇷</div>
          <div className="text-2xl font-bold text-purple-800">{stats.french}</div>
          <div className="text-sm text-purple-600">French</div>
        </div>
        <div className={mobile ? 'mobile-card bg-yellow-50' : 'bg-yellow-50 rounded-lg p-4'}>
          <div className="text-2xl mb-1">📄</div>
          <div className="text-2xl font-bold text-yellow-800">{stats.withSheetMusic}</div>
          <div className="text-sm text-yellow-600">Sheet Music</div>
        </div>
        <div className={mobile ? 'mobile-card bg-pink-50' : 'bg-pink-50 rounded-lg p-4'}>
          <div className="text-2xl mb-1">🎧</div>
          <div className="text-2xl font-bold text-pink-800">{stats.withPracticeTracks}</div>
          <div className="text-sm text-pink-600">Practice Tracks</div>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by title or composer..."
          className={mobile ? 'mobile-input' : 'w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'}
        />
      </div>

      {/* Language Filter */}
      <div className={mobile ? 'mobile-tabs mb-4' : 'flex gap-2 mb-6'}>
        <button
          onClick={() => setFilterLanguage('all')}
          className={`${mobile ? 'mobile-tab' : 'px-4 py-2 rounded-lg'} ${
            filterLanguage === 'all'
              ? mobile ? 'mobile-tab-active' : 'bg-blue-600 text-white'
              : mobile ? '' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilterLanguage('english')}
          className={`${mobile ? 'mobile-tab' : 'px-4 py-2 rounded-lg'} ${
            filterLanguage === 'english'
              ? mobile ? 'mobile-tab-active' : 'bg-blue-600 text-white'
              : mobile ? '' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          🇬🇧 English
        </button>
        <button
          onClick={() => setFilterLanguage('french')}
          className={`${mobile ? 'mobile-tab' : 'px-4 py-2 rounded-lg'} ${
            filterLanguage === 'french'
              ? mobile ? 'mobile-tab-active' : 'bg-blue-600 text-white'
              : mobile ? '' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          🇫🇷 French
        </button>
      </div>

      {/* Songs List */}
      <div className="mb-4 text-sm text-gray-600">
        Showing {filteredSongs.length} of {songs.length} songs
      </div>

      {filteredSongs.length === 0 ? (
        <div className={mobile ? 'mobile-card' : 'bg-white rounded-lg shadow-md p-8'}>
          <div className="text-center text-gray-500">
            <p className="text-4xl mb-3">🎵</p>
            <p className="text-lg">No songs found</p>
            <p className="text-sm mt-2">
              {searchQuery ? 'Try a different search' : 'Add your first song to get started'}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSongs.map((song) => (
            <div
              key={song.id}
              onClick={() => handleEditSong(song)}
              className={mobile ? 'mobile-card cursor-pointer hover:shadow-lg transition-shadow' : 'bg-white rounded-lg shadow-md p-4 cursor-pointer hover:shadow-lg transition-shadow'}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="text-2xl flex-shrink-0">
                    {getLanguageFlag(song.language)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 mb-1">
                      {song.title}
                    </p>
                    {song.composer && (
                      <p className="text-sm text-gray-600 mb-2">
                        by {song.composer}
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      {song.sheet_music_url && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          📄 Sheet Music
                        </span>
                      )}
                      {song.practice_track_url && (
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                          🎧 Practice Track
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button className="text-gray-400 hover:text-gray-600 flex-shrink-0">
                  ✏️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={mobile ? 'mobile-card bg-white w-full max-w-lg max-h-[90vh] overflow-y-auto' : 'bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto'}>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Add New Song</h2>
            <form onSubmit={handleSaveAdd} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className={mobile ? 'mobile-input' : 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500'}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Composer
                </label>
                <input
                  type="text"
                  value={formData.composer}
                  onChange={(e) => setFormData({ ...formData, composer: e.target.value })}
                  className={mobile ? 'mobile-input' : 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500'}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Language *
                </label>
                <select
                  value={formData.language}
                  onChange={(e) => setFormData({ ...formData, language: e.target.value as 'english' | 'french' })}
                  className={mobile ? 'mobile-input' : 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500'}
                >
                  <option value="english">English</option>
                  <option value="french">French</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sheet Music URL
                </label>
                <input
                  type="url"
                  value={formData.sheet_music_url}
                  onChange={(e) => setFormData({ ...formData, sheet_music_url: e.target.value })}
                  className={mobile ? 'mobile-input' : 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500'}
                  placeholder="https://..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Practice Track URL
                </label>
                <input
                  type="url"
                  value={formData.practice_track_url}
                  onChange={(e) => setFormData({ ...formData, practice_track_url: e.target.value })}
                  className={mobile ? 'mobile-input' : 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500'}
                  placeholder="https://..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  disabled={saving}
                  className={mobile ? 'mobile-button mobile-button-secondary flex-1' : 'flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300'}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className={mobile ? 'mobile-button mobile-button-primary flex-1' : 'flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700'}
                >
                  {saving ? 'Adding...' : 'Add Song'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedSong && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={mobile ? 'mobile-card bg-white w-full max-w-lg max-h-[90vh] overflow-y-auto' : 'bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto'}>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Edit Song</h2>
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className={mobile ? 'mobile-input' : 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500'}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Composer
                </label>
                <input
                  type="text"
                  value={formData.composer}
                  onChange={(e) => setFormData({ ...formData, composer: e.target.value })}
                  className={mobile ? 'mobile-input' : 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500'}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Language *
                </label>
                <select
                  value={formData.language}
                  onChange={(e) => setFormData({ ...formData, language: e.target.value as 'english' | 'french' })}
                  className={mobile ? 'mobile-input' : 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500'}
                >
                  <option value="english">English</option>
                  <option value="french">French</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sheet Music URL
                </label>
                <input
                  type="url"
                  value={formData.sheet_music_url}
                  onChange={(e) => setFormData({ ...formData, sheet_music_url: e.target.value })}
                  className={mobile ? 'mobile-input' : 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500'}
                  placeholder="https://..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Practice Track URL
                </label>
                <input
                  type="url"
                  value={formData.practice_track_url}
                  onChange={(e) => setFormData({ ...formData, practice_track_url: e.target.value })}
                  className={mobile ? 'mobile-input' : 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500'}
                  placeholder="https://..."
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedSong(null);
                  }}
                  disabled={saving}
                  className={mobile ? 'mobile-button mobile-button-secondary flex-1' : 'flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300'}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={saving}
                  className={mobile ? 'mobile-button bg-red-600 hover:bg-red-700 text-white' : 'px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700'}
                >
                  🗑️
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className={mobile ? 'mobile-button mobile-button-primary flex-1' : 'flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700'}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedSong && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={mobile ? 'mobile-card bg-white max-w-sm w-full' : 'bg-white rounded-lg p-6 max-w-sm w-full'}>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Delete Song?</h3>
            <p className="text-gray-600 mb-6">
              This will permanently delete "{selectedSong.title}". This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className={mobile ? 'mobile-button mobile-button-secondary flex-1' : 'flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300'}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteSong}
                className={mobile ? 'mobile-button bg-red-600 hover:bg-red-700 text-white flex-1' : 'flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700'}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

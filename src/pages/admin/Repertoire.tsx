import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Music, Search, Plus, Edit, Trash2, Grid3x3, List, Eye, Star, Calendar, X, ArrowUpAZ, ArrowDownAZ, SlidersHorizontal } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';

interface Song {
  id: string;
  title: string;
  composer: string;
  language: string;
  sheet_music_url?: string;
  created_at?: string;
  learning_status?: 'learned' | 'learning' | 'not_yet';
}

interface Event {
  id: string;
  title: string;
  date: string;
  type: string;
}

export const AdminRepertoire = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [selectedSongs, setSelectedSongs] = useState<Set<string>>(new Set());
  const [showEventModal, setShowEventModal] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [sortBy, setSortBy] = useState<'a-z' | 'z-a' | 'recent' | 'language'>('a-z');
  const [languageFilter, setLanguageFilter] = useState<'all' | 'english' | 'french' | 'portuguese' | 'lingala' | 'tshiluba' | 'kikongo' | 'swahili'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'learned' | 'learning' | 'not_yet'>('all');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchSongs();
    fetchFavorites();
    fetchUpcomingEvents();
  }, []);

  const fetchSongs = async () => {
    try {
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .order('title', { ascending: true });

      if (error) throw error;
      console.log('Loaded songs:', data?.length);
      setSongs(data || []);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load songs');
    } finally {
      setLoading(false);
    }
  };

  const fetchFavorites = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('user_favorites')
        .select('song_id')
        .eq('user_id', user.id);

      if (error) throw error;
      const favSet = new Set(data?.map(f => f.song_id) || []);
      setFavorites(favSet);
    } catch (error) {
      console.error('Error loading favorites:', error);
    }
  };

  const fetchUpcomingEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('id, title, date, type')
        .gte('date', new Date().toISOString())
        .order('date', { ascending: true })
        .limit(20);

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  };

  const toggleFavorite = async (songId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;

    const isFavorite = favorites.has(songId);

    try {
      if (isFavorite) {
        const { error } = await supabase
          .from('user_favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('song_id', songId);

        if (error) throw error;

        const newFavorites = new Set(favorites);
        newFavorites.delete(songId);
        setFavorites(newFavorites);
        toast.success('Removed from favorites');
      } else {
        const { error } = await supabase
          .from('user_favorites')
          .insert({ user_id: user.id, song_id: songId });

        if (error) throw error;

        const newFavorites = new Set(favorites);
        newFavorites.add(songId);
        setFavorites(newFavorites);
        toast.success('Added to favorites');
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast.error('Failed to update favorite');
    }
  };

  const toggleSongSelection = (songId: string) => {
    const newSelection = new Set(selectedSongs);
    if (newSelection.has(songId)) {
      newSelection.delete(songId);
    } else {
      newSelection.add(songId);
    }
    setSelectedSongs(newSelection);
  };

  const selectAllFavorites = () => {
    const favSongs = songs.filter(s => favorites.has(s.id));
    setSelectedSongs(new Set(favSongs.map(s => s.id)));
    toast.success(`Selected ${favSongs.length} favorite songs`);
  };

  const addSongsToEvent = async (eventId: string) => {
    if (selectedSongs.size === 0) {
      toast.error('No songs selected');
      return;
    }

    try {
      const songsToAdd = Array.from(selectedSongs).map(songId => ({
        event_id: eventId,
        song_id: songId,
        created_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('event_songs')
        .insert(songsToAdd);

      if (error) throw error;

      toast.success(`Added ${selectedSongs.size} songs to event`);
      setSelectedSongs(new Set());
      setShowEventModal(false);
    } catch (error: any) {
      console.error('Error adding songs to event:', error);
      if (error.message?.includes('duplicate key')) {
        toast.error('Some songs already in this event');
      } else {
        toast.error('Failed to add songs to event');
      }
    }
  };

  const handleBulkStatusUpdate = async (status: 'learned' | 'learning' | 'not_yet') => {
    if (selectedSongs.size === 0) {
      toast.error('No songs selected');
      return;
    }

    try {
      const { error } = await supabase
        .from('songs')
        .update({ learning_status: status })
        .in('id', Array.from(selectedSongs));

      if (error) throw error;

      const statusLabel = status === 'learned' ? 'Learned' : status === 'learning' ? 'Learning' : 'Not Yet';
      toast.success(`${selectedSongs.size} song(s) marked as ${statusLabel}`);
      
      setSelectedSongs(new Set());
      fetchSongs();
    } catch (error) {
      console.error('Error updating songs:', error);
      toast.error('Failed to update songs');
    }
  };

  const selectAllFiltered = () => {
    setSelectedSongs(new Set(filteredSongs.map(s => s.id)));
    toast.success(`Selected ${filteredSongs.length} songs`);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this song?')) return;
    try {
      const { error } = await supabase.from('songs').delete().eq('id', id);
      if (error) throw error;
      setSongs(songs.filter(s => s.id !== id));
      toast.success('Song deleted');
    } catch (error) {
      toast.error('Failed to delete song');
    }
  };

  const handleViewPDF = (song: Song) => {
    if (song.sheet_music_url) {
      navigate('/pdf-viewer', {
        state: { url: song.sheet_music_url, title: song.title }
      });
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'learned':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-green-700 bg-green-100 rounded-full">
            ✅ Learned
          </span>
        );
      case 'learning':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-yellow-700 bg-yellow-100 rounded-full">
            📚 Learning
          </span>
        );
      case 'not_yet':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-full">
            ⏳ Not Yet
          </span>
        );
      default:
        return null;
    }
  };

  // Filter songs by language
  const filterByLanguage = (song: Song): boolean => {
    if (languageFilter === 'all') return true;
    if (languageFilter === 'english') return song.language === 'English';
    if (languageFilter === 'french') return song.language === 'French';
    if (languageFilter === 'portuguese') return song.language === 'Portuguese';
    if (languageFilter === 'lingala') return song.language === 'Lingala';
    if (languageFilter === 'tshiluba') return song.language === 'Tshiluba';
    if (languageFilter === 'kikongo') return song.language === 'Kikongo';
    if (languageFilter === 'swahili') return song.language === 'Swahili';
    return true;
  };

  // Filter and sort songs
  const filteredSongs = songs.filter(song => {
    if (!filterByLanguage(song)) return false;
    
    // Learning status filter
    if (statusFilter !== 'all' && song.learning_status !== statusFilter) {
      return false;
    }
    
    const search = searchTerm.toLowerCase();
    const titleMatch = song.title.toLowerCase().includes(search);
    const composerMatch = song.composer?.toLowerCase().includes(search);
    const matchesSearch = titleMatch || composerMatch;
    
    if (showFavoritesOnly) {
      return matchesSearch && favorites.has(song.id);
    }
    
    return matchesSearch;
  }).sort((a, b) => {
    switch (sortBy) {
      case 'a-z':
        return a.title.localeCompare(b.title);
      case 'z-a':
        return b.title.localeCompare(a.title);
      case 'recent':
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      case 'language':
        return a.language.localeCompare(b.language);
      default:
        return 0;
    }
  });

  const favoriteCount = favorites.size;

  // Stats
  const stats = {
    total: songs.length,
    learned: songs.filter(s => s.learning_status === 'learned').length,
    learning: songs.filter(s => s.learning_status === 'learning').length,
    notYet: songs.filter(s => s.learning_status === 'not_yet' || !s.learning_status).length,
  };
  const masteryRate = stats.total > 0 ? Math.round((stats.learned / stats.total) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading repertoire...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Repertoire</h1>
          <p className="text-gray-600 mt-1">
            {filteredSongs.length} songs total
            {favoriteCount > 0 && <span className="text-yellow-600"> · {favoriteCount} favorites ⭐</span>}
            {filteredSongs.length !== songs.length && `, ${filteredSongs.length} showing`}
          </p>
        </div>
        <button
          onClick={() => navigate('/admin/repertoire/new')}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all font-medium"
        >
          <Plus className="w-5 h-5" />
          Add Song
        </button>
      </div>

      {/* Compact Stats Cards */}
      <div className="grid grid-cols-5 gap-2 mb-6">
        <button
          onClick={() => setStatusFilter('all')}
          className={`bg-white rounded-xl shadow-md p-3 text-center transition-all hover:shadow-lg max-h-20 ${
            statusFilter === 'all' ? 'ring-2 ring-indigo-500' : ''
          }`}
        >
          <div className="text-xl font-bold text-gray-900 leading-tight">{stats.total}</div>
          <div className="text-xs text-gray-600 mt-1">Total</div>
        </button>
        <button
          onClick={() => setStatusFilter('learned')}
          className={`bg-green-50 border border-green-200 rounded-xl shadow-md p-3 text-center transition-all hover:shadow-lg max-h-20 ${
            statusFilter === 'learned' ? 'ring-2 ring-green-500' : ''
          }`}
        >
          <div className="text-xl font-bold text-green-600 leading-tight">{stats.learned}</div>
          <div className="text-xs text-gray-600 mt-1">✅</div>
        </button>
        <button
          onClick={() => setStatusFilter('learning')}
          className={`bg-yellow-50 border border-yellow-200 rounded-xl shadow-md p-3 text-center transition-all hover:shadow-lg max-h-20 ${
            statusFilter === 'learning' ? 'ring-2 ring-yellow-500' : ''
          }`}
        >
          <div className="text-xl font-bold text-yellow-600 leading-tight">{stats.learning}</div>
          <div className="text-xs text-gray-600 mt-1">📚</div>
        </button>
        <button
          onClick={() => setStatusFilter('not_yet')}
          className={`bg-gray-50 border border-gray-200 rounded-xl shadow-md p-3 text-center transition-all hover:shadow-lg max-h-20 ${
            statusFilter === 'not_yet' ? 'ring-2 ring-gray-500' : ''
          }`}
        >
          <div className="text-xl font-bold text-gray-600 leading-tight">{stats.notYet}</div>
          <div className="text-xs text-gray-600 mt-1">⏳</div>
        </button>
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl shadow-md p-3 text-center max-h-20">
          <div className="text-xl font-bold text-indigo-600 leading-tight">{masteryRate}%</div>
          <div className="text-xs text-gray-600 mt-1">Rate</div>
        </div>
      </div>

      {/* Filters & Actions Bar */}
      <div className="bg-white rounded-xl shadow-md p-3 sm:p-6 space-y-3">
        {/* Row 1: Search + Filter Button (mobile) / Full filters (desktop) */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search songs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          
          {/* Filter Button - Mobile Only */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`sm:hidden flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
              showFilters ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-700 border-gray-300'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
          </button>

          {/* Desktop: Inline dropdowns */}
          <div className="hidden sm:flex items-center gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 cursor-pointer font-medium text-gray-700"
            >
              <option value="a-z">A → Z</option>
              <option value="z-a">Z → A</option>
              <option value="recent">Recent</option>
            </select>
            <select
              value={languageFilter}
              onChange={(e) => setLanguageFilter(e.target.value as any)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 cursor-pointer font-medium text-gray-700"
            >
              <option value="all">All Languages</option>
              <option value="english">English</option>
              <option value="french">French</option>
              <option value="portuguese">Portuguese</option>
              <option value="lingala">Lingala</option>
              <option value="tshiluba">Tshiluba</option>
              <option value="kikongo">Kikongo</option>
              <option value="swahili">Swahili</option>
            </select>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded transition-colors ${viewMode === 'grid' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
              >
                <Grid3x3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Filter Panel */}
        {showFilters && (
          <div className="sm:hidden bg-gray-50 rounded-lg p-3 space-y-3 border border-gray-200">
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-900 text-sm">Filters</span>
              <button onClick={() => setShowFilters(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Sort by</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white"
              >
                <option value="a-z">A → Z</option>
                <option value="z-a">Z → A</option>
                <option value="recent">Recently Added</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Language</label>
              <select
                value={languageFilter}
                onChange={(e) => setLanguageFilter(e.target.value as any)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white"
              >
                <option value="all">All Languages</option>
                <option value="english">English</option>
                <option value="french">French</option>
                <option value="portuguese">Portuguese</option>
                <option value="lingala">Lingala</option>
                <option value="tshiluba">Tshiluba</option>
                <option value="kikongo">Kikongo</option>
                <option value="swahili">Swahili</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">View</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium ${viewMode === 'grid' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'}`}
                >
                  Grid
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium ${viewMode === 'list' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'}`}
                >
                  List
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Row 2: Favorites + Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              showFavoritesOnly ? 'bg-yellow-500 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Star className={`w-4 h-4 ${showFavoritesOnly ? 'fill-white' : ''}`} />
            Favorites
            {favoriteCount > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${showFavoritesOnly ? 'bg-yellow-600' : 'bg-gray-200'}`}>
                {favoriteCount}
              </span>
            )}
          </button>
          
          <div className="flex items-center gap-2">
            {selectedSongs.size > 0 && (
              <button
                onClick={() => setShowEventModal(true)}
                className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
              >
                <Calendar className="w-4 h-4" />
                <span className="hidden sm:inline">Add to Event</span>
                <span className="sm:hidden">{selectedSongs.size}</span>
              </button>
            )}
            <button
              onClick={() => navigate('/admin/bulk-edit')}
              className="px-3 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700"
            >
              Bulk Edit
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Status Update - When songs are selected */}
      {selectedSongs.size > 0 && (
        <div className="bg-indigo-50 border-2 border-indigo-200 rounded-xl shadow-md p-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <span className="font-medium text-indigo-900">
                {selectedSongs.size} song{selectedSongs.size !== 1 ? 's' : ''} selected
              </span>
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    handleBulkStatusUpdate(e.target.value as 'learned' | 'learning' | 'not_yet');
                  }
                }}
                className="px-4 py-2 border border-indigo-300 rounded-lg bg-white font-medium"
              >
                <option value="">Mark as...</option>
                <option value="learned">✅ Learned</option>
                <option value="learning">📚 Learning</option>
                <option value="not_yet">⏳ Not Yet</option>
              </select>
            </div>
            <button
              onClick={() => setSelectedSongs(new Set())}
              className="px-4 py-2 text-gray-600 hover:text-gray-900"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}
      {/* Songs Display */}
      {viewMode === 'grid' ? (
        /* Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSongs.map((song) => {
            const isFavorite = favorites.has(song.id);
            const isSelected = selectedSongs.has(song.id);
            
            return (
              <div
                key={song.id}
                className={`bg-white rounded-xl shadow-md hover:shadow-xl transition-all overflow-hidden ${
                  isSelected ? 'ring-2 ring-indigo-500' : ''
                }`}
              >
                {/* Selection Checkbox (when bulk selecting) */}
                {selectedSongs.size > 0 && (
                  <div className="bg-indigo-50 p-2 border-b">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSongSelection(song.id)}
                        className="w-4 h-4 text-indigo-600 rounded"
                      />
                      <span className="text-sm text-gray-600">Select for event</span>
                    </label>
                  </div>
                )}

                <div className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900 mb-2">{song.title}</h3>
                      <div className="flex flex-wrap gap-2">
                        <span className={`inline-block text-xs px-2 py-1 rounded-full ${
                          song.language === 'English' ? 'bg-blue-100 text-blue-800' :
                          song.language === 'French' ? 'bg-purple-100 text-purple-800' :
                          song.language === 'Lingala' ? 'bg-green-100 text-green-800' :
                          song.language === 'Tshiluba' ? 'bg-yellow-100 text-yellow-800' :
                          song.language === 'Swahili' ? 'bg-teal-100 text-teal-800' :
                          song.language === 'Kikongo' ? 'bg-orange-100 text-orange-800' :
                          song.language === 'Portuguese' ? 'bg-pink-100 text-pink-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {song.language}
                        </span>
                        {getStatusBadge(song.learning_status || 'not_yet')}
                      </div>
                    </div>
                    
                    {/* Star Button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleFavorite(song.id, e); }}
                      className={`p-2 rounded-lg transition-all ${
                        isFavorite
                          ? 'text-yellow-500 hover:bg-yellow-50'
                          : 'text-gray-300 hover:text-yellow-400 hover:bg-gray-50'
                      }`}
                      title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      <Star className={`w-6 h-6 ${isFavorite ? 'fill-yellow-500' : ''}`} />
                    </button>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 mt-4">
                    {song.sheet_music_url && (
                      <button
                        onClick={() => handleViewPDF(song)}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/admin/repertoire/${song.id}/edit`); }}                     
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(song.id); }}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {selectedSongs.size > 0 && (
                  <th className="px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedSongs.size === filteredSongs.length && filteredSongs.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          showFavoritesOnly ? selectAllFavorites() : selectAllFiltered();
                        } else {
                          setSelectedSongs(new Set());
                        }
                      }}
                      className="w-4 h-4 text-indigo-600 rounded"
                    />
                  </th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <Star className="w-4 h-4 inline mr-1" />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Title
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Language
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredSongs.map((song) => {
                const isFavorite = favorites.has(song.id);
                const isSelected = selectedSongs.has(song.id);
                
                return (
                  <tr
                    onClick={() => song.sheet_music_url && handleViewPDF(song)}
                    key={song.id}
                    className={`hover:bg-gray-50 transition-colors cursor-pointer ${
                      isSelected ? 'bg-indigo-50' : ''
                    }`}
                  >
                    {selectedSongs.size > 0 && (
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSongSelection(song.id)}
                          className="w-4 h-4 text-indigo-600 rounded"
                        />
                      </td>
                    )}
                    
                    {/* Star */}
                    <td className="px-6 py-4">
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleFavorite(song.id, e); }}
                        className={`transition-all ${
                          isFavorite
                            ? 'text-yellow-500 hover:text-yellow-600'
                            : 'text-gray-300 hover:text-yellow-400'
                        }`}
                      >
                        <Star className={`w-5 h-5 ${isFavorite ? 'fill-yellow-500' : ''}`} />
                      </button>
                    </td>

                    {/* Title */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Music className="w-4 h-4 text-gray-400" />
                        <span className="font-medium text-gray-900">{song.title}</span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      {getStatusBadge(song.learning_status || 'not_yet')}
                    </td>

                    {/* Language */}
                    <td className="px-6 py-4">
                      <span className={`inline-block text-xs px-2.5 py-0.5 rounded-full font-medium ${
                        song.language === 'English' ? 'bg-blue-100 text-blue-800' :
                        song.language === 'French' ? 'bg-purple-100 text-purple-800' :
                        song.language === 'Lingala' ? 'bg-green-100 text-green-800' :
                        song.language === 'Tshiluba' ? 'bg-yellow-100 text-yellow-800' :
                        song.language === 'Swahili' ? 'bg-teal-100 text-teal-800' :
                        song.language === 'Kikongo' ? 'bg-orange-100 text-orange-800' :
                        song.language === 'Portuguese' ? 'bg-pink-100 text-pink-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {song.language}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {song.sheet_music_url && (
                          <button
                            onClick={() => handleViewPDF(song)}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="View PDF"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/admin/repertoire/${song.id}/edit`); }}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(song.id); }}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Empty State */}
          {filteredSongs.length === 0 && (
            <div className="text-center py-12">
              <Music className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {showFavoritesOnly ? 'No favorites yet' : 'No songs found'}
              </h3>
              <p className="text-gray-500">
                {showFavoritesOnly
                  ? 'Star some songs to add them to your favorites!'
                  : 'Try adjusting your search or add a new song'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Event Selection Modal */}
      {showEventModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                Add {selectedSongs.size} Songs to Event
              </h2>
              <button
                onClick={() => setShowEventModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Event List */}
            <div className="flex-1 overflow-y-auto p-6">
              {events.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600 mb-4">No upcoming events</p>
                  <button
                    onClick={() => {
                      setShowEventModal(false);
                      navigate('/admin/events/new');
                    }}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                  >
                    Create Event
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {events.map((event) => (
                    <button
                      key={event.id}
                      onClick={() => addSongsToEvent(event.id)}
                      className="w-full text-left p-4 rounded-lg border-2 border-gray-200 hover:border-indigo-500 hover:bg-indigo-50 transition-all"
                    >
                      <div className="font-semibold text-gray-900">{event.title}</div>
                      <div className="text-sm text-gray-600 mt-1">
                        {new Date(event.date).toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </div>
                      <div className="text-xs text-gray-500 mt-1 capitalize">
                        {event.type}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t">
              <button
                onClick={() => setShowEventModal(false)}
                className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

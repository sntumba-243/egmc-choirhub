import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Music, Search, Edit, Trash2, Grid3x3, List, Eye, Star, Calendar, X, CheckCircle, BookOpen, Clock } from 'lucide-react';
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
  const [sortBy, setSortBy] = useState<'a-z' | 'z-a' | 'recent'>('a-z');
  const [languageFilter, setLanguageFilter] = useState<'all' | 'english' | 'french' | 'portuguese' | 'lingala' | 'tshiluba' | 'kikongo' | 'swahili'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'learned' | 'learning' | 'not_yet'>('all');

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
        .gte('date', new Date().toISOString().split('T')[0])
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
        return <span className="text-xs">✅</span>;
      case 'learning':
        return <span className="text-xs">📚</span>;
      case 'not_yet':
        return <span className="text-xs">⏳</span>;
      default:
        return <span className="text-xs">⏳</span>;
    }
  };

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

  const filteredSongs = songs.filter(song => {
    if (!filterByLanguage(song)) return false;
    
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
      default:
        return 0;
    }
  });

  const favoriteCount = favorites.size;

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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* Compact Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Repertoire</h1>
          <p className="text-xs text-gray-600 mt-0.5">
            {filteredSongs.length} of {songs.length} songs
          </p>
        </div>
        <button
          onClick={() => navigate('new')}
          className="text-sm text-indigo-600 hover:text-indigo-700 font-semibold"
        >
          + Add Song
        </button>
      </div>

      {/* Compact Stats */}
      <div className="grid grid-cols-5 gap-2">
        <button
          onClick={() => setStatusFilter('all')}
          className={`bg-white rounded-lg shadow-sm border p-2 text-center transition ${
            statusFilter === 'all' ? 'ring-2 ring-indigo-500 border-indigo-500' : 'border-gray-200'
          }`}
        >
          <div className="text-lg font-bold text-gray-900">{stats.total}</div>
          <div className="text-xs text-gray-600">Total</div>
        </button>
        <button
          onClick={() => setStatusFilter('learned')}
          className={`bg-green-50 border rounded-lg shadow-sm p-2 text-center transition ${
            statusFilter === 'learned' ? 'ring-2 ring-green-500 border-green-500' : 'border-green-200'
          }`}
        >
          <div className="text-lg font-bold text-green-700">{stats.learned}</div>
          <div className="text-xs text-gray-700">✅</div>
        </button>
        <button
          onClick={() => setStatusFilter('learning')}
          className={`bg-yellow-50 border rounded-lg shadow-sm p-2 text-center transition ${
            statusFilter === 'learning' ? 'ring-2 ring-yellow-500 border-yellow-500' : 'border-yellow-200'
          }`}
        >
          <div className="text-lg font-bold text-yellow-700">{stats.learning}</div>
          <div className="text-xs text-gray-700">📚</div>
        </button>
        <button
          onClick={() => setStatusFilter('not_yet')}
          className={`bg-gray-50 border rounded-lg shadow-sm p-2 text-center transition ${
            statusFilter === 'not_yet' ? 'ring-2 ring-gray-500 border-gray-500' : 'border-gray-200'
          }`}
        >
          <div className="text-lg font-bold text-gray-700">{stats.notYet}</div>
          <div className="text-xs text-gray-700">⏳</div>
        </button>
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg shadow-sm p-2 text-center">
          <div className="text-lg font-bold text-indigo-700">{masteryRate}%</div>
          <div className="text-xs text-gray-700">Rate</div>
        </div>
      </div>

      {/* Compact Search & Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 space-y-2">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search songs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white font-medium text-gray-700"
          >
            <option value="a-z">A → Z</option>
            <option value="z-a">Z → A</option>
            <option value="recent">Recent</option>
          </select>
          
          <select
            value={languageFilter}
            onChange={(e) => setLanguageFilter(e.target.value as any)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white font-medium text-gray-700"
          >
            <option value="all">All</option>
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
              className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
            >
              <Grid3x3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              showFavoritesOnly ? 'bg-yellow-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Star className={`w-3.5 h-3.5 ${showFavoritesOnly ? 'fill-white' : ''}`} />
            Favorites {favoriteCount > 0 && `(${favoriteCount})`}
          </button>
          
          <div className="flex items-center gap-2">
            {selectedSongs.size > 0 && (
              <button
                onClick={() => setShowEventModal(true)}
                className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700"
              >
                <Calendar className="w-3.5 h-3.5" />
                Add to Event ({selectedSongs.size})
              </button>
            )}
            <button
              onClick={selectedSongs.size > 0 ? () => setSelectedSongs(new Set()) : selectAllFiltered}
              className="px-3 py-1.5 text-xs bg-indigo-100 text-indigo-700 rounded-lg font-semibold hover:bg-indigo-200"
            >
              {selectedSongs.size > 0 ? 'Deselect All' : 'Select All'}
            </button>
            <button
              onClick={() => navigate('../bulk-edit')}
              className="px-3 py-1.5 text-xs bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700"
            >
              Bulk Edit
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Selection Bar */}
      {selectedSongs.size > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-indigo-900">
              {selectedSongs.size} selected
            </span>
            <div className="flex items-center gap-2">
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    handleBulkStatusUpdate(e.target.value as 'learned' | 'learning' | 'not_yet');
                  }
                }}
                className="px-3 py-1.5 text-xs border border-indigo-300 rounded-lg bg-white font-medium"
              >
                <option value="">Mark as...</option>
                <option value="learned">✅ Learned</option>
                <option value="learning">📚 Learning</option>
                <option value="not_yet">⏳ Not Yet</option>
              </select>
              <button
                onClick={() => setSelectedSongs(new Set())}
                className="text-xs text-gray-700 hover:text-gray-900 font-medium"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Songs List */}
      {viewMode === 'list' ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {filteredSongs.map((song) => {
            const isFavorite = favorites.has(song.id);
            const isSelected = selectedSongs.has(song.id);
            
            return (
              <div
                key={song.id}
                onClick={() => song.sheet_music_url && handleViewPDF(song)}
                className={`flex items-center gap-3 px-3 py-2 border-b last:border-b-0 hover:bg-gray-50 transition ${
                  song.sheet_music_url ? 'cursor-pointer' : ''
                } ${isSelected ? 'bg-indigo-50' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={(e) => { e.stopPropagation(); toggleSongSelection(song.id); }}
                  className="w-4 h-4 flex-shrink-0"
                />
                
                <button
                  onClick={(e) => { e.stopPropagation(); toggleFavorite(song.id, e); }}
                  className="flex-shrink-0"
                >
                  <Star className={`w-4 h-4 ${isFavorite ? 'fill-yellow-500 text-yellow-500' : 'text-gray-300'}`} />
                </button>

                <div className="flex-shrink-0">
                  {getStatusBadge(song.learning_status || 'not_yet')}
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-gray-900 truncate">{song.title}</h4>
                  <p className="text-xs text-gray-600 truncate">{song.composer}</p>
                </div>

                <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold text-white flex-shrink-0 ${
                  song.language === 'English' ? 'bg-blue-500' :
                  song.language === 'French' ? 'bg-purple-500' :
                  song.language === 'Lingala' ? 'bg-green-500' :
                  song.language === 'Tshiluba' ? 'bg-yellow-500' :
                  song.language === 'Swahili' ? 'bg-teal-500' :
                  song.language === 'Kikongo' ? 'bg-orange-500' :
                  song.language === 'Portuguese' ? 'bg-pink-500' :
                  'bg-gray-400'
                }`}>
                  {(song.language || '??').slice(0, 1)}
                </span>

                <div className="flex items-center gap-1">
                  {song.sheet_music_url && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleViewPDF(song); }}
                      className="p-1 text-green-600 hover:bg-green-50 rounded"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate(`${song.id}/edit`); }}
                    className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(song.id); }}
                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}

          {filteredSongs.length === 0 && (
            <div className="text-center py-12">
              <Music className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-sm font-medium text-gray-900 mb-1">No songs found</h3>
              <p className="text-xs text-gray-500">Try adjusting your filters</p>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
          {filteredSongs.map((song) => {
            const isFavorite = favorites.has(song.id);
            const isSelected = selectedSongs.has(song.id);
            const langColor = song.language === 'English' ? 'bg-blue-500' : song.language === 'French' ? 'bg-purple-500' : song.language === 'Lingala' ? 'bg-green-500' : song.language === 'Tshiluba' ? 'bg-yellow-500' : song.language === 'Swahili' ? 'bg-teal-500' : song.language === 'Kikongo' ? 'bg-orange-500' : song.language === 'Portuguese' ? 'bg-pink-500' : 'bg-gray-400';
            const langCode = (song.language || '??').slice(0, 2).toUpperCase();
            const langTextColor = song.language === 'English' ? 'text-blue-600 bg-blue-50' : song.language === 'French' ? 'text-purple-600 bg-purple-50' : song.language === 'Lingala' ? 'text-green-600 bg-green-50' : song.language === 'Tshiluba' ? 'text-yellow-600 bg-yellow-50' : song.language === 'Swahili' ? 'text-teal-600 bg-teal-50' : song.language === 'Kikongo' ? 'text-orange-600 bg-orange-50' : song.language === 'Portuguese' ? 'text-pink-600 bg-pink-50' : 'text-gray-600 bg-gray-50';
            const statusColor = song.learning_status === 'learned' ? 'bg-green-500' : song.learning_status === 'learning' ? 'bg-yellow-500' : 'bg-gray-300';
            const statusIcon = song.learning_status === 'learned' ? 'learned' : song.learning_status === 'learning' ? 'learning' : 'not_yet';

            return (
              <div
                key={song.id}
                onClick={() => song.sheet_music_url && handleViewPDF(song)}
                className={`group bg-white rounded-2xl shadow-sm hover:shadow-md transition-all border overflow-hidden flex ${
                  isSelected ? 'ring-2 ring-blue-500 border-blue-500' : 'border-gray-100 hover:border-gray-200'
                } ${song.sheet_music_url ? 'cursor-pointer' : ''}`}
              >
                <div className={`w-1 ${langColor} flex-shrink-0 rounded-l-2xl`} />
                <div className="flex-1 p-2.5">
                  <div className="flex items-center justify-between mb-0.5">
                    <h3 className="text-[13px] font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors flex-1 mr-2">{song.title}</h3>
                    <button onClick={(e) => { e.stopPropagation(); toggleFavorite(song.id, e); }} className="flex-shrink-0">
                      <Star className={`w-3.5 h-3.5 ${isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'}`} />
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-400 truncate mb-2">{song.composer}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${langTextColor}`}>{langCode}</span>
                      <div className={`w-3.5 h-3.5 rounded ${statusColor} flex items-center justify-center`}>
                        {statusIcon === 'learned' && <CheckCircle className="w-2 h-2 text-white" strokeWidth={3} />}
                        {statusIcon === 'learning' && <BookOpen className="w-2 h-2 text-white" strokeWidth={3} />}
                        {statusIcon === 'not_yet' && <Clock className="w-2 h-2 text-white" strokeWidth={3} />}
                      </div>
                    </div>
                    <div className="flex gap-0.5">
                      {song.sheet_music_url && (
                        <button onClick={(e) => { e.stopPropagation(); handleViewPDF(song); }} className="p-1 rounded text-gray-500 hover:text-green-600 transition-colors" title="View PDF">
                          <Eye className="w-3 h-3" strokeWidth={3} />
                        </button>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); navigate(`${song.id}/edit`); }} className="p-1 rounded text-gray-500 hover:text-blue-600 transition-colors" title="Edit">
                        <Edit className="w-3 h-3" strokeWidth={3} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(song.id); }} className="p-1 rounded text-gray-500 hover:text-red-500 transition-colors" title="Delete">
                        <Trash2 className="w-3 h-3" strokeWidth={3} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Event Modal */}
      {showEventModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[80vh] flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-bold">Add to Event ({selectedSongs.size})</h2>
              <button onClick={() => setShowEventModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {events.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-600 mb-3">No upcoming events</p>
                  <button
                    onClick={() => { setShowEventModal(false); navigate('../events/new'); }}
                    className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
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
                      className="w-full text-left p-3 rounded-lg border-2 border-gray-200 hover:border-indigo-500 hover:bg-indigo-50 transition"
                    >
                      <div className="font-semibold text-sm">{event.title}</div>
                      <div className="text-xs text-gray-600 mt-0.5">
                        {new Date(event.date).toLocaleDateString()}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t">
              <button
                onClick={() => setShowEventModal(false)}
                className="w-full px-4 py-2 text-sm bg-gray-200 rounded-lg hover:bg-gray-300"
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

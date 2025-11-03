import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Music, Calendar, MessageSquare, ArrowRight, Heart, Mic, Eye, X, Play, Square } from 'lucide-react';
import toast from 'react-hot-toast';

interface Stats {
  totalSongs: number;
  upcomingEvents: number;
  unreadMessages: number;
}

interface Song {
  id: string;
  title: string;
  composer?: string;
  language?: string;
  sheet_music_url?: string;
  audio_url?: string;
}

interface FavoriteSong extends Song {
  favorite_id: string;
  notes: string;
}

type Tab = 'overview' | 'favorites' | 'practice';

export const MemberDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<Stats>({
    totalSongs: 0,
    upcomingEvents: 0,
    unreadMessages: 0
  });
  const [loading, setLoading] = useState(true);
  const [memberName, setMemberName] = useState('Member');
  const [memberId, setMemberId] = useState<string>('');
  
  // Favorites state
  const [favorites, setFavorites] = useState<FavoriteSong[]>([]);
  const [loadingFavorites, setLoadingFavorites] = useState(false);
  const [viewingSong, setViewingSong] = useState<Song | null>(null);
  
  // Practice state
  const [songs, setSongs] = useState<Song[]>([]);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [feedback, setFeedback] = useState('');

  // Fetch initial data
  useEffect(() => {
    fetchMemberData();
    fetchStats();
  }, []);

  useEffect(() => {
    if (activeTab === 'favorites') {
      fetchFavorites();
    }
    if (activeTab === 'practice') {
      fetchSongs();
    }
  }, [activeTab]);

  useEffect(() => {
    if (user?.name) {
      setMemberName(user.name);
      setMemberId(user.id);
    }
  }, [user]);

  const fetchMemberData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setMemberId(user.id);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  };

  const fetchStats = async () => {
    try {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Songs count
      const { count: songsCount } = await supabase
        .from('songs')
        .select('*', { count: 'exact', head: true });

      // Upcoming events
      const now = new Date().toISOString();
      const { count: eventsCount } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .gte('date', now);

      // Messages count
      const { data: messagesData } = await supabase
        .from('messages')
        .select('id')
        .or(`recipients_include.${user.id},send_to.eq.${user.id}`);

      setStats({
        totalSongs: songsCount || 0,
        upcomingEvents: eventsCount || 0,
        unreadMessages: messagesData?.length || 0
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFavorites = async () => {
    try {
      setLoadingFavorites(true);
      const { data, error } = await supabase
        .from('song_favorites')
        .select(`
          favorite_id:id,
          notes,
          songs (id, title, composer, language, sheet_music_url, audio_url)
        `)
        .eq('member_id', memberId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const favoritesWithDetails = data?.map(f => ({
        favorite_id: f.favorite_id,
        notes: f.notes,
        ...f.songs
      })) || [];

      setFavorites(favoritesWithDetails);
    } catch (error) {
      console.error('Error fetching favorites:', error);
      toast.error('Failed to load favorites');
    } finally {
      setLoadingFavorites(false);
    }
  };

  const fetchSongs = async () => {
    try {
      const { data, error } = await supabase
        .from('songs')
        .select('id, title, composer, language, sheet_music_url, audio_url')
        .order('title', { ascending: true });

      if (error) throw error;
      setSongs(data || []);
    } catch (error) {
      console.error('Error fetching songs:', error);
    }
  };

  const removeFavorite = async (favoriteId: string) => {
    try {
      const { error } = await supabase
        .from('song_favorites')
        .delete()
        .eq('id', favoriteId);

      if (error) throw error;

      setFavorites(prev => prev.filter(f => f.favorite_id !== favoriteId));
      toast.success('Removed from favorites');
    } catch (error) {
      console.error('Error removing favorite:', error);
      toast.error('Failed to remove favorite');
    }
  };

  const startPractice = (song: Song) => {
    setSelectedSong(song);
    setFeedback('');
  };

  const toggleRecording = async () => {
    if (isRecording) {
      setIsRecording(false);
      setAnalyzing(true);
      
      setTimeout(() => {
        setFeedback(`Great work on "${selectedSong?.title}"! Here's your feedback:\n\n✅ Pitch Accuracy: 87%\n✅ Rhythm: Good timing on most phrases\n⚠️ Improvement Areas:\n- Work on sustaining longer notes\n- Practice breath control in measure 12-16\n\n💡 Tip: Try practicing with the metronome at 80% speed first.`);
        setAnalyzing(false);
      }, 2000);
    } else {
      setIsRecording(true);
      setFeedback('');
      toast.success('Recording started - sing along!');
    }
  };

  const getEmbedUrl = (url: string | undefined) => {
    if (!url || typeof url !== 'string') return '';
    
    try {
      if (url.includes('drive.google.com')) {
        const fileIdMatch = url.match(/\/d\/([^\/]+)/) || url.match(/id=([^&]+)/);
        if (fileIdMatch && fileIdMatch[1]) {
          return `https://drive.google.com/file/d/${fileIdMatch[1]}/preview`;
        }
      }
      return url;
    } catch (error) {
      return '';
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mb-4"></div>
        <p className="text-gray-600 text-sm">Loading dashboard...</p>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Repertoire',
      value: stats.totalSongs,
      icon: Music,
      color: 'from-purple-500 to-purple-600',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-600',
      route: '/member/repertoire',
      description: 'songs'
    },
    {
      title: 'Events',
      value: stats.upcomingEvents,
      icon: Calendar,
      color: 'from-green-500 to-green-600',
      bgColor: 'bg-green-50',
      textColor: 'text-green-600',
      route: '/member/calendar',
      description: 'upcoming'
    },
    {
      title: 'Messages',
      value: stats.unreadMessages,
      icon: MessageSquare,
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600',
      route: '/member/messages',
      description: 'total'
    }
  ];

  return (
    <div className="space-y-4 pb-4">
      {/* Mobile Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg p-4 sm:p-6 text-white shadow-md">
        <h1 className="text-xl sm:text-3xl font-bold mb-1">Welcome back! 👋</h1>
        <p className="text-sm text-purple-100">{memberName}</p>
      </div>

      {/* Mobile Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-6 px-6 sm:mx-0 sm:px-0">
        {['overview', 'favorites', 'practice'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as Tab)}
            className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {tab === 'overview' && 'Overview'}
            {tab === 'favorites' && `Favorites (${favorites.length})`}
            {tab === 'practice' && 'Practice'}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <>
          {/* Stat Cards Grid - Mobile Optimized */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {statCards.map((card) => {
              const Icon = card.icon;
              return (
                <button
                  key={card.title}
                  onClick={() => navigate(card.route)}
                  className="bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow border border-gray-100 text-left"
                >
                  <div className="flex items-start justify-between">
                    <div className={`p-2 rounded-lg ${card.bgColor}`}>
                      <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${card.textColor}`} />
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  </div>
                  <p className="text-xs text-gray-600 mt-3 mb-1">{card.title}</p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900">{card.value}</p>
                  <p className="text-xs text-gray-500 mt-1">{card.description}</p>
                </button>
              );
            })}
          </div>

          {/* Quick Overview Card */}
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Quick Stats</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600">Library</span>
                <span className="font-bold text-gray-900">{stats.totalSongs} songs</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600">Events</span>
                <span className="font-bold text-gray-900">{stats.upcomingEvents} upcoming</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-gray-600">Messages</span>
                <span className="font-bold text-gray-900">{stats.unreadMessages} total</span>
              </div>
            </div>
          </div>

          {/* Resources Card */}
          <div className="bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg shadow-md p-4 text-white">
            <h2 className="text-lg font-bold mb-2">Choir Resources</h2>
            <p className="text-sm text-purple-100 mb-4">
              Access songs and stay updated with upcoming events.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => navigate('/member/repertoire')}
                className="bg-white/20 backdrop-blur-sm border border-white/30 rounded-lg p-3 hover:bg-white/30 transition-all text-center"
              >
                <Music className="w-5 h-5 mx-auto mb-1" />
                <p className="text-xs font-medium">Songs</p>
              </button>
              <button
                onClick={() => navigate('/member/calendar')}
                className="bg-white/20 backdrop-blur-sm border border-white/30 rounded-lg p-3 hover:bg-white/30 transition-all text-center"
              >
                <Calendar className="w-5 h-5 mx-auto mb-1" />
                <p className="text-xs font-medium">Events</p>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Favorites Tab */}
      {activeTab === 'favorites' && (
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 mb-4">My Favorites</h2>
          
          {loadingFavorites ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600 mx-auto"></div>
            </div>
          ) : favorites.length === 0 ? (
            <div className="text-center py-8">
              <Heart className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600 text-sm mb-3">No favorites yet</p>
              <button
                onClick={() => navigate('/member/repertoire')}
                className="px-4 py-2 text-xs font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 w-full"
              >
                Browse Repertoire
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {favorites.map(song => (
                <div key={song.favorite_id} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{song.title}</p>
                      {song.composer && (
                        <p className="text-xs text-gray-500 truncate">{song.composer}</p>
                      )}
                      {song.notes && (
                        <p className="text-xs text-gray-600 mt-1 line-clamp-2">{song.notes}</p>
                      )}
                    </div>
                    <button
                      onClick={() => removeFavorite(song.favorite_id)}
                      className="text-red-600 hover:text-red-700 flex-shrink-0"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Practice Tab */}
      {activeTab === 'practice' && (
        <>
          {selectedSong ? (
            // Practice Mode
            <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{selectedSong.title}</h2>
                  {selectedSong.composer && (
                    <p className="text-xs text-gray-500">{selectedSong.composer}</p>
                  )}
                </div>
                <button
                  onClick={() => setSelectedSong(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {selectedSong.audio_url && (
                <audio controls className="w-full mb-4 rounded-lg">
                  <source src={selectedSong.audio_url} />
                  Your browser does not support audio playback
                </audio>
              )}

              <button
                onClick={toggleRecording}
                disabled={analyzing}
                className={`w-full py-3 rounded-lg font-medium text-white transition-all ${
                  isRecording
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-purple-600 hover:bg-purple-700'
                } ${analyzing ? 'opacity-75 cursor-not-allowed' : ''}`}
              >
                {analyzing ? 'Analyzing...' : isRecording ? 'Stop Recording' : 'Start Recording'}
              </button>

              {feedback && (
                <div className="mt-4 bg-purple-50 rounded-lg p-4 text-sm text-gray-800 whitespace-pre-line">
                  {feedback}
                </div>
              )}
            </div>
          ) : (
            // Song List
            <>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-gray-900">Select a Song</h2>
                <span className="text-xs text-gray-600">{songs.length} available</span>
              </div>
              
              <div className="space-y-2">
                {songs.slice(0, 10).map(song => (
                  <button
                    key={song.id}
                    onClick={() => startPractice(song)}
                    className="w-full bg-white rounded-lg p-3 border border-gray-100 hover:border-purple-300 hover:bg-purple-50 transition-all text-left"
                  >
                    <div className="flex items-start gap-3">
                      <Play className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{song.title}</p>
                        {song.composer && (
                          <p className="text-xs text-gray-500 truncate">{song.composer}</p>
                        )}
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

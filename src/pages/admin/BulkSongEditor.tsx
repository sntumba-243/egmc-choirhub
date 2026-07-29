import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Languages, Music, CheckSquare, Square, Download, Upload } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { createSearcher, SONG_KEYS } from '../../lib/smartSearch';
import toast from 'react-hot-toast';

interface Song {
  id: string;
  title: string;
  composer: string;
  language: string;
  sheet_music_url: string;
  learning_status?: 'learned' | 'learning' | 'not_yet';
}

export const BulkSongEditor: React.FC = () => {
  const navigate = useNavigate();
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterLanguage, setFilterLanguage] = useState<string>('all');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchSongs();
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
      console.error('Error fetching songs:', error);
      toast.error('Failed to load songs');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedIds(newSelection);
  };

  const selectAll = () => {
    setSelectedIds(new Set(filteredSongs.map(s => s.id)));
  };

  const selectNone = () => {
    setSelectedIds(new Set());
  };

  const bulkUpdateLanguage = async (language: string) => {
    if (selectedIds.size === 0) {
      toast.error('No songs selected');
      return;
    }

    setUpdating(true);
    try {
      const { error } = await supabase
        .from('songs')
        .update({ language, updated_at: new Date().toISOString() })
        .in('id', Array.from(selectedIds));

      if (error) throw error;

      setSongs(songs.map(s => 
        selectedIds.has(s.id) ? { ...s, language } : s
      ));

      toast.success(`Updated ${selectedIds.size} songs to ${language}`);
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Error bulk updating:', error);
      toast.error('Failed to update songs');
    } finally {
      setUpdating(false);
    }
  };

  const bulkUpdateStatus = async (status: 'learned' | 'learning' | 'not_yet') => {
    if (selectedIds.size === 0) {
      toast.error('No songs selected');
      return;
    }

    setUpdating(true);
    try {
      const { error } = await supabase
        .from('songs')
        .update({ learning_status: status })
        .in('id', Array.from(selectedIds));

      if (error) throw error;

      setSongs(songs.map(s => 
        selectedIds.has(s.id) ? { ...s, learning_status: status } : s
      ));

      const statusLabel = status === 'learned' ? 'Learned' : status === 'learning' ? 'Learning' : 'Not Yet';
      toast.success(`Updated ${selectedIds.size} songs to ${statusLabel}`);
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Error bulk updating status:', error);
      toast.error('Failed to update songs');
    } finally {
      setUpdating(false);
    }
  };

  const exportToCSV = () => {
    const headers = ['Title', 'Composer', 'Language', 'Learning Status', 'ID'];
    const rows = filteredSongs.map(song => [
      `"${song.title.replace(/"/g, '""')}"`,
      `"${(song.composer || '').replace(/"/g, '""')}"`,
      song.language,
      song.learning_status || 'not_yet',
      song.id
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `songs-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Exported to CSV!');
  };

  const importFromCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n');
        const updates: Array<{ id: string; title: string; composer: string; language: string; learning_status?: string }> = [];

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          const matches = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g);
          if (!matches || matches.length < 4) continue;

          const [title, composer, language, learning_status, id] = matches.map(m => 
            m.replace(/^"(.*)"$/, '$1').replace(/""/g, '"').trim()
          );

          updates.push({ id, title, composer, language, learning_status });
        }

        if (updates.length === 0) {
          toast.error('No valid data found in CSV');
          return;
        }

        setUpdating(true);

        for (const update of updates) {
          const updateData: any = {
            title: update.title,
            composer: update.composer,
            language: update.language,
            updated_at: new Date().toISOString(),
          };
          
          if (update.learning_status && ['learned', 'learning', 'not_yet'].includes(update.learning_status)) {
            updateData.learning_status = update.learning_status;
          }

          await supabase
            .from('songs')
            .update(updateData)
            .eq('id', update.id);
        }

        toast.success(`Imported ${updates.length} songs!`);
        fetchSongs();
      } catch (error) {
        console.error('Error importing CSV:', error);
        toast.error('Failed to import CSV');
      } finally {
        setUpdating(false);
      }
    };
    reader.readAsText(file);
  };

  // Fuzzy search first (ranked), then the language filter on its output.
  const songSearcher = useMemo(() => createSearcher(songs, SONG_KEYS), [songs]);
  const filteredSongs = songSearcher(searchTerm).filter(
    song => filterLanguage === 'all' || song.language === filterLanguage
  );

  const languageCounts = {
    all: songs.length,
    English: songs.filter(s => s.language === 'English').length,
    French: songs.filter(s => s.language === 'French').length,
    Lingala: songs.filter(s => s.language === 'Lingala').length,
    Tshiluba: songs.filter(s => s.language === 'Tshiluba').length,
    Swahili: songs.filter(s => s.language === 'Swahili').length,
    Kikongo: songs.filter(s => s.language === 'Kikongo').length,
    Portuguese: songs.filter(s => s.language === 'Portuguese').length,
    Other: songs.filter(s => s.language === 'Other').length,
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'learned':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">✅ Learned</span>;
      case 'learning':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">📚 Learning</span>;
      case 'not_yet':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">⏳ Not Yet</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">⏳ Not Yet</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading songs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/admin/repertoire')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Bulk Edit Songs</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={exportToCSV} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer">
            <Upload className="w-4 h-4" />
            Import CSV
            <input type="file" accept=".csv" onChange={importFromCSV} className="hidden" disabled={updating} />
          </label>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md p-6 mb-6">
        <div className="flex flex-col gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input type="text" placeholder="Search by title or composer..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
          </div>
          <div className="flex flex-wrap gap-2">
            {(['all', 'English', 'French', 'Lingala', 'Tshiluba', 'Swahili', 'Kikongo', 'Portuguese', 'Other'] as const).map((lang) => (
              <button key={lang} onClick={() => setFilterLanguage(lang)} className={`px-4 py-2 rounded-lg font-medium transition-colors ${filterLanguage === lang ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                {lang} ({languageCounts[lang]})
              </button>
            ))}
          </div>
        </div>
      </div>

      {filteredSongs.length > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="text-sm font-medium text-indigo-900">{selectedIds.size} of {filteredSongs.length} selected</div>
              <button onClick={selectAll} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">Select All</button>
              <button onClick={selectNone} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">Select None</button>
            </div>
            {selectedIds.size > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-indigo-900 mr-2">Set Language:</span>
                <button onClick={() => bulkUpdateLanguage('English')} disabled={updating} className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium">English</button>
                <button onClick={() => bulkUpdateLanguage('French')} disabled={updating} className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors text-sm font-medium">French</button>
                <button onClick={() => bulkUpdateLanguage('Lingala')} disabled={updating} className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors text-sm font-medium">Lingala</button>
                <button onClick={() => bulkUpdateLanguage('Tshiluba')} disabled={updating} className="px-3 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 transition-colors text-sm font-medium">Tshiluba</button>
                <button onClick={() => bulkUpdateLanguage('Swahili')} disabled={updating} className="px-3 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors text-sm font-medium">Swahili</button>
                <button onClick={() => bulkUpdateLanguage('Kikongo')} disabled={updating} className="px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors text-sm font-medium">Kikongo</button>
                <button onClick={() => bulkUpdateLanguage('Portuguese')} disabled={updating} className="px-3 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:opacity-50 transition-colors text-sm font-medium">Portuguese</button>
                <button onClick={() => bulkUpdateLanguage('Other')} disabled={updating} className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors text-sm font-medium">Other</button>
              </div>
            )}
          </div>
        </div>
      )}

      {selectedIds.size > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-green-900 mr-2">Mark as:</span>
            <button onClick={() => bulkUpdateStatus('learned')} disabled={updating} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors text-sm font-medium">✅ Learned</button>
            <button onClick={() => bulkUpdateStatus('learning')} disabled={updating} className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 transition-colors text-sm font-medium">📚 Learning</button>
            <button onClick={() => bulkUpdateStatus('not_yet')} disabled={updating} className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors text-sm font-medium">⏳ Not Yet</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left">
                  <button onClick={selectedIds.size === filteredSongs.length ? selectNone : selectAll} className="text-gray-500 hover:text-gray-700">
                    {selectedIds.size === filteredSongs.length && filteredSongs.length > 0 ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Composer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Language</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredSongs.map((song) => (
                <tr key={song.id} className={`hover:bg-gray-50 transition-colors cursor-pointer ${selectedIds.has(song.id) ? 'bg-indigo-50' : ''}`} onClick={() => toggleSelection(song.id)}>
                  <td className="px-6 py-4">
                    <button onClick={(e) => { e.stopPropagation(); toggleSelection(song.id); }} className="text-gray-500 hover:text-indigo-600">
                      {selectedIds.has(song.id) ? <CheckSquare className="w-5 h-5 text-indigo-600" /> : <Square className="w-5 h-5" />}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Music className="w-4 h-4 text-gray-400" />
                      <span className="font-medium text-gray-900">{song.title}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{song.composer || 'Unknown'}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      song.language === 'English' ? 'bg-blue-100 text-blue-800' :
                      song.language === 'French' ? 'bg-purple-100 text-purple-800' :
                      song.language === 'Lingala' ? 'bg-green-100 text-green-800' :
                      song.language === 'Tshiluba' ? 'bg-yellow-100 text-yellow-800' :
                      song.language === 'Swahili' ? 'bg-teal-100 text-teal-800' :
                      song.language === 'Kikongo' ? 'bg-orange-100 text-orange-800' :
                      song.language === 'Portuguese' ? 'bg-pink-100 text-pink-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {song.language || 'English'}
                    </span>
                  </td>
                  <td className="px-6 py-4">{getStatusBadge(song.learning_status || 'not_yet')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredSongs.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Music className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No songs found</p>
          </div>
        )}
      </div>

      <div className="mt-6 text-center text-sm text-gray-600">Showing {filteredSongs.length} of {songs.length} songs</div>

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-bold text-blue-900 mb-2">💡 Bulk Edit with CSV:</h3>
        <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
          <li>Click "Export CSV" to download current songs</li>
          <li>Open in Excel/Google Sheets and edit titles, composers, languages, learning status</li>
          <li>For Learning Status, use: <strong>learned</strong>, <strong>learning</strong>, or <strong>not_yet</strong></li>
          <li>Save the file (keep the ID column!)</li>
          <li>Click "Import CSV" to upload your changes</li>
          <li>All songs will be updated automatically!</li>
        </ol>
      </div>
    </div>
  );
};

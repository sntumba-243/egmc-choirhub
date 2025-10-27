import React, { useState, useEffect } from 'react';
import { Plus, Upload, Download, FileText, X, CheckCircle, AlertCircle, Trash2, Check } from 'lucide-react';
import { songsService, type Song } from '../../lib/database';

interface AdminRepertoireProps {
  onNavigateToForm: (songId: string | null) => void;
}

interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
}

export const AdminRepertoire: React.FC<AdminRepertoireProps> = ({ onNavigateToForm }) => {
  const [showImportModal, setShowImportModal] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSongs, setSelectedSongs] = useState<Set<string>>(new Set());
  const [bulkDeleteMode, setBulkDeleteMode] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadSongs();
  }, []);

  const loadSongs = async () => {
    try {
      const data = await songsService.getSongs();
      setSongs(data);
    } catch (error) {
      console.error('Failed to load songs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResult(null);

    try {
      const text = await file.text();
      let songs: any[] = [];

      if (file.name.endsWith('.json')) {
        songs = JSON.parse(text);
      } else if (file.name.endsWith('.csv')) {
        const lines = text.split('\n').filter(line => line.trim());
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

        songs = lines.slice(1).map(line => {
          const values = line.split(',').map(v => v.trim());
          const song: any = {};
          headers.forEach((header, index) => {
            song[header] = values[index];
          });
          return song;
        });
      }

      const errors: string[] = [];
      const validSongs: any[] = [];

      songs.forEach((song, index) => {
        if (!song.title) {
          errors.push(`Row ${index + 1}: Missing required field (title)`);
        } else {
          const cleanedSong: any = {
            title: song.title,
            composer: song.composer || null,
            arranger: song.arranger || null,
            key: song.key || null,
            language: song.language || null,
            instrumentalist: song.instrumentalist || null,
            sheet_music_url: song.sheet_music_url || null,
            youtube_link: song.youtube_link || null,
            soprano_audio_url: song.soprano_audio_url || null,
            alto_audio_url: song.alto_audio_url || null,
            tenor_audio_url: song.tenor_audio_url || null,
            bass_audio_url: song.bass_audio_url || null,
          };

          if (song.tags) {
            cleanedSong.tags = typeof song.tags === 'string'
              ? song.tags.split(',').map((t: string) => t.trim())
              : song.tags;
          }

          if (song.voice_parts) {
            cleanedSong.voice_parts = typeof song.voice_parts === 'string'
              ? song.voice_parts.split(',').map((v: string) => v.trim())
              : song.voice_parts;
          }

          validSongs.push(cleanedSong);
        }
      });

      if (validSongs.length > 0) {
        await songsService.bulkCreateSongs(validSongs);
        await loadSongs();
      }

      setImportResult({
        success: validSongs.length,
        failed: errors.length,
        errors: errors.slice(0, 5),
      });

      if (validSongs.length > 0) {
        alert(`Successfully imported ${validSongs.length} songs!`);
      }
    } catch (error) {
      setImportResult({
        success: 0,
        failed: 1,
        errors: ['Failed to parse file. Please check the format.'],
      });
    } finally {
      setImporting(false);
      event.target.value = '';
    }
  };

  const downloadTemplate = (format: 'csv' | 'json') => {
    let content: string;
    let filename: string;
    let mimeType: string;

    if (format === 'csv') {
      content = `title,key,language,composer,arranger,instrumentalist,voice_parts,tags,sheet_music_url,youtube_link,soprano_audio_url,alto_audio_url,tenor_audio_url,bass_audio_url\n`;
      content += `"Ave Maria","F Major","Latin","Franz Schubert","John Doe","Piano","soprano,alto,tenor,bass","Classical,Sacred","https://example.com/sheet.pdf","https://youtube.com/watch","https://example.com/soprano.mp3","https://example.com/alto.mp3","https://example.com/tenor.mp3","https://example.com/bass.mp3"\n`;
      content += `"Example Song","C Major","English","Example Composer","","","soprano,alto","Contemporary","","","","","",""`;
      filename = 'song-import-template.csv';
      mimeType = 'text/csv';
    } else {
      const template = [
        {
          title: 'Ave Maria',
          key: 'F Major',
          language: 'Latin',
          composer: 'Franz Schubert',
          arranger: 'John Doe',
          instrumentalist: 'Piano',
          voice_parts: 'soprano,alto,tenor,bass',
          tags: 'Classical,Sacred',
          sheet_music_url: 'https://example.com/sheet.pdf',
          youtube_link: 'https://youtube.com/watch',
          soprano_audio_url: 'https://example.com/soprano.mp3',
          alto_audio_url: 'https://example.com/alto.mp3',
          tenor_audio_url: 'https://example.com/tenor.mp3',
          bass_audio_url: 'https://example.com/bass.mp3',
        },
        {
          title: 'Example Song',
          key: 'C Major',
          language: 'English',
          composer: 'Example Composer',
          arranger: '',
          instrumentalist: '',
          voice_parts: 'soprano,alto',
          tags: 'Contemporary',
          sheet_music_url: '',
          youtube_link: '',
          soprano_audio_url: '',
          alto_audio_url: '',
          tenor_audio_url: '',
          bass_audio_url: '',
        },
      ];
      content = JSON.stringify(template, null, 2);
      filename = 'song-import-template.json';
      mimeType = 'application/json';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDeleteSong = async (songId: string) => {
    if (!confirm('Are you sure you want to delete this song?')) return;

    setDeleting(true);
    try {
      await songsService.deleteSong(songId);
      await loadSongs();
      alert('Song deleted successfully!');
    } catch (error) {
      console.error('Failed to delete song:', error);
      alert('Failed to delete song');
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedSongs.size === 0) {
      alert('Please select songs to delete');
      return;
    }

    if (!confirm(`Are you sure you want to delete ${selectedSongs.size} songs?`)) return;

    setDeleting(true);
    try {
      await Promise.all(Array.from(selectedSongs).map(id => songsService.deleteSong(id)));
      await loadSongs();
      setSelectedSongs(new Set());
      setBulkDeleteMode(false);
      alert(`Successfully deleted ${selectedSongs.size} songs!`);
    } catch (error) {
      console.error('Failed to delete songs:', error);
      alert('Failed to delete some songs');
    } finally {
      setDeleting(false);
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

  const toggleSelectAll = () => {
    if (selectedSongs.size === songs.length) {
      setSelectedSongs(new Set());
    } else {
      setSelectedSongs(new Set(songs.map(s => s.id)));
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-blue-900">Manage Repertoire</h2>
          <div className="flex gap-3">
            {bulkDeleteMode ? (
              <>
                <button
                  onClick={() => {
                    setBulkDeleteMode(false);
                    setSelectedSongs(new Set());
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                >
                  <X className="w-5 h-5" />
                  Cancel
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={deleting || selectedSongs.size === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-5 h-5" />
                  {deleting ? 'Deleting...' : `Delete (${selectedSongs.size})`}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setBulkDeleteMode(true)}
                  disabled={songs.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg font-semibold hover:bg-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-5 h-5" />
                  Bulk Delete
                </button>
                <button
                  onClick={() => setShowImportModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-700 text-white rounded-lg font-semibold hover:bg-green-600 transition-colors"
                >
                  <Upload className="w-5 h-5" />
                  Bulk Import
                </button>
                <button
                  onClick={() => onNavigateToForm(null)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-900 text-white rounded-lg font-semibold hover:bg-blue-800 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  Add Song
                </button>
              </>
            )}
          </div>
        </div>
        {bulkDeleteMode && songs.length > 0 && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
            <p className="text-sm text-blue-700">Select songs to delete</p>
            <button
              onClick={toggleSelectAll}
              className="text-sm text-blue-700 font-semibold hover:text-blue-800"
            >
              {selectedSongs.size === songs.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
        )}
        {loading ? (
          <div className="text-center py-8 text-gray-600">Loading songs...</div>
        ) : songs.length === 0 ? (
          <div className="text-center py-8 text-gray-600">No songs yet. Add your first song or bulk import!</div>
        ) : (
          <div className="space-y-3">
            {songs.map((song) => (
              <div key={song.id} className={`flex items-center gap-4 p-4 rounded-lg transition-colors ${
                bulkDeleteMode
                  ? selectedSongs.has(song.id)
                    ? 'bg-red-50 border-2 border-red-300'
                    : 'bg-gray-50 border-2 border-gray-200 hover:border-gray-300'
                  : 'bg-gray-50 hover:bg-gray-100'
              }`}>
                {bulkDeleteMode && (
                  <button
                    onClick={() => toggleSongSelection(song.id)}
                    className={`flex-shrink-0 w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                      selectedSongs.has(song.id)
                        ? 'bg-red-600 border-red-600'
                        : 'border-gray-400 hover:border-red-600'
                    }`}
                  >
                    {selectedSongs.has(song.id) && <Check className="w-4 h-4 text-white" />}
                  </button>
                )}
                <div className="flex-1">
                  <h3 className="font-bold text-blue-900 text-lg">{song.title}</h3>
                  <div className="flex gap-3 mt-1">
                    {song.key && (
                      <span className="text-sm text-gray-600">
                        <strong>Key:</strong> {song.key}
                      </span>
                    )}
                    {song.language && (
                      <span className="text-sm text-gray-600">
                        <strong>Language:</strong> {song.language}
                      </span>
                    )}
                  </div>
                  {song.composer && (
                    <p className="text-gray-600 text-sm mt-0.5">Composer: {song.composer}</p>
                  )}
                  {song.tags && song.tags.length > 0 && (
                    <div className="flex gap-2 mt-2">
                      {song.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-semibold"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {!bulkDeleteMode && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => onNavigateToForm(song.id)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteSong(song.id)}
                      disabled={deleting}
                      className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-blue-900">Bulk Import Songs</h3>
                <button
                  onClick={() => {
                    setShowImportModal(false);
                    setImportResult(null);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <FileText className="w-6 h-6 text-blue-700 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-blue-900 mb-2">Supported Formats</h4>
                      <p className="text-sm text-blue-700 mb-3">
                        Upload a CSV or JSON file containing your songs. Download a template to see the required format.
                      </p>
                      <div className="flex gap-3">
                        <button
                          onClick={() => downloadTemplate('csv')}
                          className="flex items-center gap-2 px-3 py-2 bg-blue-700 text-white rounded-lg text-sm font-semibold hover:bg-blue-600 transition-colors"
                        >
                          <Download className="w-4 h-4" />
                          CSV Template
                        </button>
                        <button
                          onClick={() => downloadTemplate('json')}
                          className="flex items-center gap-2 px-3 py-2 bg-blue-700 text-white rounded-lg text-sm font-semibold hover:bg-blue-600 transition-colors"
                        >
                          <Download className="w-4 h-4" />
                          JSON Template
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors">
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 mb-4">
                    Drop your CSV or JSON file here, or click to browse
                  </p>
                  <label className="inline-flex items-center gap-2 px-6 py-3 bg-blue-900 text-white rounded-lg font-semibold hover:bg-blue-800 transition-colors cursor-pointer">
                    <Upload className="w-5 h-5" />
                    {importing ? 'Importing...' : 'Choose File'}
                    <input
                      type="file"
                      accept=".csv,.json"
                      onChange={handleFileImport}
                      disabled={importing}
                      className="hidden"
                    />
                  </label>
                </div>

                {importResult && (
                  <div className={`rounded-lg p-4 ${importResult.failed > 0 ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'}`}>
                    <div className="flex items-start gap-3">
                      {importResult.failed > 0 ? (
                        <AlertCircle className="w-6 h-6 text-yellow-700 flex-shrink-0 mt-0.5" />
                      ) : (
                        <CheckCircle className="w-6 h-6 text-green-700 flex-shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <h4 className={`font-semibold mb-2 ${importResult.failed > 0 ? 'text-yellow-900' : 'text-green-900'}`}>
                          Import Results
                        </h4>
                        <p className={`text-sm mb-2 ${importResult.failed > 0 ? 'text-yellow-700' : 'text-green-700'}`}>
                          Successfully imported: {importResult.success} songs
                          {importResult.failed > 0 && ` • Failed: ${importResult.failed}`}
                        </p>
                        {importResult.errors.length > 0 && (
                          <div className="mt-3">
                            <p className="text-sm font-semibold text-yellow-900 mb-1">Errors:</p>
                            <ul className="text-sm text-yellow-700 space-y-1">
                              {importResult.errors.map((error, index) => (
                                <li key={index}>• {error}</li>
                              ))}
                              {importResult.failed > 5 && (
                                <li className="italic">...and {importResult.failed - 5} more</li>
                              )}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Required Fields:</h4>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li>• <strong>title</strong> - Song title (required)</li>
                  </ul>
                  <h4 className="font-semibold text-gray-900 mt-3 mb-2">Optional Fields:</h4>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li>• <strong>key</strong> - Musical key (e.g., "C Major", "A minor")</li>
                    <li>• <strong>language</strong> - Song language (e.g., "English", "Latin")</li>
                    <li>• <strong>composer</strong> - Composer name</li>
                    <li>• <strong>arranger</strong> - Arranger name</li>
                    <li>• <strong>instrumentalist</strong> - Instrumentalist (e.g., "Piano", "Guitar")</li>
                    <li>• <strong>voice_parts</strong> - Comma-separated voice parts (e.g., "soprano,alto,tenor,bass")</li>
                    <li>• <strong>tags</strong> - Comma-separated tags</li>
                    <li>• <strong>sheet_music_url</strong> - URL to sheet music PDF</li>
                    <li>• <strong>youtube_link</strong> - YouTube video URL</li>
                    <li>• <strong>soprano_audio_url</strong> - Soprano part audio URL</li>
                    <li>• <strong>alto_audio_url</strong> - Alto part audio URL</li>
                    <li>• <strong>tenor_audio_url</strong> - Tenor part audio URL</li>
                    <li>• <strong>bass_audio_url</strong> - Bass part audio URL</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

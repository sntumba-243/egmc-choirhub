import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, Upload, FileText, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface SongFormProps {
  songId?: string;
  onBack: () => void;
}

export const SongForm: React.FC<SongFormProps> = ({ songId, onBack }) => {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [composer, setComposer] = useState('');
  const [arranger, setArranger] = useState('');
  const [key, setKey] = useState('');
  const [language, setLanguage] = useState('');
  const [instrumentalist, setInstrumentalist] = useState('');
  const [voiceParts, setVoiceParts] = useState<string[]>([]);
  const [tags, setTags] = useState('');
  const [youtubeLink, setYoutubeLink] = useState('');
  const [sopranoAudio, setSopranoAudio] = useState('');
  const [altoAudio, setAltoAudio] = useState('');
  const [tenorAudio, setTenorAudio] = useState('');
  const [bassAudio, setBassAudio] = useState('');
  const [sheetMusicFile, setSheetMusicFile] = useState<File | null>(null);
  const [existingSheetMusic, setExistingSheetMusic] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setTitle(data.title);
        setComposer(data.composer || '');
        setArranger(data.arranger || '');
        setKey(data.key || '');
        setLanguage(data.language || '');
        setInstrumentalist(data.instrumentalist || '');
        setVoiceParts(data.voice_parts || []);
        setTags(data.tags?.join(', ') || '');
        setYoutubeLink(data.youtube_link || '');
        setSopranoAudio(data.soprano_audio_url || '');
        setAltoAudio(data.alto_audio_url || '');
        setTenorAudio(data.tenor_audio_url || '');
        setBassAudio(data.bass_audio_url || '');
        setExistingSheetMusic(data.sheet_music_url || null);
      }
    } catch (err) {
      setError('Failed to load song');
      console.error(err);
    }
  };

  const uploadSheetMusic = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('sheet-music')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from('sheet-music')
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  const deleteOldSheetMusic = async (url: string) => {
    try {
      const path = url.split('/sheet-music/').pop();
      if (path) {
        await supabase.storage
          .from('sheet-music')
          .remove([path]);
      }
    } catch (err) {
      console.error('Failed to delete old file:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let sheetMusicUrl = existingSheetMusic;

      if (sheetMusicFile) {
        if (existingSheetMusic) {
          await deleteOldSheetMusic(existingSheetMusic);
        }
        sheetMusicUrl = await uploadSheetMusic(sheetMusicFile);
      }

      const tagsArray = tags.split(',').map(tag => tag.trim()).filter(tag => tag);

      const songData = {
        title,
        composer: composer || null,
        arranger: arranger || null,
        key: key || null,
        language: language || null,
        instrumentalist: instrumentalist || null,
        voice_parts: voiceParts.length > 0 ? voiceParts : null,
        tags: tagsArray.length > 0 ? tagsArray : null,
        youtube_link: youtubeLink || null,
        soprano_audio_url: sopranoAudio || null,
        alto_audio_url: altoAudio || null,
        tenor_audio_url: tenorAudio || null,
        bass_audio_url: bassAudio || null,
        sheet_music_url: sheetMusicUrl || null,
      };

      if (songId) {
        const { error } = await supabase
          .from('songs')
          .update(songData)
          .eq('id', songId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('songs')
          .insert([songData]);

        if (error) throw error;
      }

      onBack();
    } catch (err: any) {
      setError(err.message || 'Failed to save song');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = [
        'application/pdf',
        'text/html',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword',
        'image/png',
        'image/jpeg',
        'image/jpg'
      ];

      if (!validTypes.includes(file.type)) {
        setError('Please upload a valid file (PDF, HTML, DOC, DOCX, PNG, JPG)');
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB');
        return;
      }

      setSheetMusicFile(file);
      setError(null);
    }
  };

  const removeFile = () => {
    setSheetMusicFile(null);
    setExistingSheetMusic(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-700 font-semibold hover:text-slate-900 mb-4 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Repertoire
        </button>

        <div className="bg-white rounded-xl shadow-lg p-8">
          <h2 className="text-3xl font-bold text-slate-900 mb-6">
            {songId ? 'Edit Song' : 'Add New Song'}
          </h2>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Key
                </label>
                <input
                  type="text"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder="e.g. C Major, A minor"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Language
                </label>
                <input
                  type="text"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  placeholder="e.g. English, Latin, Spanish"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Composer
                </label>
                <input
                  type="text"
                  value={composer}
                  onChange={(e) => setComposer(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Arranger
                </label>
                <input
                  type="text"
                  value={arranger}
                  onChange={(e) => setArranger(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Instrumentalist
                </label>
                <input
                  type="text"
                  value={instrumentalist}
                  onChange={(e) => setInstrumentalist(e.target.value)}
                  placeholder="e.g. Piano, Guitar, Orchestra"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Voice Parts (select all that apply)
                </label>
                <div className="flex flex-wrap gap-3">
                  {['soprano', 'alto', 'tenor', 'bass'].map((part) => (
                    <label
                      key={part}
                      className="flex items-center gap-2 px-4 py-2 border-2 rounded-lg cursor-pointer transition-all hover:bg-slate-50"
                      style={{
                        borderColor: voiceParts.includes(part) ? '#3b82f6' : '#cbd5e1',
                        backgroundColor: voiceParts.includes(part) ? '#eff6ff' : 'white',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={voiceParts.includes(part)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setVoiceParts([...voiceParts, part]);
                          } else {
                            setVoiceParts(voiceParts.filter(p => p !== part));
                          }
                        }}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="font-medium text-slate-700 capitalize">{part}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="e.g. Christmas, Latin, A Cappella"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="border-t border-slate-200 pt-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Sheet Music</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Upload Sheet Music (PDF, HTML, DOC, DOCX, PNG, JPG - Max 10MB)
                  </label>

                  {(sheetMusicFile || existingSheetMusic) ? (
                    <div className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-300 rounded-lg">
                      <FileText className="w-8 h-8 text-blue-600" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-900">
                          {sheetMusicFile?.name || 'Existing sheet music'}
                        </p>
                        <p className="text-xs text-slate-500">
                          {sheetMusicFile
                            ? `${(sheetMusicFile.size / 1024 / 1024).toFixed(2)} MB`
                            : 'Already uploaded'
                          }
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={removeFile}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        type="file"
                        onChange={handleFileChange}
                        accept=".pdf,.html,.doc,.docx,.png,.jpg,.jpeg"
                        className="hidden"
                        id="sheet-music-upload"
                      />
                      <label
                        htmlFor="sheet-music-upload"
                        className="flex items-center justify-center gap-2 px-6 py-4 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors"
                      >
                        <Upload className="w-6 h-6 text-slate-400" />
                        <span className="text-sm font-medium text-slate-600">
                          Click to upload sheet music
                        </span>
                      </label>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Audio Practice Tracks</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Soprano Audio URL
                  </label>
                  <input
                    type="url"
                    value={sopranoAudio}
                    onChange={(e) => setSopranoAudio(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Alto Audio URL
                  </label>
                  <input
                    type="url"
                    value={altoAudio}
                    onChange={(e) => setAltoAudio(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Tenor Audio URL
                  </label>
                  <input
                    type="url"
                    value={tenorAudio}
                    onChange={(e) => setTenorAudio(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Bass Audio URL
                  </label>
                  <input
                    type="url"
                    value={bassAudio}
                    onChange={(e) => setBassAudio(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">External Links</h3>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  YouTube Link
                </label>
                <input
                  type="url"
                  value={youtubeLink}
                  onChange={(e) => setYoutubeLink(e.target.value)}
                  placeholder="https://youtube.com/..."
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-5 h-5" />
                {loading ? 'Saving...' : 'Save Song'}
              </button>

              <button
                type="button"
                onClick={onBack}
                className="px-6 py-3 bg-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

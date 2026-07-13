import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  ChevronDown, ChevronRight, Play, Pause, CheckCircle, Clock,
  Music, Dumbbell, Calendar, Brain
} from 'lucide-react';
import toast from 'react-hot-toast';
import { SongRecorder } from '../../components/SongRecorder';
import SheetMusicViewer from '../../components/SheetMusicViewer';

interface Exercise {
  id: string;
  title: string;
  description: string;
  exercise_type: string;
  difficulty: string;
  instructions?: string;
}

interface Assignment {
  id: string;
  assignment_type: 'exercise' | 'song';
  due_date: string | null;
  notes: string | null;
  completed: boolean;
  reference_audio_url: string | null;
  exercise: Exercise | null;
  song: { id: string; title: string; sheet_music_url?: string } | null;
}

interface Submission {
  id: string;
  assignment_id: string;
  audio_url: string;
  status: string;
  feedback_audio_url: string | null;
  ai_feedback: string | null;
  created_at: string;
  song: { title: string } | null;
}

const typeColors: Record<string, string> = {
  breathing: 'text-teal-600 bg-teal-50',
  rhythm: 'text-orange-600 bg-orange-50',
  tone: 'text-pink-600 bg-pink-50',
  range: 'text-blue-600 bg-blue-50',
};

const diffColors: Record<string, string> = {
  beginner: 'text-green-600 bg-green-50',
  intermediate: 'text-yellow-600 bg-yellow-50',
  advanced: 'text-red-600 bg-red-50',
};

const typeEmojis: Record<string, string> = {
  breathing: '💨',
  rhythm: '🥁',
  tone: '🎵',
  range: '🎤',
};

export function VocalCoach() {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [showRecorder, setShowRecorder] = useState(false);
  const [selectedSong, setSelectedSong] = useState<{ id: string; title: string; assignmentId?: string } | null>(null);
  const [viewingSong, setViewingSong] = useState<any>(null);
  const [exerciseTab, setExerciseTab] = useState<'all' | 'breathing' | 'tone' | 'rhythm' | 'range'>('all');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => { if (user) loadData(); }, [user]);

  const loadData = async () => {
    if (!user) return;
    try {
      setLoading(true);

      // Load assignments
      const { data: assignData } = await supabase
        .from('exercise_assignments')
        .select('id, assignment_type, reference_audio_url, due_date, notes, completed, exercise_id, song_id')
        .eq('member_id', user.id)
        .order('created_at', { ascending: false });

      if (assignData) {
        const enriched = await Promise.all(assignData.map(async (a) => {
          let exercise = null, song = null;
          if (a.exercise_id) {
            const { data } = await supabase.from('smart_coach_exercises')
              .select('id, title, description, exercise_type, difficulty, instructions')
              .eq('id', a.exercise_id).single();
            exercise = data;
          }
          if (a.song_id) {
            const { data } = await supabase.from('songs')
              .select('id, title, sheet_music_url, updated_at').eq('id', a.song_id).single();
            song = data;
          }
          return { ...a, exercise, song };
        }));
        setAssignments(enriched);
      }

      // Load all global exercises (for practice library)
      const { data: exData } = await supabase
        .from('smart_coach_exercises')
        .select('id, title, description, exercise_type, difficulty, instructions')
        .is('member_id', null)
        .order('difficulty', { ascending: true });
      setExercises(exData || []);

      // Load submissions
      const { data: subData } = await supabase
        .from('song_submissions')
        .select('*, song:songs(title)')
        .eq('member_id', user.id)
        .order('created_at', { ascending: false });
      setSubmissions(subData || []);

    } catch (error) {
      console.error('Error:', error);
    } finally { setLoading(false); }
  };

  const playAudio = (url: string, id: string) => {
    if (playingId === id) { audioRef.current?.pause(); setPlayingId(null); }
    else if (audioRef.current) { audioRef.current.src = url; audioRef.current.play(); setPlayingId(id); }
  };

  const handleMarkComplete = async (id: string) => {
    try {
      await supabase.from('exercise_assignments').update({ completed: true, completed_at: new Date().toISOString() }).eq('id', id);
      toast.success('Marked complete! ✅');
      loadData();
    } catch { toast.error('Failed to update'); }
  };

  const formatDate = (d: string) => new Date(d.includes('T') ? d : d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const pending = assignments.filter(a => !a.completed);
  const completed = assignments.filter(a => a.completed);
  const filteredExercises = exerciseTab === 'all' ? exercises : exercises.filter(e => e.exercise_type === exerciseTab);

  if (loading) return (
    <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" /></div>
  );

  return (
    <div className="space-y-4 pb-8">
      <audio ref={audioRef} onEnded={() => setPlayingId(null)} />

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Vocal Coach</h1>
        <p className="text-xs text-gray-500">Practice assignments & vocal exercises</p>
      </div>

      {/* ==================== ASSIGNMENTS FROM DIRECTOR ==================== */}
      {pending.length > 0 && (
        <div>
          <h2 className="text-[13px] font-bold text-gray-900 mb-2 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-orange-500" />
            Assignments ({pending.length})
          </h2>

          <div className="space-y-2">
            {pending.map(a => {
              const isExpanded = expandedId === a.id;
              const isSong = a.assignment_type === 'song';
              const title = isSong ? a.song?.title : a.exercise?.title;
              const sub = submissions.find(s => s.assignment_id === a.id);

              return (
                <div key={a.id} className="bg-white rounded-2xl border border-gray-200/60 shadow-sm overflow-hidden">
                  {/* Header row */}
                  <button onClick={() => setExpandedId(isExpanded ? null : a.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isSong ? 'bg-purple-50' : 'bg-blue-50'}`}>
                      {isSong ? <Music className="w-4 h-4 text-purple-500" /> : <Dumbbell className="w-4 h-4 text-blue-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13px] font-semibold text-gray-900 truncate">{title || 'Assignment'}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${isSong ? 'text-purple-600 bg-purple-50' : 'text-blue-600 bg-blue-50'}`}>
                          {isSong ? 'Song' : 'Exercise'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        {a.due_date && <span>Due {formatDate(a.due_date)}</span>}
                        {sub && <span className={`font-medium ${sub.status === 'approved' ? 'text-green-600' : sub.status === 'reviewed' ? 'text-blue-600' : 'text-orange-500'}`}>
                          {sub.status === 'approved' ? '✅ Approved' : sub.status === 'reviewed' ? '💬 Reviewed' : '⏳ Submitted'}
                        </span>}
                      </div>
                    </div>
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                  </button>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
                      {/* Director's notes */}
                      {a.notes && (
                        <div className="bg-yellow-50 rounded-xl p-3">
                          <span className="text-xs font-bold text-yellow-700">📝 Director's notes:</span>
                          <p className="text-[12px] text-yellow-800 mt-0.5">{a.notes}</p>
                        </div>
                      )}

                      {/* Reference audio */}
                      {a.reference_audio_url && (
                        <button onClick={() => playAudio(a.reference_audio_url!, `ref-${a.id}`)}
                          className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl transition-all ${
                            playingId === `ref-${a.id}` ? 'bg-indigo-100 border border-indigo-300' : 'bg-indigo-50 border border-indigo-200'
                          }`}>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            playingId === `ref-${a.id}` ? 'bg-indigo-600 animate-pulse' : 'bg-indigo-500'
                          } text-white`}>
                            {playingId === `ref-${a.id}` ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                          </div>
                          <span className="text-[12px] font-medium text-indigo-700">
                            {playingId === `ref-${a.id}` ? '🎵 Playing melody reference...' : '🎵 Listen to melody reference'}
                          </span>
                        </button>
                      )}

                      {/* Exercise instructions */}
                      {!isSong && a.exercise?.instructions && (
                        <div className="bg-gray-50 rounded-xl p-3">
                          <span className="text-xs font-bold text-gray-500">📋 How to do this exercise:</span>
                          <div className="mt-1.5 text-[12px] text-gray-700 whitespace-pre-line leading-relaxed">
                            {a.exercise.instructions}
                          </div>
                        </div>
                      )}

                      {/* Feedback from director */}
                      {sub?.feedback_audio_url && (
                        <button onClick={() => playAudio(sub.feedback_audio_url!, `fb-${sub.id}`)}
                          className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl ${
                            playingId === `fb-${sub.id}` ? 'bg-green-100 border border-green-300' : 'bg-green-50 border border-green-200'
                          }`}>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            playingId === `fb-${sub.id}` ? 'bg-green-600 animate-pulse' : 'bg-green-500'
                          } text-white`}>
                            {playingId === `fb-${sub.id}` ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                          </div>
                          <span className="text-[12px] font-medium text-green-700">
                            {playingId === `fb-${sub.id}` ? '🎧 Playing feedback...' : '🎧 Director feedback'}
                          </span>
                        </button>
                      )}

                      {/* AI Feedback */}
                      {sub?.ai_feedback && (() => {
                        try {
                          const saved = JSON.parse(sub.ai_feedback);
                          const a = saved.analysis;
                          return (
                            <div className="bg-purple-50 rounded-xl p-3 space-y-2">
                              <div className="flex items-center gap-2">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white ${
                                  a.overall_score >= 80 ? 'bg-green-500' : a.overall_score >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                                }`}>{a.overall_score}</div>
                                <div className="flex-1">
                                  <span className="text-xs font-bold text-purple-600">🤖 AI Evaluation</span>
                                  <p className="text-xs text-gray-700 mt-0.5">{a.summary}</p>
                                </div>
                              </div>
                              {a.suggestions?.length > 0 && (
                                <div className="bg-white/60 rounded-lg p-2">
                                  <span className="text-xs font-bold text-blue-600">💡 Tips:</span>
                                  {a.suggestions.map((s: string, i: number) => (
                                    <p key={i} className="text-xs text-gray-600 mt-0.5">• {s}</p>
                                  ))}
                                </div>
                              )}
                              <p className="text-xs text-gray-500 italic">{a.encouragement}</p>
                            </div>
                          );
                        } catch { return null; }
                      })()}

                      {/* Actions */}
                      <div className="flex gap-2">
                        {isSong ? (
                          <button onClick={async () => {
                            if (a.song?.sheet_music_url) {
                              setViewingSong(a.song);
                            } else {
                              setSelectedSong({ id: a.song!.id, title: a.song!.title, assignmentId: a.id });
                              setShowRecorder(true);
                            }
                          }}
                            className="flex-1 py-2.5 bg-purple-500 text-white rounded-xl text-[13px] font-semibold text-center hover:bg-purple-600 transition-all active:scale-[0.98]">
                            {a.song?.sheet_music_url ? '📄 View & Record' : '🎤 Record'}
                          </button>
                        ) : (
                          <div className="flex-1 py-2.5 bg-blue-50 text-blue-600 rounded-xl text-[13px] font-semibold text-center">
                            Follow the steps above ☝️
                          </div>
                        )}
                        <button onClick={() => handleMarkComplete(a.id)}
                          className="px-4 py-2.5 bg-green-500 text-white rounded-xl text-[13px] font-semibold hover:bg-green-600 transition-all active:scale-[0.98]">
                          ✅ Done
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================== EXERCISE LIBRARY ==================== */}
      <div>
        <h2 className="text-[13px] font-bold text-gray-900 mb-2 flex items-center gap-1.5">
          <Brain className="w-4 h-4 text-purple-500" />
          Exercise Library ({exercises.length})
        </h2>

        {/* Filter tabs */}
        <div className="flex bg-gray-100/80 rounded-xl p-0.5 mb-3">
          {([['all', 'All'], ['breathing', 'Breathing'], ['tone', 'Tone'], ['rhythm', 'Rhythm'], ['range', 'Range']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setExerciseTab(key)}
              className={`flex-1 min-h-[44px] px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
                exerciseTab === key ? 'bg-white shadow-sm text-gray-900 font-semibold' : 'text-gray-500'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* Exercise list */}
        <div className="space-y-2">
          {filteredExercises.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200/60 shadow-sm p-6 text-center">
              <Dumbbell className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-[13px] text-gray-400">No exercises in this category</p>
            </div>
          ) : filteredExercises.map(ex => {
            const isExpanded = expandedExercise === ex.id;
            return (
              <div key={ex.id} className="bg-white rounded-2xl border border-gray-200/60 shadow-sm overflow-hidden">
                <button onClick={() => setExpandedExercise(isExpanded ? null : ex.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left">
                  <span className="text-lg">{typeEmojis[ex.exercise_type] || '🎵'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px] font-semibold text-gray-900 truncate">{ex.title}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${typeColors[ex.exercise_type] || 'text-gray-600 bg-gray-50'}`}>
                        {ex.exercise_type}
                      </span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${diffColors[ex.difficulty] || 'text-gray-600 bg-gray-50'}`}>
                        {ex.difficulty}
                      </span>
                    </div>
                  </div>
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-2">
                    <p className="text-[12px] text-gray-600">{ex.description}</p>
                    {ex.instructions && (
                      <div className="bg-gray-50 rounded-xl p-3">
                        <span className="text-xs font-bold text-gray-500">📋 Instructions:</span>
                        <div className="mt-1.5 text-[12px] text-gray-700 whitespace-pre-line leading-relaxed">
                          {ex.instructions}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ==================== COMPLETED ==================== */}
      {completed.length > 0 && (
        <details className="bg-white rounded-2xl border border-gray-200/60 shadow-sm">
          <summary className="px-4 py-3 cursor-pointer text-[13px] font-semibold text-gray-900 flex items-center gap-1.5">
            <CheckCircle className="w-4 h-4 text-green-500" />
            Completed ({completed.length})
          </summary>
          <div className="px-4 pb-3 space-y-2 border-t border-gray-100 pt-3">
            {completed.map(a => {
              const sub = submissions.find(s => s.assignment_id === a.id);
              return (
                <div key={a.id} className="space-y-2 py-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${a.assignment_type === 'song' ? 'bg-purple-50' : 'bg-blue-50'}`}>
                      {a.assignment_type === 'song' ? <Music className="w-3.5 h-3.5 text-purple-400" /> : <Dumbbell className="w-3.5 h-3.5 text-blue-400" />}
                    </div>
                    <span className="text-[12px] text-gray-500 flex-1">
                      {a.assignment_type === 'song' ? a.song?.title : a.exercise?.title}
                    </span>
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  </div>
                  {sub?.ai_feedback && (() => {
                    try {
                      const saved = JSON.parse(sub.ai_feedback);
                      const r = saved.analysis;
                      return (
                        <div className="bg-purple-50 rounded-xl p-3 space-y-2 ml-11">
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                              r.overall_score >= 80 ? 'bg-green-500' : r.overall_score >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}>{r.overall_score}</div>
                            <div className="flex-1">
                              <span className="text-xs font-bold text-purple-600">🤖 AI Evaluation</span>
                              <p className="text-xs text-gray-700 mt-0.5">{r.summary}</p>
                            </div>
                          </div>
                          {r.suggestions?.length > 0 && (
                            <div className="bg-white/60 rounded-lg p-2">
                              <span className="text-xs font-bold text-blue-600">💡 Tips:</span>
                              {r.suggestions.map((s: string, i: number) => (
                                <p key={i} className="text-xs text-gray-600 mt-0.5">• {s}</p>
                              ))}
                            </div>
                          )}
                          <p className="text-xs text-gray-500 italic">{r.encouragement}</p>
                        </div>
                      );
                    } catch { return null; }
                  })()}
                </div>
              );
            })}
          </div>
        </details>
      )}

      {/* ==================== NO CONTENT ==================== */}
      {pending.length === 0 && exercises.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-200/60 shadow-sm p-8 text-center">
          <Brain className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-[13px] text-gray-500">No assignments or exercises yet</p>
          <p className="text-xs text-gray-400 mt-1">Your director will assign songs and exercises for you to practice</p>
        </div>
      )}

      {/* Song Recorder Modal */}
      {showRecorder && selectedSong && (
        <SongRecorder
          songId={selectedSong.id}
          songTitle={selectedSong.title}
          assignmentId={selectedSong.assignmentId}
          onClose={() => { setShowRecorder(false); setSelectedSong(null); loadData(); }}
        />
      )}

      {viewingSong && <SheetMusicViewer url={viewingSong.sheet_music_url} title={viewingSong.title} version={viewingSong.updated_at} onClose={() => setViewingSong(null)} />}
    </div>
  );
}

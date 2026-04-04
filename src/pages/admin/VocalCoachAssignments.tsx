import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Plus, CheckCircle, Clock, Music, Dumbbell, X, Calendar, Trash2,
  ChevronDown, ChevronRight, Play, Pause, Mic, Square, Send, RotateCcw
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useChurch } from '../../contexts/ChurchContext';
import { analyzeAudio, AnalysisProgress } from '../../services/audioAnalysis';
import { generateVocalFeedback, saveVocalFeedback, VocalRatings, VocalAnalysisResult } from '../../services/vocalAnalysis';

interface Member {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  voice_part?: string;
}

interface Exercise {
  id: string;
  title: string;
  description: string;
  exercise_type: string;
  difficulty: string;
}

interface Song {
  id: string;
  title: string;
  composer: string;
}

interface Submission {
  id: string;
  audio_url: string;
  status: string;
  feedback_audio_url: string | null;
  ai_feedback: string | null;
  created_at: string;
}

interface Assignment {
  id: string;
  member_id: string;
  assignment_type: 'exercise' | 'song';
  exercise_id: string | null;
  song_id: string | null;
  due_date: string | null;
  notes: string | null;
  completed: boolean;
  reference_audio_url: string | null;
  created_at: string;
  member: Member | null;
  exercise: Exercise | null;
  song: Song | null;
  submission?: Submission | null;
}

interface MemberWithAssignments {
  member: Member;
  assignments: Assignment[];
  pendingSubmissions: number;
}

const voiceColors: Record<string, string> = {
  Soprano: 'text-pink-600 bg-pink-50',
  Alto: 'text-purple-600 bg-purple-50',
  Tenor: 'text-blue-600 bg-blue-50',
  Bass: 'text-green-600 bg-green-50',
  Instrumentalist: 'text-orange-600 bg-orange-50',
};

const avatarColors = [
  'from-purple-400 to-purple-600',
  'from-pink-400 to-pink-600',
  'from-blue-400 to-blue-600',
  'from-teal-400 to-teal-600',
  'from-orange-400 to-orange-600',
  'from-indigo-400 to-indigo-600',
  'from-green-400 to-green-600',
];

export default function VocalCoachAssignments() {
  const [members, setMembers] = useState<Member[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [memberAssignments, setMemberAssignments] = useState<MemberWithAssignments[]>([]);
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignmentType, setAssignmentType] = useState<'exercise' | 'song'>('song');
  const [selectedMember, setSelectedMember] = useState('');
  const [selectionMode, setSelectionMode] = useState<'single' | 'all' | 'voice'>('single');
  const [selectedVoicePart, setSelectedVoicePart] = useState('');
  const [referenceAudioBlob, setReferenceAudioBlob] = useState<Blob | null>(null);
  const [referenceAudioUrl, setReferenceAudioUrl] = useState<string | null>(null);
  const [isRecordingReference, setIsRecordingReference] = useState(false);
  const referenceRecorderRef = useRef<MediaRecorder | null>(null);
  const referenceChunksRef = useRef<Blob[]>([]);
  const [selectedExercise, setSelectedExercise] = useState('');
  const [selectedSong, setSelectedSong] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'all' | 'pending' | 'completed'>('all');

  const [playingId, setPlayingId] = useState<string | null>(null);
  const [recordingFor, setRecordingFor] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [evaluatingId, setEvaluatingId] = useState<string | null>(null);
  const [ratings, setRatings] = useState<VocalRatings>({ key_accuracy: 3, tone_quality: 3, note_accuracy: 3, breathing: 3, rhythm: 3 });
  const [aiResult, setAiResult] = useState<VocalAnalysisResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [showAiDetails, setShowAiDetails] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<AnalysisProgress | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const handleAutoAnalyze = async (audioUrl: string, referenceUrl?: string | null) => {
    setAnalyzing(true);
    setAnalysisProgress({ stage: 'Starting...', percent: 0 });
    try {
      const scores = await analyzeAudio(audioUrl, referenceUrl, (p) => setAnalysisProgress(p));
      setRatings({
        key_accuracy: scores.pitch_stability,
        tone_quality: scores.tone_quality,
        note_accuracy: scores.note_accuracy,
        breathing: scores.breathing,
        rhythm: scores.rhythm,
      });
      toast.success('Audio analysis complete!');
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('Analysis failed — rate manually');
    } finally { setAnalyzing(false); setAnalysisProgress(null); }
  };

  const startEvaluation = (sid: string) => {
    setEvaluatingId(sid);
    setRatings({ key_accuracy: 3, tone_quality: 3, note_accuracy: 3, breathing: 3, rhythm: 3 });
    setAiResult(null); setShowAiDetails(false);
  };

  const cancelEvaluation = () => { setEvaluatingId(null); setAiResult(null); setShowAiDetails(false); };

  const handleGenerateFeedback = async (a: any) => {
    setAiLoading(true);
    try {
      const result = await generateVocalFeedback(ratings, {
        songTitle: a.song?.title, exerciseTitle: a.exercise?.title,
        voicePart: a.member?.voice_part,
        memberName: a.member ? `${a.member.first_name} ${a.member.last_name}` : undefined,
        directorNotes: a.notes || undefined,
      });
      console.log("RESULT:", result); setAiResult(result);
    } catch (err) { console.error("AI ERROR:", err); toast.error('Failed to generate feedback'); }
    finally { setAiLoading(false); }
  };

  const handleSaveAiFeedback = async (sid: string) => {
    if (!aiResult) return;
    const ok = await saveVocalFeedback(sid, aiResult, ratings);
    if (ok) { toast.success('AI feedback saved!'); cancelEvaluation(); loadData(); }
    else toast.error('Failed to save');
  };

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const { data: membersData } = await supabase.from('members').select('id, first_name, last_name, email, voice_part').eq('role', 'member').order('first_name');
      setMembers(membersData || []);

      const { data: exercisesData } = await supabase.from('smart_coach_exercises').select('id, title, description, exercise_type, difficulty').order('created_at', { ascending: false }).limit(50);
      setExercises(exercisesData || []);

      const { data: songsData } = await supabase.from('songs').select('id, title, composer').order('title');
      setSongs(songsData || []);

      const { data: assignmentsData } = await supabase.from('exercise_assignments').select('*').order('created_at', { ascending: false });
      const { data: submissionsData } = await supabase.from('song_submissions').select('*').order('created_at', { ascending: false });

      const enriched: Assignment[] = (assignmentsData || []).map((a) => ({
        ...a,
        member: membersData?.find(m => m.id === a.member_id) || null,
        exercise: exercisesData?.find(e => e.id === a.exercise_id) || null,
        song: songsData?.find(s => s.id === a.song_id) || null,
        submission: submissionsData?.find(s => s.assignment_id === a.id) || null,
      }));

      const grouped: MemberWithAssignments[] = [];
      const memberIds = [...new Set(enriched.map(a => a.member_id))];
      memberIds.forEach(memberId => {
        const member = membersData?.find(m => m.id === memberId);
        if (member) {
          const assigns = enriched.filter(a => a.member_id === memberId);
          grouped.push({ member, assignments: assigns, pendingSubmissions: assigns.filter(a => a.submission?.status === 'pending').length });
        }
      });
      grouped.sort((a, b) => b.pendingSubmissions - a.pendingSubmissions);
      setMemberAssignments(grouped);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load data');
    } finally { setLoading(false); }
  };

  // Reference audio
  const startReferenceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      referenceRecorderRef.current = rec;
      referenceChunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) referenceChunksRef.current.push(e.data); };
      rec.onstop = () => { const blob = new Blob(referenceChunksRef.current, { type: 'audio/webm' }); setReferenceAudioBlob(blob); setReferenceAudioUrl(URL.createObjectURL(blob)); stream.getTracks().forEach(t => t.stop()); };
      rec.start();
      setIsRecordingReference(true);
    } catch (err) { console.error("AI ERROR:", err); toast.error('Could not access microphone'); }
  };
  const stopReferenceRecording = () => { referenceRecorderRef.current?.stop(); setIsRecordingReference(false); };
  const clearReferenceAudio = () => { if (referenceAudioUrl) URL.revokeObjectURL(referenceAudioUrl); setReferenceAudioBlob(null); setReferenceAudioUrl(null); };

  // Audio playback
  const playAudio = (url: string, id: string) => {
    if (playingId === id) { audioRef.current?.pause(); setPlayingId(null); }
    else if (audioRef.current) { audioRef.current.src = url; audioRef.current.play(); setPlayingId(id); }
  };

  // Feedback recording
  const startRecording = async (submissionId: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      mediaRecorderRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => { const blob = new Blob(chunksRef.current, { type: 'audio/webm' }); setRecordedBlob(blob); setRecordedUrl(URL.createObjectURL(blob)); stream.getTracks().forEach(t => t.stop()); };
      rec.start();
      setIsRecording(true);
      setRecordingFor(submissionId);
    } catch (err) { console.error("AI ERROR:", err); toast.error('Could not access microphone'); }
  };
  const stopRecording = () => { mediaRecorderRef.current?.stop(); setIsRecording(false); };
  const cancelRecording = () => { if (recordedUrl) URL.revokeObjectURL(recordedUrl); setRecordedBlob(null); setRecordedUrl(null); setRecordingFor(null); };

  const sendFeedback = async (submissionId: string) => {
    if (!recordedBlob) return;
    setSending(true);
    try {
      const fileName = `feedback/${submissionId}/${Date.now()}.webm`;
      const { error: uploadError } = await supabase.storage.from('recordings').upload(fileName, recordedBlob, { contentType: 'audio/webm' });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('recordings').getPublicUrl(fileName);
      await supabase.from('song_submissions').update({ feedback_audio_url: publicUrl, status: 'reviewed' }).eq('id', submissionId);
      toast.success('Feedback sent!');
      cancelRecording();
      loadData();
    } catch (err) { console.error("AI ERROR:", err); toast.error('Failed to send feedback'); } finally { setSending(false); }
  };

  const approveSubmission = async (id: string) => {
    try { await supabase.from('song_submissions').update({ status: 'approved' }).eq('id', id); toast.success('Approved!'); loadData(); } catch (err) { console.error("AI ERROR:", err); toast.error('Failed'); }
  };

  const handleAssign = async () => {
    if (selectionMode === 'single' && !selectedMember) { toast.error('Select a member'); return; }
    if (selectionMode === 'voice' && !selectedVoicePart) { toast.error('Select a voice part'); return; }
    if (assignmentType === 'exercise' && !selectedExercise) { toast.error('Select an exercise'); return; }
    if (assignmentType === 'song' && !selectedSong) { toast.error('Select a song'); return; }

    try {
      const { data: userData } = await supabase.auth.getUser();
      let targets: string[] = [];
      if (selectionMode === 'single') targets = [selectedMember];
      else if (selectionMode === 'all') targets = members.map(m => m.id);
      else if (selectionMode === 'voice') targets = members.filter(m => m.voice_part === selectedVoicePart).map(m => m.id);

      if (targets.length === 0) { toast.error('No members found'); return; }

      let referenceUrl = null;
      if (referenceAudioBlob && assignmentType === 'song') {
        const fileName = `reference/${selectedSong}/${Date.now()}.webm`;
        const { error } = await supabase.storage.from('recordings').upload(fileName, referenceAudioBlob, { contentType: 'audio/webm' });
        if (!error) { const { data: { publicUrl } } = supabase.storage.from('recordings').getPublicUrl(fileName); referenceUrl = publicUrl; }
      }

      const assignments = targets.map(id => ({
        member_id: id, assigned_by: userData?.user?.id, assignment_type: assignmentType,
        exercise_id: assignmentType === 'exercise' ? selectedExercise : null,
        song_id: assignmentType === 'song' ? selectedSong : null,
        due_date: dueDate || null, notes: notes || null, reference_audio_url: referenceUrl
      }));

      const { error } = await supabase.from('exercise_assignments').insert(assignments);
      if (error) throw error;
      toast.success(`Assigned to ${targets.length} member${targets.length > 1 ? 's' : ''}!`);
      setShowAssignModal(false);
      resetForm();
      loadData();
    } catch (err) { console.error("AI ERROR:", err); toast.error('Failed to assign'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this assignment?')) return;
    try { await supabase.from('exercise_assignments').delete().eq('id', id); toast.success('Deleted'); loadData(); } catch (err) { console.error("AI ERROR:", err); toast.error('Failed'); }
  };

  const resetForm = () => { setSelectedMember(''); setSelectedExercise(''); setSelectedSong(''); setDueDate(''); setNotes(''); setAssignmentType('song'); setSelectionMode('single'); setSelectedVoicePart(''); clearReferenceAudio(); };

  const voiceParts = [...new Set(members.map(m => m.voice_part).filter(Boolean))].sort();
  const totalAssignments = memberAssignments.reduce((s, m) => s + m.assignments.length, 0);
  const completedCount = memberAssignments.reduce((s, m) => s + m.assignments.filter(a => a.completed).length, 0);
  const pendingReview = memberAssignments.reduce((s, m) => s + m.pendingSubmissions, 0);

  const getInitials = (m: Member) => `${m.first_name?.[0] || ''}${m.last_name?.[0] || ''}`;
  const getAvatarColor = (id: string) => avatarColors[id.charCodeAt(0) % avatarColors.length];

  const filteredMembers = memberAssignments.filter(ma => {
    if (tab === 'pending') return ma.pendingSubmissions > 0;
    if (tab === 'completed') return ma.assignments.every(a => a.completed) && ma.assignments.length > 0;
    return true;
  });

  const formatDate = (d: string) => new Date(d.includes('T') ? d : d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const RatingBar = ({ label, emoji, value, field }: { label: string; emoji: string; value: number; field: keyof VocalRatings }) => (
    <div className="flex items-center gap-2">
      <span className="text-xs w-20 text-gray-600">{emoji} {label}</span>
      <div className="flex gap-1 flex-1">
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} onClick={() => setRatings(prev => ({ ...prev, [field]: n }))}
            className={`flex-1 h-7 rounded-md text-xs font-bold transition-all ${
              n <= value ? n >= 4 ? 'bg-green-500 text-white' : n >= 3 ? 'bg-yellow-500 text-white' : 'bg-red-500 text-white' : 'bg-gray-100 text-gray-400'
            }`}>{n}</button>
        ))}
      </div>
      <span className="text-xs text-gray-400 w-16">{['','Poor','Needs work','OK','Good','Great'][value]}</span>
    </div>
  );

  if (loading) return (
    <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" /></div>
  );

  return (
    <div className="space-y-3 pb-8">
      <audio ref={audioRef} onEnded={() => setPlayingId(null)} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Vocal Coach</h1>
          <p className="text-xs text-gray-500">Assign songs & exercises · Review submissions</p>
        </div>
        <button onClick={() => setShowAssignModal(true)} className="flex items-center justify-center gap-1 px-4 py-2 bg-blue-500 text-white rounded-xl text-[12px] font-semibold hover:bg-blue-600 shadow-sm transition-all active:scale-[0.98] whitespace-nowrap">
          <Plus className="w-4 h-4" />
          Assign
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white rounded-2xl border border-gray-200/60 shadow-sm p-2.5">
          <div className="text-xs text-gray-400">Assignments</div>
          <div className="text-xl font-bold text-gray-900">{totalAssignments}</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200/60 shadow-sm p-2.5">
          <div className="text-xs text-gray-400">To Review 🔴</div>
          <div className="text-xl font-bold text-orange-500">{pendingReview}</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200/60 shadow-sm p-2.5">
          <div className="text-xs text-gray-400">Completed ✅</div>
          <div className="text-xl font-bold text-green-600">{completedCount}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100/80 rounded-xl p-0.5">
        {([['all', 'All Members'], ['pending', '🔴 To Review'], ['completed', '✅ Completed']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex-1 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${tab === key ? 'bg-white shadow-sm text-gray-900 font-semibold' : 'text-gray-500'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Member List */}
      <div className="bg-white rounded-2xl border border-gray-200/60 shadow-sm overflow-hidden">
        {filteredMembers.length === 0 ? (
          <div className="p-8 text-center">
            <Music className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-[13px] text-gray-400">{tab === 'all' ? 'No assignments yet' : `No ${tab} items`}</p>
          </div>
        ) : filteredMembers.map((ma, idx) => (
          <div key={ma.member.id} className={idx < filteredMembers.length - 1 ? 'border-b border-gray-100' : ''}>
            {/* Member row */}
            <button onClick={() => setExpandedMember(expandedMember === ma.member.id ? null : ma.member.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${ma.pendingSubmissions > 0 ? 'bg-orange-50/40' : 'hover:bg-gray-50/50'}`}>
              <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${getAvatarColor(ma.member.id)} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                {getInitials(ma.member)}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-semibold text-gray-900">{ma.member.first_name} {ma.member.last_name}</span>
                  {ma.member.voice_part && (
                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-md ${voiceColors[ma.member.voice_part] || 'text-gray-600 bg-gray-50'}`}>
                      {ma.member.voice_part}
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-400">
                  {ma.assignments.length} assignment{ma.assignments.length !== 1 ? 's' : ''}
                  {ma.pendingSubmissions > 0 && ` · ${ma.pendingSubmissions} pending`}
                  {ma.assignments.length > 0 && ma.assignments.every(a => a.completed) && ' · all completed ✅'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {ma.pendingSubmissions > 0 && <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />}
                {expandedMember === ma.member.id ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
              </div>
            </button>

            {/* Expanded */}
            {expandedMember === ma.member.id && (
              <div className="bg-gray-50/50 px-4 py-3 space-y-2.5">
                {ma.assignments.map(a => (
                  <div key={a.id} className="bg-white rounded-xl border border-gray-200/60 p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${a.assignment_type === 'song' ? 'text-purple-600 bg-purple-50' : 'text-blue-600 bg-blue-50'}`}>
                          {a.assignment_type === 'song' ? '🎵 Song' : '🏋️ Exercise'}
                        </span>
                        {a.submission ? (
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${
                            a.submission.status === 'pending' ? 'text-orange-600 bg-orange-50' :
                            a.submission.status === 'approved' ? 'text-green-600 bg-green-50' :
                            'text-blue-600 bg-blue-50'
                          }`}>
                            {a.submission.status === 'pending' ? 'Pending' : a.submission.status === 'approved' ? 'Approved' : 'Reviewed'}
                          </span>
                        ) : a.completed ? (
                          <span className="text-xs font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-md">Done</span>
                        ) : (
                          <span className="text-xs font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-md">Waiting</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {a.due_date && <span className="text-xs text-gray-400">Due: {formatDate(a.due_date)}</span>}
                        <button onClick={() => handleDelete(a.id)} className="text-gray-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>

                    <p className="text-[13px] font-semibold text-gray-900 mb-0.5">
                      {a.assignment_type === 'song' ? a.song?.title || 'Unknown Song' : a.exercise?.title || 'Unknown Exercise'}
                    </p>
                    {a.notes && <p className="text-xs text-gray-500 mb-2">{a.notes}</p>}

                    {/* Submission */}
                    {a.submission ? (
                      <div className="bg-gray-50 rounded-lg p-2.5 space-y-2 mt-2">
                        <div className="flex items-center gap-2.5">
                          <button onClick={() => playAudio(a.submission!.audio_url, a.submission!.id)}
                            className="w-8 h-8 rounded-full bg-purple-500 text-white flex items-center justify-center flex-shrink-0">
                            {playingId === a.submission.id ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                          </button>
                          <div className="flex-1">
                            <span className="text-[12px] font-medium text-gray-700">Member's recording</span>
                            <span className="text-xs text-gray-400 block">{formatDate(a.submission.created_at)}</span>
                          </div>
                        </div>

                        {a.submission.feedback_audio_url && (
                          <div className="flex items-center gap-2.5 bg-green-50 rounded-lg p-2">
                            <button onClick={() => playAudio(a.submission!.feedback_audio_url!, `fb-${a.submission!.id}`)}
                              className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center flex-shrink-0">
                              {playingId === `fb-${a.submission!.id}` ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                            </button>
                            <span className="text-[12px] font-medium text-green-700">Your feedback (sent)</span>
                          </div>
                        )}

                        {recordingFor === a.submission.id ? (
                          <div className="p-2 bg-red-50 rounded-lg">
                            {!recordedUrl ? (
                              <div className="flex items-center gap-2.5">
                                <button onClick={isRecording ? stopRecording : () => startRecording(a.submission!.id)}
                                  className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${isRecording ? 'bg-red-600 animate-pulse' : 'bg-red-500'}`}>
                                  {isRecording ? <Square className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                                </button>
                                <span className="text-[12px] text-red-700">{isRecording ? 'Recording...' : 'Tap to record'}</span>
                                <button onClick={cancelRecording} className="ml-auto text-xs text-gray-500">Cancel</button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <button onClick={() => playAudio(recordedUrl!, 'preview')} className="w-8 h-8 rounded-full bg-purple-500 text-white flex items-center justify-center">
                                  {playingId === 'preview' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                                </button>
                                <button onClick={cancelRecording} className="w-8 h-8 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center"><RotateCcw className="w-3.5 h-3.5" /></button>
                                <button onClick={() => sendFeedback(a.submission!.id)} disabled={sending}
                                  className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center disabled:opacity-50"><Send className="w-3.5 h-3.5" /></button>
                                <span className="text-xs text-gray-500">Send feedback</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <>
                          <div className="flex gap-2">
                            <button onClick={() => setRecordingFor(a.submission!.id)}
                              className="flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-100">
                              🎤 Feedback
                            </button>
                            <button onClick={() => startEvaluation(a.submission!.id)}
                              className="flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 bg-purple-50 text-purple-600 rounded-lg text-xs font-semibold hover:bg-purple-100">
                              🤖 AI Evaluate
                            </button>
                            {a.submission.status !== 'approved' && (
                              <button onClick={() => approveSubmission(a.submission!.id)}
                                className="flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 bg-green-50 text-green-600 rounded-lg text-xs font-semibold hover:bg-green-100">
                                ✅ Approve
                              </button>
                            )}
                          </div>

                          {/* AI Evaluation Panel */}
                          {evaluatingId === a.submission!.id && (
                            <div className="mt-2 bg-purple-50/50 rounded-xl border border-purple-200/60 p-3 space-y-3">
                              {!aiResult ? (
                                <>
                                  <div className="flex items-center justify-between">
                                    <span className="text-[12px] font-bold text-purple-800">🤖 AI Vocal Analysis</span>
                                    <button onClick={cancelEvaluation} className="text-xs text-gray-500">Cancel</button>
                                  </div>

                                  {/* Auto-Analyze Button */}
                                  {!analyzing ? (
                                    <button onClick={() => handleAutoAnalyze(a.submission!.audio_url, (a as any).reference_audio_url || null)}
                                      className="w-full py-2.5 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg text-[12px] font-semibold hover:from-purple-600 hover:to-blue-600 flex items-center justify-center gap-2">
                                      🔊 Auto-Analyze Recording
                                    </button>
                                  ) : (
                                    <div className="w-full py-2 bg-purple-100 rounded-lg text-center">
                                      <p className="text-xs font-semibold text-purple-700">{analysisProgress?.stage || 'Analyzing...'}</p>
                                      <div className="mx-4 mt-1.5 h-1.5 bg-purple-200 rounded-full overflow-hidden">
                                        <div className="h-full bg-purple-600 rounded-full transition-all duration-300" style={{ width: (analysisProgress?.percent || 0) + '%' }} />
                                      </div>
                                    </div>
                                  )}

                                  <div className="flex items-center gap-2 my-1">
                                    <div className="flex-1 h-px bg-gray-200" />
                                    <span className="text-[9px] text-gray-400">or adjust manually</span>
                                    <div className="flex-1 h-px bg-gray-200" />
                                  </div>

                                  <div className="space-y-1.5">
                                    <RatingBar label="Key" emoji="🎹" value={ratings.key_accuracy} field="key_accuracy" />
                                    <RatingBar label="Tone" emoji="🎵" value={ratings.tone_quality} field="tone_quality" />
                                    <RatingBar label="Notes" emoji="🎼" value={ratings.note_accuracy} field="note_accuracy" />
                                    <RatingBar label="Breathing" emoji="💨" value={ratings.breathing} field="breathing" />
                                    <RatingBar label="Rhythm" emoji="🥁" value={ratings.rhythm} field="rhythm" />
                                  </div>

                                  <button onClick={() => handleGenerateFeedback(a)} disabled={aiLoading}
                                    className="w-full py-2 bg-purple-600 text-white rounded-lg text-[12px] font-semibold hover:bg-purple-700 disabled:opacity-50">
                                    {aiLoading ? '⏳ Generating...' : '🤖 Generate Coaching Feedback'}
                                  </button>
                                </>
                              ) : (
                                <>
                                  <div className="flex items-center justify-between">
                                    <span className="text-[12px] font-bold text-purple-800">🤖 AI Analysis Results</span>
                                    <div className="flex gap-2">
                                      <button onClick={() => setAiResult(null)} className="text-xs text-purple-500">Re-rate</button>
                                      <button onClick={cancelEvaluation} className="text-xs text-gray-500">Close</button>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <div className={`w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold text-white flex-shrink-0 ${
                                      aiResult.overall_score >= 80 ? 'bg-green-500' : aiResult.overall_score >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}>
                                      {aiResult.overall_score}
                                    </div>
                                    <p className="text-[12px] font-semibold text-gray-900">{aiResult.summary}</p>
                                  </div>
                                  <div className="grid grid-cols-5 gap-1.5">
                                    {[
                                      { l: '🎹 Key', v: ratings.key_accuracy },
                                      { l: '🎵 Tone', v: ratings.tone_quality },
                                      { l: '🎼 Notes', v: ratings.note_accuracy },
                                      { l: '💨 Breath', v: ratings.breathing },
                                      { l: '🥁 Rhythm', v: ratings.rhythm },
                                    ].map(({ l, v }) => (
                                      <div key={l} className="text-center">
                                        <div className={`text-[14px] font-bold ${v >= 4 ? 'text-green-600' : v >= 3 ? 'text-yellow-600' : 'text-red-500'}`}>{v}/5</div>
                                        <div className="text-[9px] text-gray-500">{l}</div>
                                      </div>
                                    ))}
                                  </div>
                                  <button onClick={() => setShowAiDetails(!showAiDetails)}
                                    className="w-full text-left text-xs text-purple-600 font-medium">
                                    {showAiDetails ? '▼ Hide details' : '▶ Show detailed feedback'}
                                  </button>
                                  {showAiDetails && (
                                    <div className="space-y-2 text-xs">
                                      {Object.entries(aiResult.details).map(([area, text]) => (
                                        <div key={area} className="bg-white rounded-lg p-2">
                                          <span className="font-bold text-gray-700 capitalize">{area}:</span>
                                          <p className="text-gray-600 mt-0.5">{text as string}</p>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {aiResult.suggestions.length > 0 && (
                                    <div className="bg-blue-50 rounded-lg p-2">
                                      <span className="text-xs font-bold text-blue-700">💡 Suggestions:</span>
                                      {aiResult.suggestions.map((s: string, i: number) => <p key={i} className="text-xs text-blue-600 mt-0.5">• {s}</p>)}
                                    </div>
                                  )}
                                  <p className="text-xs text-gray-500 italic">{aiResult.encouragement}</p>
                                  <button onClick={() => handleSaveAiFeedback(a.submission!.id)}
                                    className="w-full py-2 bg-green-600 text-white rounded-lg text-[12px] font-semibold hover:bg-green-700">
                                    💾 Save & Send to Member
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                          </>
                        )}
                      </div>
                    ) : !a.completed && (
                      <p className="text-xs text-gray-400 italic mt-2">No submission yet</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Assignment Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50" onClick={() => { setShowAssignModal(false); resetForm(); }}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10">
              <button onClick={() => { setShowAssignModal(false); resetForm(); }} className="text-blue-500 text-[14px] font-medium">Cancel</button>
              <span className="text-[15px] font-bold text-gray-900">New Assignment</span>
              <button onClick={handleAssign} className="text-blue-500 text-[14px] font-semibold">Assign</button>
            </div>

            {/* Type toggle */}
            <div className="px-4 py-3 border-b border-gray-100">
              <div className="flex bg-gray-100/80 rounded-xl p-0.5">
                <button onClick={() => setAssignmentType('song')}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all ${assignmentType === 'song' ? 'bg-white shadow-sm text-gray-900 font-semibold' : 'text-gray-500'}`}>
                  🎵 Song
                </button>
                <button onClick={() => setAssignmentType('exercise')}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all ${assignmentType === 'exercise' ? 'bg-white shadow-sm text-gray-900 font-semibold' : 'text-gray-500'}`}>
                  🏋️ Exercise
                </button>
              </div>
            </div>

            {/* Assign to */}
            <div className="px-4 py-3 border-b border-gray-100">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Assign to</label>
              <div className="flex bg-gray-100/80 rounded-lg p-0.5 mt-1.5">
                {([['single', 'Single'], ['voice', 'By Voice'], ['all', 'All']] as const).map(([key, label]) => (
                  <button key={key} onClick={() => setSelectionMode(key)}
                    className={`flex-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${selectionMode === key ? 'bg-white shadow-sm text-gray-900 font-semibold' : 'text-gray-500'}`}>
                    {label}
                  </button>
                ))}
              </div>
              {selectionMode === 'single' && (
                <select value={selectedMember} onChange={e => setSelectedMember(e.target.value)}
                  className="w-full mt-2 text-[14px] text-gray-900 bg-gray-50 border-0 rounded-lg p-2.5 focus:ring-0">
                  <option value="">Choose a member...</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name} — {m.voice_part || 'No voice'}</option>)}
                </select>
              )}
              {selectionMode === 'voice' && (
                <select value={selectedVoicePart} onChange={e => setSelectedVoicePart(e.target.value)}
                  className="w-full mt-2 text-[14px] text-gray-900 bg-gray-50 border-0 rounded-lg p-2.5 focus:ring-0">
                  <option value="">Choose voice part...</option>
                  {voiceParts.map(vp => <option key={vp} value={vp}>{vp} ({members.filter(m => m.voice_part === vp).length})</option>)}
                </select>
              )}
              {selectionMode === 'all' && (
                <div className="mt-2 bg-blue-50 text-blue-600 px-3 py-2 rounded-lg text-[12px] font-medium">
                  Will assign to all {members.length} members
                </div>
              )}
            </div>

            {/* Song/Exercise selection */}
            <div className="px-4 py-3 border-b border-gray-100">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                {assignmentType === 'song' ? 'Song' : 'Exercise'}
              </label>
              {assignmentType === 'song' ? (
                <select value={selectedSong} onChange={e => setSelectedSong(e.target.value)}
                  className="w-full mt-1.5 text-[14px] text-gray-900 bg-gray-50 border-0 rounded-lg p-2.5 focus:ring-0">
                  <option value="">Choose a song...</option>
                  {songs.map(s => <option key={s.id} value={s.id}>{s.title}{s.composer ? ` — ${s.composer}` : ''}</option>)}
                </select>
              ) : (
                <select value={selectedExercise} onChange={e => setSelectedExercise(e.target.value)}
                  className="w-full mt-1.5 text-[14px] text-gray-900 bg-gray-50 border-0 rounded-lg p-2.5 focus:ring-0">
                  <option value="">Choose an exercise...</option>
                  {exercises.map(e => <option key={e.id} value={e.id}>{e.title} ({e.difficulty})</option>)}
                </select>
              )}
            </div>

            {/* Reference audio (songs only) */}
            {assignmentType === 'song' && (
              <div className="px-4 py-3 border-b border-gray-100">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Melody Reference</label>
                <p className="text-xs text-gray-400 mt-0.5">Record a melody for the member to follow</p>
                {!referenceAudioUrl ? (
                  <button onClick={isRecordingReference ? stopReferenceRecording : startReferenceRecording}
                    className={`mt-2 w-full flex items-center justify-center gap-2 px-3 py-3 rounded-xl border border-dashed text-[13px] transition-all ${
                      isRecordingReference ? 'border-red-400 bg-red-50 text-red-600 animate-pulse' : 'border-gray-300 bg-gray-50 text-gray-500 hover:bg-gray-100'
                    }`}>
                    {isRecordingReference ? <><Square className="w-4 h-4" /> Stop Recording</> : <><Mic className="w-4 h-4" /> Tap to Record Melody</>}
                  </button>
                ) : (
                  <div className="mt-2 flex items-center gap-2 p-2.5 bg-green-50 rounded-xl border border-green-200">
                    <button onClick={() => { if (audioRef.current) { audioRef.current.src = referenceAudioUrl; audioRef.current.play(); }}}
                      className="w-9 h-9 rounded-full bg-green-500 text-white flex items-center justify-center"><Play className="w-4 h-4" /></button>
                    <span className="text-[12px] text-green-700 flex-1 font-medium">Reference recorded ✓</span>
                    <button onClick={clearReferenceAudio} className="text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                  </div>
                )}
              </div>
            )}

            {/* Due date */}
            <div className="px-4 py-3 border-b border-gray-100">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Due Date</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                className="w-full mt-1.5 text-[14px] text-gray-900 bg-gray-50 border-0 rounded-lg p-2.5 focus:ring-0" />
            </div>

            {/* Notes */}
            <div className="px-4 py-3">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Add instructions..."
                className="w-full mt-1.5 text-[14px] text-gray-900 bg-gray-50 border-0 rounded-lg p-2.5 focus:ring-0 placeholder-gray-300 resize-none" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Users, Plus, CheckCircle, Clock, Music, Dumbbell, X, Calendar, Trash2,
  ChevronDown, ChevronRight, User, Play, Pause, Mic, Square, Send, RotateCcw
} from 'lucide-react';
import toast from 'react-hot-toast';

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

export default function VocalCoachAssignments() {
  const [members, setMembers] = useState<Member[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [memberAssignments, setMemberAssignments] = useState<MemberWithAssignments[]>([]);
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignmentType, setAssignmentType] = useState<'exercise' | 'song'>('exercise');
  const [selectedMember, setSelectedMember] = useState('');
  const [selectionMode, setSelectionMode] = useState<'single' | 'all' | 'voice'>('single');
  const [selectedVoicePart, setSelectedVoicePart] = useState('');
  const [selectedExercise, setSelectedExercise] = useState('');
  const [selectedSong, setSelectedSong] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Audio playback and recording
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [recordingFor, setRecordingFor] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load members
      const { data: membersData } = await supabase
        .from('members')
        .select('id, first_name, last_name, email, voice_part')
        .eq('role', 'member')
        .order('first_name');
      setMembers(membersData || []);

      // Load exercises
      const { data: exercisesData } = await supabase
        .from('smart_coach_exercises')
        .select('id, title, description, exercise_type, difficulty')
        .order('created_at', { ascending: false })
        .limit(50);
      setExercises(exercisesData || []);

      // Load songs
      const { data: songsData } = await supabase
        .from('songs')
        .select('id, title, composer')
        .order('title');
      setSongs(songsData || []);

      // Load assignments
      const { data: assignmentsData } = await supabase
        .from('exercise_assignments')
        .select('*')
        .order('created_at', { ascending: false });

      // Load submissions
      const { data: submissionsData } = await supabase
        .from('song_submissions')
        .select('*')
        .order('created_at', { ascending: false });

      // Enrich assignments with member/exercise/song/submission data
      const enriched: Assignment[] = (assignmentsData || []).map((a) => {
        const member = membersData?.find(m => m.id === a.member_id) || null;
        const exercise = exercisesData?.find(e => e.id === a.exercise_id) || null;
        const song = songsData?.find(s => s.id === a.song_id) || null;
        const submission = submissionsData?.find(s => s.assignment_id === a.id) || null;
        
        return { ...a, member, exercise, song, submission };
      });

      // Group by member
      const grouped: MemberWithAssignments[] = [];
      const memberIds = [...new Set(enriched.map(a => a.member_id))];
      
      memberIds.forEach(memberId => {
        const member = membersData?.find(m => m.id === memberId);
        if (member) {
          const memberAssigns = enriched.filter(a => a.member_id === memberId);
          const pendingSubmissions = memberAssigns.filter(
            a => a.submission && a.submission.status === 'pending'
          ).length;
          
          grouped.push({
            member,
            assignments: memberAssigns,
            pendingSubmissions
          });
        }
      });

      // Sort by pending submissions (most first)
      grouped.sort((a, b) => b.pendingSubmissions - a.pendingSubmissions);
      
      setMemberAssignments(grouped);

    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Audio functions
  const playAudio = (url: string, id: string) => {
    if (playingId === id) {
      audioRef.current?.pause();
      setPlayingId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.play();
        setPlayingId(id);
      }
    }
  };

  const startRecording = async (submissionId: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setRecordedBlob(blob);
        setRecordedUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingFor(submissionId);
    } catch (error) {
      toast.error('Could not access microphone');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const cancelRecording = () => {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedBlob(null);
    setRecordedUrl(null);
    setRecordingFor(null);
  };

  const sendFeedback = async (submissionId: string) => {
    if (!recordedBlob) return;
    setSending(true);

    try {
      const fileName = `feedback/${submissionId}/${Date.now()}.webm`;
      const { error: uploadError } = await supabase.storage
        .from('recordings')
        .upload(fileName, recordedBlob, { contentType: 'audio/webm' });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('recordings').getPublicUrl(fileName);

      await supabase
        .from('song_submissions')
        .update({ feedback_audio_url: publicUrl, status: 'reviewed' })
        .eq('id', submissionId);

      toast.success('Feedback sent!');
      cancelRecording();
      loadData();
    } catch (error) {
      console.error('Error sending feedback:', error);
      toast.error('Failed to send feedback');
    } finally {
      setSending(false);
    }
  };

  const approveSubmission = async (id: string) => {
    try {
      await supabase.from('song_submissions').update({ status: 'approved' }).eq('id', id);
      toast.success('Approved!');
      loadData();
    } catch (error) {
      toast.error('Failed to approve');
    }
  };

  const handleAssignExercise = async () => {
    if (selectionMode === 'single' && !selectedMember) {
      toast.error('Please select a member');
      return;
    }

    if (selectionMode === 'voice' && !selectedVoicePart) {
      toast.error('Please select a voice part');
      return;
    }

    if (assignmentType === 'exercise' && !selectedExercise) {
      toast.error('Please select an exercise');
      return;
    }

    if (assignmentType === 'song' && !selectedSong) {
      toast.error('Please select a song');
      return;
    }

    try {
      const { data: userData } = await supabase.auth.getUser();
      
      // Determine which members to assign to
      let targetMembers: string[] = [];
      
      if (selectionMode === 'single') {
        targetMembers = [selectedMember];
      } else if (selectionMode === 'all') {
        targetMembers = members.map(m => m.id);
      } else if (selectionMode === 'voice') {
        targetMembers = members.filter(m => m.voice_part === selectedVoicePart).map(m => m.id);
      }

      if (targetMembers.length === 0) {
        toast.error('No members found for selection');
        return;
      }

      // Create assignments for all target members
      const assignments = targetMembers.map(memberId => ({
        member_id: memberId,
        assigned_by: userData?.user?.id,
        assignment_type: assignmentType,
        exercise_id: assignmentType === 'exercise' ? selectedExercise : null,
        song_id: assignmentType === 'song' ? selectedSong : null,
        due_date: dueDate || null,
        notes: notes || null
      }));

      const { error } = await supabase
        .from('exercise_assignments')
        .insert(assignments);

      if (error) throw error;

      toast.success(\`Assigned to \${targetMembers.length} member\${targetMembers.length > 1 ? 's' : ''}!\`);
      setShowAssignModal(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error assigning:', error);
      toast.error('Failed to assign');
    }
  };

  const handleDeleteAssignment = async (id: string) => {
    if (!confirm('Delete this assignment?')) return;

    try {
      const { error } = await supabase
        .from('exercise_assignments')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Assignment deleted');
      loadData();
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Failed to delete');
    }
  };

  const resetForm = () => {
    setSelectedMember('');
    setSelectedExercise('');
    setSelectedSong('');
    setDueDate('');
    setNotes('');
    setAssignmentType('exercise');
    setSelectionMode('single');
    setSelectedVoicePart('');
  };

  const voiceParts = [...new Set(members.map(m => m.voice_part).filter(Boolean))].sort();

  const totalAssignments = memberAssignments.reduce((sum, m) => sum + m.assignments.length, 0);
  const completedAssignments = memberAssignments.reduce(
    (sum, m) => sum + m.assignments.filter(a => a.completed).length, 0
  );
  const totalPendingSubmissions = memberAssignments.reduce((sum, m) => sum + m.pendingSubmissions, 0);

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    reviewed: 'bg-blue-100 text-blue-700',
    approved: 'bg-green-100 text-green-700'
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <audio ref={audioRef} onEnded={() => setPlayingId(null)} />
      
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Vocal Coach</h1>
          <p className="text-gray-600 mt-1">Manage assignments and review member submissions</p>
        </div>
        <button
          onClick={() => setShowAssignModal(true)}
          className="flex items-center space-x-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
        >
          <Plus className="w-5 h-5" />
          <span>New Assignment</span>
        </button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Assignments</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{totalAssignments}</p>
            </div>
            <Music className="w-8 h-8 text-purple-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Completed</p>
              <p className="text-3xl font-bold text-green-600 mt-1">{completedAssignments}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending Review</p>
              <p className="text-3xl font-bold text-orange-600 mt-1">{totalPendingSubmissions}</p>
            </div>
            <Clock className="w-8 h-8 text-orange-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Members</p>
              <p className="text-3xl font-bold text-blue-600 mt-1">{memberAssignments.length}</p>
            </div>
            <Users className="w-8 h-8 text-blue-600" />
          </div>
        </div>
      </div>

      {/* Members with Assignments */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Members & Assignments</h2>
          <p className="text-sm text-gray-500 mt-1">Click on a member to view and manage their assignments</p>
        </div>

        {memberAssignments.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No assignments yet</p>
            <p className="text-sm text-gray-500 mt-1">Click "New Assignment" to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {memberAssignments.map(({ member, assignments, pendingSubmissions }) => (
              <div key={member.id}>
                {/* Member Header - Clickable */}
                <button
                  onClick={() => setExpandedMember(expandedMember === member.id ? null : member.id)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-purple-600" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold text-gray-900">
                        {member.first_name} {member.last_name}
                      </h3>
                      <p className="text-sm text-gray-500">{member.voice_part || member.email}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        {assignments.length} assignment{assignments.length !== 1 ? 's' : ''}
                      </p>
                      {pendingSubmissions > 0 && (
                        <p className="text-xs text-orange-600 font-medium">
                          {pendingSubmissions} pending review
                        </p>
                      )}
                    </div>
                    {expandedMember === member.id ? (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </button>

                {/* Expanded Assignments */}
                {expandedMember === member.id && (
                  <div className="bg-gray-50 p-4 space-y-3 border-t">
                    {assignments.map((assignment) => (
                      <div key={assignment.id} className="bg-white rounded-lg p-4 border shadow-sm">
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              {assignment.assignment_type === 'song' ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                  <Music className="w-3 h-3 mr-1" />
                                  Song
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  <Dumbbell className="w-3 h-3 mr-1" />
                                  Exercise
                                </span>
                              )}
                              {assignment.completed ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Completed
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                  <Clock className="w-3 h-3 mr-1" />
                                  Pending
                                </span>
                              )}
                            </div>
                            <p className="font-medium text-gray-900">
                              {assignment.assignment_type === 'song'
                                ? assignment.song?.title || 'Unknown Song'
                                : assignment.exercise?.title || 'Unknown Exercise'}
                            </p>
                            {assignment.notes && (
                              <p className="text-sm text-gray-500 mt-1">{assignment.notes}</p>
                            )}
                            {assignment.due_date && (
                              <p className="text-xs text-gray-400 mt-1">
                                Due: {new Date(assignment.due_date).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => handleDeleteAssignment(assignment.id)}
                            className="text-gray-400 hover:text-red-600 p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Submission Section */}
                        {assignment.submission ? (
                          <div className="border-t pt-3 mt-3">
                            <p className="text-xs font-medium text-gray-500 uppercase mb-2">Submission</p>
                            
                            {/* Member's Recording */}
                            <div className="flex items-center gap-3 mb-2 p-2 bg-gray-50 rounded-lg">
                              <button
                                onClick={() => playAudio(assignment.submission!.audio_url, assignment.submission!.id)}
                                className="w-9 h-9 rounded-full bg-purple-600 text-white flex items-center justify-center flex-shrink-0"
                              >
                                {playingId === assignment.submission.id ? (
                                  <Pause className="w-4 h-4" />
                                ) : (
                                  <Play className="w-4 h-4" />
                                )}
                              </button>
                              <div className="flex-1">
                                <span className="text-sm text-gray-700">Member's Recording</span>
                                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[assignment.submission.status]}`}>
                                  {assignment.submission.status}
                                </span>
                              </div>
                            </div>

                            {/* Director's Feedback */}
                            {assignment.submission.feedback_audio_url && (
                              <div className="flex items-center gap-3 mb-2 p-2 bg-green-50 rounded-lg">
                                <button
                                  onClick={() => playAudio(assignment.submission!.feedback_audio_url!, `fb-${assignment.submission!.id}`)}
                                  className="w-9 h-9 rounded-full bg-green-600 text-white flex items-center justify-center flex-shrink-0"
                                >
                                  {playingId === `fb-${assignment.submission.id}` ? (
                                    <Pause className="w-4 h-4" />
                                  ) : (
                                    <Play className="w-4 h-4" />
                                  )}
                                </button>
                                <span className="text-sm text-green-700">Your Feedback (sent)</span>
                              </div>
                            )}

                            {/* Recording Interface */}
                            {recordingFor === assignment.submission.id ? (
                              <div className="p-2 bg-red-50 rounded-lg">
                                {!recordedUrl ? (
                                  <div className="flex items-center gap-3">
                                    <button
                                      onClick={isRecording ? stopRecording : () => startRecording(assignment.submission!.id)}
                                      className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                                        isRecording ? 'bg-red-600 animate-pulse' : 'bg-red-500'
                                      } text-white`}
                                    >
                                      {isRecording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                                    </button>
                                    <span className="text-sm text-red-700">
                                      {isRecording ? 'Recording...' : 'Click to record'}
                                    </span>
                                    <button onClick={cancelRecording} className="ml-auto text-gray-500 text-sm">
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => playAudio(recordedUrl, 'preview')}
                                      className="w-9 h-9 rounded-full bg-purple-600 text-white flex items-center justify-center flex-shrink-0"
                                    >
                                      {playingId === 'preview' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                                    </button>
                                    <button
                                      onClick={cancelRecording}
                                      className="w-9 h-9 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center flex-shrink-0"
                                    >
                                      <RotateCcw className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => sendFeedback(assignment.submission!.id)}
                                      disabled={sending}
                                      className="w-9 h-9 rounded-full bg-green-600 text-white flex items-center justify-center flex-shrink-0 disabled:opacity-50"
                                    >
                                      <Send className="w-4 h-4" />
                                    </button>
                                    <span className="text-sm text-gray-600 ml-1">Send feedback</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="flex gap-2 mt-2">
                                <button
                                  onClick={() => setRecordingFor(assignment.submission!.id)}
                                  className="flex items-center justify-center gap-1 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm"
                                >
                                  <Mic className="w-3 h-3" />
                                  Record Feedback
                                </button>
                                {assignment.submission.status !== 'approved' && (
                                  <button
                                    onClick={() => approveSubmission(assignment.submission!.id)}
                                    className="flex items-center justify-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 text-sm"
                                  >
                                    <CheckCircle className="w-3 h-3" />
                                    Approve
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="border-t pt-3 mt-3">
                            <p className="text-sm text-gray-400 italic">No submission yet</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Assignment Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">New Assignment</h3>
              <button
                onClick={() => { setShowAssignModal(false); resetForm(); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Assignment Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Assignment Type</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setAssignmentType('exercise')}
                    className={`flex items-center justify-center space-x-2 px-4 py-3 rounded-lg border-2 ${
                      assignmentType === 'exercise'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Dumbbell className="w-5 h-5" />
                    <span className="font-medium">Exercise</span>
                  </button>
                  <button
                    onClick={() => setAssignmentType('song')}
                    className={`flex items-center justify-center space-x-2 px-4 py-3 rounded-lg border-2 ${
                      assignmentType === 'song'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Music className="w-5 h-5" />
                    <span className="font-medium">Song</span>
                  </button>
                </div>
              </div>

              {/* Assign To */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Assign To *</label>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setSelectionMode('single')}
                    className={\`px-3 py-2 rounded-lg border-2 text-sm font-medium \${
                      selectionMode === 'single'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }\`}
                  >
                    Single
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectionMode('voice')}
                    className={\`px-3 py-2 rounded-lg border-2 text-sm font-medium \${
                      selectionMode === 'voice'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }\`}
                  >
                    By Voice
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectionMode('all')}
                    className={\`px-3 py-2 rounded-lg border-2 text-sm font-medium \${
                      selectionMode === 'all'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }\`}
                  >
                    All
                  </button>
                </div>

                {selectionMode === 'single' && (
                  <select
                    value={selectedMember}
                    onChange={(e) => setSelectedMember(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="">Choose a member...</option>
                    {members.map(member => (
                      <option key={member.id} value={member.id}>
                        {member.first_name} {member.last_name}
                      </option>
                    ))}
                  </select>
                )}

                {selectionMode === 'voice' && (
                  <select
                    value={selectedVoicePart}
                    onChange={(e) => setSelectedVoicePart(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="">Choose a voice part...</option>
                    {voiceParts.map(part => (
                      <option key={part} value={part}>
                        {part} ({members.filter(m => m.voice_part === part).length} members)
                      </option>
                    ))}
                  </select>
                )}

                {selectionMode === 'all' && (
                  <div className="bg-indigo-50 text-indigo-700 px-3 py-2 rounded-lg text-sm">
                    Will assign to all {members.length} members
                  </div>
                )}
              </div>

              {/* Exercise/Song Selection */}
              {assignmentType === 'exercise' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Exercise *</label>
                  <select
                    value={selectedExercise}
                    onChange={(e) => setSelectedExercise(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="">Choose an exercise...</option>
                    {exercises.map(exercise => (
                      <option key={exercise.id} value={exercise.id}>
                        {exercise.title} ({exercise.difficulty})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Song *</label>
                  <select
                    value={selectedSong}
                    onChange={(e) => setSelectedSong(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="">Choose a song...</option>
                    {songs.map(song => (
                      <option key={song.id} value={song.id}>
                        {song.title} {song.composer && `- ${song.composer}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Due Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Due Date (Optional)</label>
                <div className="relative">
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 pl-10"
                  />
                  <Calendar className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any special instructions..."
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
            </div>

            {/* Buttons */}
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => { setShowAssignModal(false); resetForm(); }}
                className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignExercise}
                className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
              >
                Assign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

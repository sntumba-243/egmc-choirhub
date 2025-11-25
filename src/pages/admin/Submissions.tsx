import { useState, useEffect, useRef } from 'react';
import { Play, Pause, Mic, Square, Send, RotateCcw, Clock, CheckCircle, ChevronDown, ChevronRight, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

interface Submission {
  id: string;
  member_id: string;
  song_id: string;
  audio_url: string;
  status: 'pending' | 'reviewed' | 'approved';
  feedback: string | null;
  feedback_audio_url: string | null;
  created_at: string;
  song: { title: string };
}

interface MemberWithSubmissions {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  voice_part: string;
  submissions: Submission[];
}

export default function Submissions() {
  const [members, setMembers] = useState<MemberWithSubmissions[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
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
    fetchSubmissions();
  }, []);

  const fetchSubmissions = async () => {
    try {
      // Fetch all submissions with song info
      const { data: submissions, error } = await supabase
        .from('song_submissions')
        .select(`*, song:songs(title)`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get unique member IDs
      const memberIds = [...new Set(submissions?.map(s => s.member_id) || [])];
      
      if (memberIds.length === 0) {
        setMembers([]);
        setLoading(false);
        return;
      }

      // Fetch member details
      const { data: membersData, error: membersError } = await supabase
        .from('members')
        .select('id, first_name, last_name, email, voice_part')
        .in('id', memberIds);

      if (membersError) throw membersError;

      // Group submissions by member
      const membersWithSubs: MemberWithSubmissions[] = (membersData || []).map(member => ({
        ...member,
        submissions: (submissions || []).filter(s => s.member_id === member.id)
      }));

      // Sort by most recent submission
      membersWithSubs.sort((a, b) => {
        const aDate = a.submissions[0]?.created_at || '';
        const bDate = b.submissions[0]?.created_at || '';
        return bDate.localeCompare(aDate);
      });

      setMembers(membersWithSubs);
    } catch (error) {
      console.error('Error fetching submissions:', error);
      toast.error('Failed to load submissions');
    } finally {
      setLoading(false);
    }
  };

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
      fetchSubmissions();
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
      fetchSubmissions();
    } catch (error) {
      toast.error('Failed to approve');
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    reviewed: 'bg-blue-100 text-blue-700',
    approved: 'bg-green-100 text-green-700'
  };

  const getPendingCount = (subs: Submission[]) => subs.filter(s => s.status === 'pending').length;

  if (loading) {
    return (
      <div className="p-6 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <audio ref={audioRef} onEnded={() => setPlayingId(null)} />
      
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Member Submissions</h1>
      <p className="text-gray-500 mb-6">Click on a member to view and respond to their recordings</p>

      {members.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border">
          <User className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No submissions yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {members.map((member) => (
            <div key={member.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
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
                    <p className="text-sm text-gray-500">{member.voice_part || 'Member'}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">{member.submissions.length} recording{member.submissions.length !== 1 ? 's' : ''}</p>
                    {getPendingCount(member.submissions) > 0 && (
                      <p className="text-xs text-yellow-600">{getPendingCount(member.submissions)} pending review</p>
                    )}
                  </div>
                  {expandedMember === member.id ? (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </button>

              {/* Expanded Submissions */}
              {expandedMember === member.id && (
                <div className="border-t bg-gray-50 p-4 space-y-3">
                  {member.submissions.map((sub) => (
                    <div key={sub.id} className="bg-white rounded-lg p-4 border">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div>
                          <p className="font-medium text-purple-600">{sub.song?.title}</p>
                          <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(sub.created_at)}
                          </p>
                        </div>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[sub.status]}`}>
                          {sub.status}
                        </span>
                      </div>

                      {/* Member's Recording */}
                      <div className="flex items-center gap-3 mb-3 p-3 bg-gray-50 rounded-lg">
                        <button
                          onClick={() => playAudio(sub.audio_url, sub.id)}
                          className="w-10 h-10 rounded-full bg-purple-600 text-white flex items-center justify-center flex-shrink-0"
                        >
                          {playingId === sub.id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </button>
                        <span className="text-sm text-gray-600">Member's Recording</span>
                      </div>

                      {/* Director's Feedback */}
                      {sub.feedback_audio_url && (
                        <div className="flex items-center gap-3 mb-3 p-3 bg-green-50 rounded-lg">
                          <button
                            onClick={() => playAudio(sub.feedback_audio_url!, `feedback-${sub.id}`)}
                            className="w-10 h-10 rounded-full bg-green-600 text-white flex items-center justify-center flex-shrink-0"
                          >
                            {playingId === `feedback-${sub.id}` ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          </button>
                          <span className="text-sm text-green-700">Your Feedback (sent)</span>
                        </div>
                      )}

                      {/* Recording Interface */}
                      {recordingFor === sub.id ? (
                        <div className="p-3 bg-red-50 rounded-lg">
                          {!recordedUrl ? (
                            <div className="flex items-center gap-3">
                              <button
                                onClick={isRecording ? stopRecording : () => startRecording(sub.id)}
                                className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                                  isRecording ? 'bg-red-600 animate-pulse' : 'bg-red-500'
                                } text-white`}
                              >
                                {isRecording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                              </button>
                              <span className="text-sm text-red-700">
                                {isRecording ? 'Recording... Click to stop' : 'Click to record'}
                              </span>
                              <button onClick={cancelRecording} className="ml-auto text-gray-500 text-sm">
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => playAudio(recordedUrl, 'preview')}
                                className="w-10 h-10 rounded-full bg-purple-600 text-white flex items-center justify-center flex-shrink-0"
                              >
                                {playingId === 'preview' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                              </button>
                              <button
                                onClick={cancelRecording}
                                className="w-10 h-10 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center flex-shrink-0"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => sendFeedback(sub.id)}
                                disabled={sending}
                                className="w-10 h-10 rounded-full bg-green-600 text-white flex items-center justify-center flex-shrink-0 disabled:opacity-50"
                              >
                                <Send className="w-4 h-4" />
                              </button>
                              <span className="text-sm text-gray-600">Preview & Send</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={() => setRecordingFor(sub.id)}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm"
                          >
                            <Mic className="w-4 h-4" />
                            Record Feedback
                          </button>
                          {sub.status !== 'approved' && (
                            <button
                              onClick={() => approveSubmission(sub.id)}
                              className="flex items-center justify-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 text-sm"
                            >
                              <CheckCircle className="w-4 h-4" />
                              Approve
                            </button>
                          )}
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
  );
}

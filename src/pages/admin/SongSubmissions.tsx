import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Play, 
  Pause,
  Trash2,
  CheckCircle,
  Clock,
  MessageSquare,
  X
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Submission {
  id: string;
  member_id: string;
  song_id: string;
  audio_url: string;
  duration_seconds: number;
  submitted_at: string;
  status: 'pending' | 'reviewed' | 'approved';
  feedback: string | null;
  member: { first_name: string; last_name: string } | null;
  song: { title: string } | null;
}

export default function SongSubmissions() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [feedback, setFeedback] = useState('');
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());

  useEffect(() => {
    loadSubmissions();
  }, []);

  const loadSubmissions = async () => {
    try {
      setLoading(true);

      const { data: submissionsData } = await supabase
        .from('song_submissions')
        .select('*')
        .order('submitted_at', { ascending: false });

      if (submissionsData) {
        // Fetch member and song details
        const enriched = await Promise.all(
          submissionsData.map(async (sub) => {
            const { data: member } = await supabase
              .from('members')
              .select('first_name, last_name')
              .eq('id', sub.member_id)
              .single();

            const { data: song } = await supabase
              .from('songs')
              .select('title')
              .eq('id', sub.song_id)
              .single();

            return { ...sub, member, song };
          })
        );

        setSubmissions(enriched);
      }
    } catch (error) {
      console.error('Error loading submissions:', error);
      toast.error('Failed to load submissions');
    } finally {
      setLoading(false);
    }
  };

  const togglePlay = (submissionId: string, audioUrl: string) => {
    const audioMap = audioRefs.current;
    
    // Pause all other audio
    audioMap.forEach((audio, id) => {
      if (id !== submissionId) {
        audio.pause();
      }
    });

    let audio = audioMap.get(submissionId);
    
    if (!audio) {
      audio = new Audio(audioUrl);
      audio.onended = () => setPlayingId(null);
      audioMap.set(submissionId, audio);
    }

    if (playingId === submissionId) {
      audio.pause();
      setPlayingId(null);
    } else {
      audio.play();
      setPlayingId(submissionId);
    }
  };

  const handleApprove = async (submission: Submission) => {
    try {
      const { error } = await supabase
        .from('song_submissions')
        .update({ 
          status: 'approved',
          reviewed_at: new Date().toISOString()
        })
        .eq('id', submission.id);

      if (error) throw error;

      toast.success('Submission approved!');
      loadSubmissions();
    } catch (error) {
      console.error('Error approving:', error);
      toast.error('Failed to approve');
    }
  };

  const handleDelete = async (submission: Submission) => {
    if (!confirm(`Delete ${submission.member?.first_name}'s recording of "${submission.song?.title}"?`)) {
      return;
    }

    try {
      // Extract file path from URL
      const urlParts = submission.audio_url.split('/song-recordings/');
      const filePath = urlParts[1];

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('song-recordings')
        .remove([filePath]);

      if (storageError) throw storageError;

      // Delete database record
      const { error: dbError } = await supabase
        .from('song_submissions')
        .delete()
        .eq('id', submission.id);

      if (dbError) throw dbError;

      toast.success('Recording deleted');
      loadSubmissions();
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Failed to delete');
    }
  };

  const handleAddFeedback = async () => {
    if (!selectedSubmission || !feedback.trim()) return;

    try {
      const { error } = await supabase
        .from('song_submissions')
        .update({ 
          feedback: feedback.trim(),
          status: 'reviewed',
          reviewed_at: new Date().toISOString()
        })
        .eq('id', selectedSubmission.id);

      if (error) throw error;

      toast.success('Feedback added!');
      setShowFeedbackModal(false);
      setFeedback('');
      setSelectedSubmission(null);
      loadSubmissions();
    } catch (error) {
      console.error('Error adding feedback:', error);
      toast.error('Failed to add feedback');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString.includes('T') ? dateString : dateString + 'T00:00:00');
    return date.toLocaleString();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-700';
      case 'reviewed':
        return 'bg-blue-100 text-blue-700';
      default:
        return 'bg-yellow-100 text-yellow-700';
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  const pendingSubmissions = submissions.filter(s => s.status === 'pending');
  const reviewedSubmissions = submissions.filter(s => s.status !== 'pending');

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Song Submissions</h1>
        <p className="text-gray-600 mt-1">Review member recordings</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending Review</p>
              <p className="text-3xl font-bold text-yellow-600 mt-1">
                {pendingSubmissions.length}
              </p>
            </div>
            <Clock className="w-8 h-8 text-yellow-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Reviewed</p>
              <p className="text-3xl font-bold text-blue-600 mt-1">
                {submissions.filter(s => s.status === 'reviewed').length}
              </p>
            </div>
            <MessageSquare className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Approved</p>
              <p className="text-3xl font-bold text-green-600 mt-1">
                {submissions.filter(s => s.status === 'approved').length}
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </div>
      </div>

      {/* Pending Submissions */}
      {pendingSubmissions.length > 0 && (
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">
              Pending Review ({pendingSubmissions.length})
            </h2>
          </div>
          <div className="divide-y divide-gray-200">
            {pendingSubmissions.map((submission) => (
              <div key={submission.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {submission.member?.first_name} {submission.member?.last_name}
                      </h3>
                      <span className={`text-xs px-2 py-1 rounded ${getStatusColor(submission.status)}`}>
                        {submission.status}
                      </span>
                    </div>
                    <p className="text-gray-600 mb-1">{submission.song?.title}</p>
                    <p className="text-sm text-gray-500">
                      Submitted: {formatDate(submission.submitted_at)} • 
                      Duration: {formatDuration(submission.duration_seconds)}
                    </p>
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => togglePlay(submission.id, submission.audio_url)}
                      className="bg-indigo-600 text-white p-3 rounded-full hover:bg-indigo-700"
                    >
                      {playingId === submission.id ? (
                        <Pause className="w-5 h-5" />
                      ) : (
                        <Play className="w-5 h-5" />
                      )}
                    </button>

                    <button
                      onClick={() => {
                        setSelectedSubmission(submission);
                        setShowFeedbackModal(true);
                      }}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                    >
                      Add Feedback
                    </button>

                    <button
                      onClick={() => handleApprove(submission)}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                    >
                      Approve
                    </button>

                    <button
                      onClick={() => handleDelete(submission)}
                      className="bg-red-600 text-white p-2 rounded-lg hover:bg-red-700"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reviewed/Approved Submissions */}
      {reviewedSubmissions.length > 0 && (
        <details className="bg-white rounded-lg shadow">
          <summary className="p-6 cursor-pointer hover:bg-gray-50">
            <span className="text-lg font-semibold text-gray-900">
              Reviewed & Approved ({reviewedSubmissions.length})
            </span>
          </summary>
          <div className="divide-y divide-gray-200">
            {reviewedSubmissions.map((submission) => (
              <div key={submission.id} className="p-6 bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-700">
                        {submission.member?.first_name} {submission.member?.last_name}
                      </h3>
                      <span className={`text-xs px-2 py-1 rounded ${getStatusColor(submission.status)}`}>
                        {submission.status}
                      </span>
                    </div>
                    <p className="text-gray-600 mb-1">{submission.song?.title}</p>
                    {submission.feedback && (
                      <p className="text-sm text-gray-600 mt-2 italic">
                        Feedback: {submission.feedback}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => handleDelete(submission)}
                    className="bg-red-600 text-white p-2 rounded-lg hover:bg-red-700"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Feedback Modal */}
      {showFeedbackModal && selectedSubmission && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Add Feedback</h3>
              <button
                onClick={() => {
                  setShowFeedbackModal(false);
                  setFeedback('');
                  setSelectedSubmission(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-gray-600 mb-4">
              {selectedSubmission.member?.first_name} - {selectedSubmission.song?.title}
            </p>

            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Enter your feedback..."
              rows={4}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4"
            />

            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowFeedbackModal(false);
                  setFeedback('');
                  setSelectedSubmission(null);
                }}
                className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleAddFeedback}
                className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
              >
                Submit Feedback
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

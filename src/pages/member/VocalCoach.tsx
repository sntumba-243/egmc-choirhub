import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Brain, 
  TrendingUp, 
  Dumbbell, 
  Plus,
  Music,
  CheckCircle,
  Clock,
  Calendar,
  Play,
  Pause
} from 'lucide-react';
import toast from 'react-hot-toast';
import { SongRecorder } from '../../components/SongRecorder';

interface Exercise {
  id: string;
  title: string;
  description: string;
  exercise_type: string;
  difficulty: string;
}

interface Assignment {
  id: string;
  assignment_type: 'exercise' | 'song';
  due_date: string | null;
  notes: string | null;
  completed: boolean;
  reference_audio_url: string | null;
  exercise: Exercise | null;
  song: { id: string; title: string } | null;
}

export function VocalCoach() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showRecorder, setShowRecorder] = useState(false);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [playingFeedback, setPlayingFeedback] = useState<string | null>(null);
  const [playingReference, setPlayingReference] = useState<string | null>(null);
  const referenceAudioRef = useRef<HTMLAudioElement | null>(null);
  const feedbackAudioRef = useRef<HTMLAudioElement | null>(null);
  const [selectedSongForRecording, setSelectedSongForRecording] = useState<{
    id: string;
    title: string;
    assignmentId?: string;
  } | null>(null);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Load member's own generated exercises
      const { data: exercisesData } = await supabase
        .from('smart_coach_exercises')
        .select('*')
        .eq('member_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      setExercises(exercisesData || []);

      // Load assignments from admin
      const { data: assignmentsData } = await supabase
        .from('exercise_assignments')
        .select(`
          id,
          assignment_type,
          reference_audio_url,
          reference_audio_url,
          due_date,
          notes,
          completed,
          exercise_id,
          song_id
        `)
        .eq('member_id', user.id)
        .order('created_at', { ascending: false });

      if (assignmentsData) {
        // Fetch exercise and song details
        const enrichedAssignments = await Promise.all(
          assignmentsData.map(async (assignment) => {
            let exercise = null;
            let song = null;

            if (assignment.exercise_id) {
              const { data } = await supabase
                .from('smart_coach_exercises')
                .select('id, title, description, exercise_type, difficulty')
                .eq('id', assignment.exercise_id)
                .single();
              exercise = data;
            }

            if (assignment.song_id) {
              const { data } = await supabase
                .from('songs')
                .select('id, title')
                .eq('id', assignment.song_id)
                .single();
              song = data;
            }

            return { ...assignment, exercise, song };
          })
        );

        setAssignments(enrichedAssignments);
      }

    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      // Fetch member's submissions with feedback
      const { data: subsData } = await supabase
        .from('song_submissions')
        .select('*, song:songs(title)')
        .eq('member_id', user.id)
        .order('created_at', { ascending: false });
      
      if (subsData) setSubmissions(subsData);
      
      setLoading(false);
    }
  };

  const handleGenerateExercises = async () => {
    if (!user) return;

    // Check if user already has exercises
    if (exercises.length > 0) {
      const confirm = window.confirm(
        `You already have ${exercises.length} personalized exercises. Generate new ones? (This won't delete existing ones)`
      );
      if (!confirm) return;
    }

    try {
      setGenerating(true);
      const { smartCoachService } = await import('../../services/smartCoach');
      
      await smartCoachService.generateSmartCoachExercises(user.id);
      
      toast.success('New exercises generated!');
      loadData();
    } catch (error) {
      console.error('Error generating exercises:', error);
      toast.error('Failed to generate exercises');
    } finally {
      setGenerating(false);
    }
  };

  const toggleReferenceAudio = (url: string, id: string) => {
    if (playingReference === id) {
      referenceAudioRef.current?.pause();
      setPlayingReference(null);
    } else {
      if (referenceAudioRef.current) {
        referenceAudioRef.current.src = url;
        referenceAudioRef.current.play();
        setPlayingReference(id);
      }
    }
  };

  const handleMarkComplete = async (assignmentId: string) => {
    try {
      const { error } = await supabase
        .from('exercise_assignments')
        .update({ 
          completed: true,
          completed_at: new Date().toISOString()
        })
        .eq('id', assignmentId);

      if (error) throw error;

      toast.success('Assignment marked complete!');
      loadData();
    } catch (error) {
      console.error('Error marking complete:', error);
      toast.error('Failed to update');
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty?.toLowerCase()) {
      case 'beginner':
        return 'bg-green-100 text-green-700';
      case 'intermediate':
        return 'bg-yellow-100 text-yellow-700';
      case 'advanced':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  const pendingAssignments = assignments.filter(a => !a.completed);
  const completedAssignments = assignments.filter(a => a.completed);

  return (
    <div className="p-6 space-y-6">
      <audio ref={referenceAudioRef} onEnded={() => setPlayingReference(null)} />
      
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">AI Vocal Coach</h1>
        <p className="text-gray-600 mt-1">Personalized practice and progress tracking</p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={() => navigate('/member/vocal-coach/progress')}
          className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-6 rounded-lg hover:from-indigo-600 hover:to-purple-700 transition-all"
        >
          <div className="flex items-center justify-between">
            <div className="text-left">
              <h3 className="text-lg font-semibold">View Progress</h3>
              <p className="text-sm text-indigo-100 mt-1">Track your improvement</p>
            </div>
            <TrendingUp className="w-8 h-8" />
          </div>
        </button>

        <button
          onClick={handleGenerateExercises}
          disabled={generating}
          className="bg-gradient-to-r from-green-500 to-teal-600 text-white p-6 rounded-lg hover:from-green-600 hover:to-teal-700 transition-all disabled:opacity-50"
        >
          <div className="flex items-center justify-between">
            <div className="text-left">
              <h3 className="text-lg font-semibold">
                {generating ? 'Generating...' : 'Generate Exercises'}
              </h3>
              <p className="text-sm text-green-100 mt-1">AI-powered recommendations</p>
            </div>
            <Brain className="w-8 h-8" />
          </div>
        </button>
      </div>

      {/* Assigned by Director */}
      {pendingAssignments.length > 0 && (
        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center">
              <Calendar className="w-6 h-6 mr-2 text-yellow-600" />
              Assignments from Director ({pendingAssignments.length})
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingAssignments.map((assignment) => (
              <div
                key={assignment.id}
                className="bg-white border border-yellow-300 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    {assignment.assignment_type === 'song' ? (
                      <Music className="w-5 h-5 text-purple-600" />
                    ) : (
                      <Dumbbell className="w-5 h-5 text-blue-600" />
                    )}
                    <span className="text-xs font-medium text-gray-500 uppercase">
                      {assignment.assignment_type}
                    </span>
                  </div>
                  {assignment.due_date && (
                    <span className="text-xs text-gray-500">
                      Due: {new Date(assignment.due_date).toLocaleDateString()}
                    </span>
                  )}
                </div>

                {/* Reference Audio - Compact */}
                {assignment.reference_audio_url && assignment.assignment_type === 'song' && (
                  <button
                    onClick={() => toggleReferenceAudio(assignment.reference_audio_url!, assignment.id)}
                    className="mb-2 flex items-center gap-2 text-xs text-indigo-600 hover:text-indigo-800"
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                      playingReference === assignment.id ? 'bg-indigo-600 animate-pulse' : 'bg-indigo-100'
                    } ${playingReference === assignment.id ? 'text-white' : 'text-indigo-600'}`}>
                      {playingReference === assignment.id ? (
                        <Pause className="w-3 h-3" />
                      ) : (
                        <Play className="w-3 h-3" />
                      )}
                    </div>
                    <span className="font-medium">
                      {playingReference === assignment.id ? 'Playing melody...' : '🎵 Melody reference'}
                    </span>
                  </button>
                )}

                <h3 className="font-semibold text-gray-900 mb-2">
                  {assignment.assignment_type === 'song'
                    ? assignment.song?.title
                    : assignment.exercise?.title}
                </h3>

                {assignment.notes && (
                  <p className="text-sm text-gray-600 mb-3">{assignment.notes}</p>
                )}

                <div className="flex space-x-2">
                  {assignment.assignment_type === 'song' ? (
                    <>
                      <button
                        onClick={async () => {
                          const { data: song } = await supabase
                            .from('songs')
                            .select('sheet_music_url')
                            .eq('id', assignment.song?.id)
                            .single();
                          if (song?.sheet_music_url) {
                            navigate('/pdf-viewer', {
                              state: {
                                url: song.sheet_music_url,
                                title: assignment.song?.title,
                                songId: assignment.song?.id,
                                assignmentId: assignment.id
                              }
                            });
                          } else {
                            navigate(`/member/repertoire/${assignment.song?.id}`);
                          }
                        }}
                        className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 text-sm"
                      >
                        View & Record
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkComplete(assignment.id);
                        }}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => navigate(`/member/vocal-coach/practice/${assignment.exercise?.id}`)}
                        className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm"
                      >
                        Practice
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkComplete(assignment.id);
                        }}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Personalized Exercises */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">
              AI Personalized Exercises ({exercises.length})
            </h2>
            {exercises.length > 0 && (
              <button
                onClick={handleGenerateExercises}
                disabled={generating}
                className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center"
              >
                <Plus className="w-4 h-4 mr-1" />
                Generate More
              </button>
            )}
          </div>
        </div>

        {exercises.length === 0 ? (
          <div className="p-12 text-center">
            <Brain className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No exercises yet. Practice some songs to get personalized recommendations!</p>
            <button
              onClick={handleGenerateExercises}
              disabled={generating}
              className="mt-4 bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {generating ? 'Generating...' : 'Generate Exercises'}
            </button>
          </div>
        ) : (
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {exercises.map((exercise) => (
              <div
                key={exercise.id}
                onClick={() => navigate(`/member/vocal-coach/practice/${exercise.id}`)}
                className="border border-gray-200 rounded-lg p-4 hover:border-indigo-500 hover:shadow-md cursor-pointer transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-gray-900 flex-1">{exercise.title}</h3>
                </div>

                <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                  {exercise.description}
                </p>

                <div className="flex items-center space-x-2">
                  <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                    {exercise.exercise_type}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded ${getDifficultyColor(exercise.difficulty)}`}>
                    {exercise.difficulty}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Completed Assignments */}
      {completedAssignments.length > 0 && (
        <details className="bg-white rounded-lg shadow">
          <summary className="p-6 cursor-pointer hover:bg-gray-50">
            <span className="text-lg font-semibold text-gray-900">
              Completed Assignments ({completedAssignments.length})
            </span>
          </summary>
          <div className="p-6 pt-0 grid grid-cols-1 md:grid-cols-2 gap-4">
            {completedAssignments.map((assignment) => (
              <div
                key={assignment.id}
                className="border border-gray-200 rounded-lg p-4 bg-gray-50"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-green-600 flex items-center">
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Completed
                  </span>
                </div>
                <h3 className="font-semibold text-gray-700">
                  {assignment.assignment_type === 'song'
                    ? assignment.song?.title
                    : assignment.exercise?.title}
                </h3>
              </div>
            ))}
          </div>
        </details>
      )}
      {/* Song Recorder Modal */}
      {showRecorder && selectedSongForRecording && (
        <SongRecorder
          songId={selectedSongForRecording.id}
          songTitle={selectedSongForRecording.title}
          assignmentId={selectedSongForRecording.assignmentId}
          onClose={() => {
            setShowRecorder(false);
            setSelectedSongForRecording(null);
            loadData();
          }}
        />
      )}
    </div>
  );
}

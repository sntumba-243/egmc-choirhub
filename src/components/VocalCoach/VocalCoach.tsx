import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, TrendingUp, Music, Brain, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { smartCoachService } from '../../services/smartCoach';

interface Exercise {
  id: string;
  title: string;
  description: string;
  exercise_type: 'breathing' | 'rhythm' | 'tone' | 'range';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  target_weak_area?: string;
  created_at: string;
}

interface Assignment {
  id: string;
  song_id: string;
  song_title: string;
  notes?: string;
  assigned_at: string;
}

const VocalCoach: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingExercises, setGeneratingExercises] = useState(false);

  useEffect(() => {
    if (user) {
      loadVocalCoachData();
    }
  }, [user]);

  const loadVocalCoachData = async () => {
    try {
      setLoading(true);

      // Load AI-generated exercises
      const { data: exercisesData, error: exercisesError } = await supabase
        .from('smart_coach_exercises')
        .select('*')
        .eq('member_id', user?.id)
        .order('created_at', { ascending: false });

      if (exercisesError) throw exercisesError;
      setExercises(exercisesData || []);

      // Load assigned songs from admin
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('member_repertoire')
        .select(`
          id,
          notes,
          assigned_at,
          songs (
            id,
            title
          )
        `)
        .eq('member_id', user?.id)
        .order('assigned_at', { ascending: false });

      if (assignmentsError) {
        console.log('No member_repertoire table found - skipping song assignments');
        setAssignments([]);
      } else {

      const formattedAssignments = assignmentsData?.map((a: any) => ({
        id: a.id,
        song_id: a.songs.id,
        song_title: a.songs.title,
        notes: a.notes,
        assigned_at: a.assigned_at,
      })) || [];

      setAssignments(formattedAssignments);
      }

      // If no exercises exist, generate some
      if (!exercisesData || exercisesData.length === 0) {
        await generateInitialExercises();
      }
    } catch (error) {
      console.error('Error loading vocal coach data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateInitialExercises = async () => {
    try {
      setGeneratingExercises(true);
      await smartCoachService.generateSmartCoachExercises(user!.id);
      
      // Reload exercises
      const { data } = await supabase
        .from('smart_coach_exercises')
        .select('*')
        .eq('member_id', user?.id)
        .order('created_at', { ascending: false });

      setExercises(data || []);
    } catch (error) {
      console.error('Error generating exercises:', error);
    } finally {
      setGeneratingExercises(false);
    }
  };

  const getExerciseIcon = (type: string) => {
    switch (type) {
      case 'breathing':
        return '🫁';
      case 'rhythm':
        return '🎵';
      case 'tone':
        return '🎤';
      case 'range':
        return '🎹';
      default:
        return '✨';
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner':
        return 'bg-green-100 text-green-800';
      case 'intermediate':
        return 'bg-yellow-100 text-yellow-800';
      case 'advanced':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your vocal coach...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Mic className="w-7 h-7" />
              Vocal Coach
            </h1>
            <p className="text-purple-100 text-sm mt-1">
              Personalized training powered by AI
            </p>
          </div>
          <button
            onClick={() => navigate('/member/vocal-coach/progress')}
            className="bg-white/20 hover:bg-white/30 rounded-full p-3 transition-colors"
          >
            <TrendingUp className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="bg-white mx-4 -mt-4 rounded-lg shadow-md p-4 mb-6">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-purple-600">{exercises.length}</div>
            <div className="text-xs text-gray-600">Exercises</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-600">{assignments.length}</div>
            <div className="text-xs text-gray-600">Assignments</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">0</div>
            <div className="text-xs text-gray-600">This Week</div>
          </div>
        </div>
      </div>

      <div className="px-4 space-y-6">
        {/* AI-Generated Exercises */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-600" />
              AI Personalized Exercises
            </h2>
            <button
              onClick={generateInitialExercises}
              disabled={generatingExercises}
              className="text-sm text-purple-600 hover:text-purple-700 font-medium disabled:opacity-50"
            >
              {generatingExercises ? 'Generating...' : 'Refresh'}
            </button>
          </div>

          {exercises.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
              <Brain className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 mb-4">
                No exercises yet. Practice some songs to get personalized recommendations!
              </p>
              <button
                onClick={generateInitialExercises}
                disabled={generatingExercises}
                className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                {generatingExercises ? 'Generating...' : 'Generate Exercises'}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {exercises.map((exercise) => (
                <button
                  key={exercise.id}
                  onClick={() => navigate(`/member/vocal-coach/practice/${exercise.id}`)}
                  className="w-full bg-white rounded-lg border border-gray-200 p-4 hover:border-purple-300 hover:shadow-md transition-all text-left"
                >
                  <div className="flex items-start gap-3">
                    <div className="text-3xl">{getExerciseIcon(exercise.exercise_type)}</div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900">{exercise.title}</h3>
                        <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{exercise.description}</p>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${getDifficultyColor(exercise.difficulty)}`}>
                          {exercise.difficulty}
                        </span>
                        {exercise.target_weak_area && (
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                            Targets: {exercise.target_weak_area}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Assigned Songs */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Music className="w-5 h-5 text-blue-600" />
            Your Assigned Songs
          </h2>

          {assignments.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
              <Music className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">
                No songs assigned yet. Check back later!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {assignments.map((assignment) => (
                <button
                  key={assignment.id}
                  onClick={() => navigate(`/member/vocal-coach/practice/song/${assignment.song_id}`)}
                  className="w-full bg-white rounded-lg border border-gray-200 p-4 hover:border-blue-300 hover:shadow-md transition-all text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-1">
                        {assignment.song_title}
                      </h3>
                      {assignment.notes && (
                        <p className="text-sm text-gray-600 mb-2">{assignment.notes}</p>
                      )}
                      <p className="text-xs text-gray-500">
                        Assigned {new Date(assignment.assigned_at).toLocaleDateString()}
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default VocalCoach;

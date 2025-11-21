import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, TrendingUp, Lightbulb, X, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Scores {
  pitch_accuracy: number;
  timing_accuracy: number;
  tone_quality: number;
  breathing_control: number;
}

interface AttemptData {
  id: string;
  created_at: string;
  exercise_id?: string;
  song_id?: string;
  duration_seconds: number;
  ai_feedback?: string;
  scores: Scores;
  exercise?: {
    title: string;
  };
  song?: {
    title: string;
  };
}

interface FeedbackDisplayProps {
  attemptId: string;
  onClose: () => void;
}

const FeedbackDisplay: React.FC<FeedbackDisplayProps> = ({ attemptId, onClose }) => {
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState<AttemptData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAttemptData();
  }, [attemptId]);

  const loadAttemptData = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('exercise_attempts')
        .select(`
          *,
          smart_coach_exercises!exercise_id (title),
          songs!song_id (title)
        `)
        .eq('id', attemptId)
        .single();

      if (error) throw error;

      const attemptData: AttemptData = {
        id: data.id,
        created_at: data.created_at,
        exercise_id: data.exercise_id,
        song_id: data.song_id,
        duration_seconds: data.duration_seconds,
        ai_feedback: data.ai_feedback,
        scores: {
          pitch_accuracy: data.pitch_accuracy,
          timing_accuracy: data.timing_accuracy,
          tone_quality: data.tone_quality,
          breathing_control: data.breathing_control,
        },
        exercise: data.smart_coach_exercises ? { title: data.smart_coach_exercises.title } : undefined,
        song: data.songs ? { title: data.songs.title } : undefined,
      };

      setAttempt(attemptData);
    } catch (error) {
      console.error('Error loading attempt data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getOverallScore = (scores: Scores): number => {
    const total = scores.pitch_accuracy + scores.timing_accuracy + 
                  scores.tone_quality + scores.breathing_control;
    return Math.round(total / 4);
  };

  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBackground = (score: number): string => {
    if (score >= 80) return 'bg-green-100';
    if (score >= 60) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  const getScoreGrade = (score: number): string => {
    if (score >= 90) return 'A+';
    if (score >= 85) return 'A';
    if (score >= 80) return 'B+';
    if (score >= 75) return 'B';
    if (score >= 70) return 'C+';
    if (score >= 65) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your feedback...</p>
        </div>
      </div>
    );
  }

  if (!attempt) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Failed to load feedback</p>
          <button
            onClick={onClose}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const overallScore = getOverallScore(attempt.scores);
  const scoreEntries = [
    { label: 'Pitch Accuracy', value: attempt.scores.pitch_accuracy, icon: '🎵' },
    { label: 'Timing', value: attempt.scores.timing_accuracy, icon: '⏱️' },
    { label: 'Tone Quality', value: attempt.scores.tone_quality, icon: '🎤' },
    { label: 'Breathing', value: attempt.scores.breathing_control, icon: '🫁' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-blue-600 text-white p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
        
        <div className="text-center">
          <CheckCircle className="w-16 h-16 mx-auto mb-3" />
          <h1 className="text-2xl font-bold mb-2">Practice Complete!</h1>
          <p className="text-green-100">
            {attempt.exercise?.title || attempt.song?.title}
          </p>
        </div>
      </div>

      <div className="px-4 -mt-4 space-y-6">
        {/* Overall Score Card */}
        <div className="bg-white rounded-lg shadow-lg p-6 text-center">
          <div className="mb-3">
            <div className={`inline-flex items-center justify-center w-24 h-24 rounded-full ${getScoreBackground(overallScore)} mb-3`}>
              <span className={`text-4xl font-bold ${getScoreColor(overallScore)}`}>
                {getScoreGrade(overallScore)}
              </span>
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">
            {overallScore}%
          </div>
          <div className="text-sm text-gray-600 mb-4">Overall Score</div>
          <div className="flex items-center justify-center gap-6 text-sm text-gray-600">
            <div>
              <span className="font-medium">Duration:</span> {formatDuration(attempt.duration_seconds)}
            </div>
            <div>
              <span className="font-medium">Date:</span> {new Date(attempt.created_at).toLocaleDateString()}
            </div>
          </div>
        </div>

        {/* Detailed Scores */}
        <div>
          <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Performance Breakdown
          </h2>
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            {scoreEntries.map((entry, index) => (
              <div
                key={entry.label}
                className={`p-4 ${index !== scoreEntries.length - 1 ? 'border-b border-gray-200' : ''}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{entry.icon}</span>
                    <span className="font-medium text-gray-900">{entry.label}</span>
                  </div>
                  <span className={`text-lg font-bold ${getScoreColor(entry.value)}`}>
                    {entry.value}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      entry.value >= 80 ? 'bg-green-500' :
                      entry.value >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${entry.value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Feedback */}
        {attempt.ai_feedback && (
          <div>
            <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-yellow-600" />
              AI Coach Feedback
            </h2>
            <div className="bg-gradient-to-br from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg p-5">
              <p className="text-gray-800 whitespace-pre-line leading-relaxed">
                {attempt.ai_feedback}
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={() => navigate('/member/vocal-coach/progress')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            View Progress
            <ArrowRight className="w-5 h-5" />
          </button>
          
          <button
            onClick={onClose}
            className="w-full bg-white hover:bg-gray-50 text-gray-700 py-4 rounded-lg font-semibold border border-gray-300 transition-colors"
          >
            Back to Vocal Coach
          </button>
        </div>

        {/* Encouragement */}
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
          <p className="text-sm text-purple-800">
            {overallScore >= 80 
              ? "🎉 Excellent work! Keep up the great practice!"
              : overallScore >= 60
              ? "💪 Good effort! Practice makes perfect!"
              : "🌟 Every practice session helps you improve. Keep going!"}
          </p>
        </div>
      </div>
    </div>
  );
};

export default FeedbackDisplay;

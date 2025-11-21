import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, Award, Target, Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface AttemptData {
  id: string;
  created_at: string;
  pitch_accuracy: number;
  timing_accuracy: number;
  tone_quality: number;
  breathing_control: number;
  exercise_title?: string;
  song_title?: string;
}

interface VocalProfile {
  voice_type?: string;
  weak_areas?: string[];
  strong_areas?: string[];
  practice_streak?: number;
  total_practice_time?: number;
}

const VocalProgress: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [attempts, setAttempts] = useState<AttemptData[]>([]);
  const [profile, setProfile] = useState<VocalProfile>({});
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'all'>('month');

  useEffect(() => {
    if (user) {
      loadProgressData();
    }
  }, [user, timeRange]);

  const loadProgressData = async () => {
    try {
      setLoading(true);

      // Calculate date filter based on time range
      let dateFilter = new Date();
      if (timeRange === 'week') {
        dateFilter.setDate(dateFilter.getDate() - 7);
      } else if (timeRange === 'month') {
        dateFilter.setMonth(dateFilter.getMonth() - 1);
      }

      // Load attempts
      let query = supabase
        .from('exercise_attempts')
        .select(`
          *,
          smart_coach_exercises!exercise_id (title),
          songs!song_id (title)
        `)
        .eq('member_id', user?.id)
        .order('created_at', { ascending: false });

      if (timeRange !== 'all') {
        query = query.gte('created_at', dateFilter.toISOString());
      }

      const { data: attemptsData, error: attemptsError } = await query;

      if (attemptsError) throw attemptsError;

      const formattedAttempts: AttemptData[] = attemptsData?.map((a: any) => ({
        id: a.id,
        created_at: a.created_at,
        pitch_accuracy: a.pitch_accuracy,
        timing_accuracy: a.timing_accuracy,
        tone_quality: a.tone_quality,
        breathing_control: a.breathing_control,
        exercise_title: a.smart_coach_exercises?.title,
        song_title: a.songs?.title,
      })) || [];

      setAttempts(formattedAttempts);

      // Load vocal profile
      const { data: profileData, error: profileError } = await supabase
        .from('member_vocal_profile')
        .select('*')
        .eq('member_id', user?.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        throw profileError;
      }

      setProfile(profileData || {});
    } catch (error) {
      console.error('Error loading progress data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateAverageScores = () => {
    if (attempts.length === 0) {
      return {
        pitch: 0,
        timing: 0,
        tone: 0,
        breathing: 0,
        overall: 0,
      };
    }

    const totals = attempts.reduce(
      (acc, attempt) => ({
        pitch: acc.pitch + attempt.pitch_accuracy,
        timing: acc.timing + attempt.timing_accuracy,
        tone: acc.tone + attempt.tone_quality,
        breathing: acc.breathing + attempt.breathing_control,
      }),
      { pitch: 0, timing: 0, tone: 0, breathing: 0 }
    );

    const count = attempts.length;
    const averages = {
      pitch: Math.round(totals.pitch / count),
      timing: Math.round(totals.timing / count),
      tone: Math.round(totals.tone / count),
      breathing: Math.round(totals.breathing / count),
      overall: 0,
    };

    averages.overall = Math.round(
      (averages.pitch + averages.timing + averages.tone + averages.breathing) / 4
    );

    return averages;
  };

  const calculateImprovement = () => {
    if (attempts.length < 2) return 0;

    // Compare first half vs second half average
    const midpoint = Math.floor(attempts.length / 2);
    const recentAttempts = attempts.slice(0, midpoint);
    const olderAttempts = attempts.slice(midpoint);

    const getAverage = (arr: AttemptData[]) => {
      const sum = arr.reduce(
        (acc, a) =>
          acc +
          (a.pitch_accuracy + a.timing_accuracy + a.tone_quality + a.breathing_control) / 4,
        0
      );
      return sum / arr.length;
    };

    const recentAvg = getAverage(recentAttempts);
    const olderAvg = getAverage(olderAttempts);

    return Math.round(recentAvg - olderAvg);
  };

  const getTotalPracticeTime = () => {
    if (!profile.total_practice_time) return '0 min';
    const minutes = Math.floor(profile.total_practice_time / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  };

  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const averages = calculateAverageScores();
  const improvement = calculateImprovement();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your progress...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => navigate('/member/vocal-coach')}
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <TrendingUp className="w-7 h-7" />
              Your Progress
            </h1>
            <p className="text-blue-100 text-sm mt-1">Track your vocal journey</p>
          </div>
        </div>

        {/* Time Range Selector */}
        <div className="flex gap-2">
          {(['week', 'month', 'all'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                timeRange === range
                  ? 'bg-white text-blue-600'
                  : 'bg-blue-700 text-white hover:bg-blue-600'
              }`}
            >
              {range === 'week' ? 'Week' : range === 'month' ? 'Month' : 'All Time'}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 -mt-4 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="flex items-center gap-2 mb-2">
              <Award className="w-5 h-5 text-yellow-600" />
              <span className="text-sm text-gray-600">Overall Score</span>
            </div>
            <div className={`text-3xl font-bold ${getScoreColor(averages.overall)}`}>
              {averages.overall}%
            </div>
            {improvement !== 0 && (
              <div
                className={`text-sm mt-1 ${
                  improvement > 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {improvement > 0 ? '+' : ''}
                {improvement}% {improvement > 0 ? '📈' : '📉'}
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-5 h-5 text-blue-600" />
              <span className="text-sm text-gray-600">Sessions</span>
            </div>
            <div className="text-3xl font-bold text-gray-900">{attempts.length}</div>
            <div className="text-sm text-gray-500 mt-1">
              {getTotalPracticeTime()} total
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-5 h-5 text-purple-600" />
              <span className="text-sm text-gray-600">Streak</span>
            </div>
            <div className="text-3xl font-bold text-gray-900">
              {profile.practice_streak || 0}
            </div>
            <div className="text-sm text-gray-500 mt-1">days 🔥</div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">🎤</span>
              <span className="text-sm text-gray-600">Voice Type</span>
            </div>
            <div className="text-xl font-bold text-gray-900">
              {profile.voice_type || 'Not Set'}
            </div>
          </div>
        </div>

        {/* Average Scores Breakdown */}
        <div>
          <h2 className="font-semibold text-gray-900 mb-3">Performance Metrics</h2>
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            {[
              { label: 'Pitch Accuracy', value: averages.pitch, icon: '🎵' },
              { label: 'Timing', value: averages.timing, icon: '⏱️' },
              { label: 'Tone Quality', value: averages.tone, icon: '🎤' },
              { label: 'Breathing', value: averages.breathing, icon: '🫁' },
            ].map((metric, index) => (
              <div
                key={metric.label}
                className={`p-4 ${index !== 3 ? 'border-b border-gray-200' : ''}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{metric.icon}</span>
                    <span className="font-medium text-gray-900">{metric.label}</span>
                  </div>
                  <span className={`text-lg font-bold ${getScoreColor(metric.value)}`}>
                    {metric.value}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-full rounded-full transition-all ${
                      metric.value >= 80
                        ? 'bg-green-500'
                        : metric.value >= 60
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${metric.value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Strengths & Weaknesses */}
        {(profile.strong_areas?.length || profile.weak_areas?.length) && (
          <div className="grid grid-cols-2 gap-3">
            {profile.strong_areas && profile.strong_areas.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-semibold text-green-900 mb-2 flex items-center gap-1">
                  💪 Strengths
                </h3>
                <ul className="space-y-1">
                  {profile.strong_areas.map((area, i) => (
                    <li key={i} className="text-sm text-green-800">
                      • {area}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {profile.weak_areas && profile.weak_areas.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h3 className="font-semibold text-yellow-900 mb-2 flex items-center gap-1">
                  🎯 Focus Areas
                </h3>
                <ul className="space-y-1">
                  {profile.weak_areas.map((area, i) => (
                    <li key={i} className="text-sm text-yellow-800">
                      • {area}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Recent Practice History */}
        <div>
          <h2 className="font-semibold text-gray-900 mb-3">Recent Practice Sessions</h2>
          {attempts.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
              <p className="text-gray-600">No practice sessions yet. Start practicing to see your progress!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {attempts.slice(0, 10).map((attempt) => {
                const avgScore = Math.round(
                  (attempt.pitch_accuracy +
                    attempt.timing_accuracy +
                    attempt.tone_quality +
                    attempt.breathing_control) /
                    4
                );
                return (
                  <div
                    key={attempt.id}
                    className="bg-white rounded-lg border border-gray-200 p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">
                          {attempt.exercise_title || attempt.song_title}
                        </h3>
                        <p className="text-xs text-gray-500">
                          {new Date(attempt.created_at).toLocaleDateString()} at{' '}
                          {new Date(attempt.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <div className={`text-2xl font-bold ${getScoreColor(avgScore)}`}>
                        {avgScore}%
                      </div>
                    </div>
                    <div className="flex gap-2 text-xs">
                      <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded">
                        🎵 {attempt.pitch_accuracy}%
                      </span>
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        ⏱️ {attempt.timing_accuracy}%
                      </span>
                      <span className="bg-pink-100 text-pink-800 px-2 py-1 rounded">
                        🎤 {attempt.tone_quality}%
                      </span>
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded">
                        🫁 {attempt.breathing_control}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VocalProgress;

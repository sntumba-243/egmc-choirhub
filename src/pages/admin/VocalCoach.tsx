import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Users, 
  TrendingUp, 
  Clock, 
  Target,
  Music,
  Calendar,
  Award,
  AlertCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface Stats {
  totalSessions: number;
  totalMembers: number;
  avgScore: number;
  totalPracticeTime: number;
  sessionsThisWeek: number;
  topPerformer: { name: string; score: number } | null;
}

interface RecentSession {
  id: string;
  member_name: string;
  exercise_title: string;
  created_at: string;
  pitch_accuracy: number;
  timing_accuracy: number;
  tone_quality: number;
  breathing_control: number;
}

export default function AdminVocalCoach() {
  const [stats, setStats] = useState<Stats>({
    totalSessions: 0,
    totalMembers: 0,
    avgScore: 0,
    totalPracticeTime: 0,
    sessionsThisWeek: 0,
    topPerformer: null
  });
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Get all exercise attempts with member info
      // Get all exercise attempts
      const { data: attempts, error } = await supabase
        .from('exercise_attempts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching attempts:', error);
        throw error;
      }

      // Get all members
      const { data: allMembers } = await supabase
        .from('members')
        .select('id, first_name, last_name, email');

      // Get all exercises
      const { data: allExercises } = await supabase
        .from('smart_coach_exercises')
        .select('id, title');

      // Create lookup maps (member_id from exercise_attempts is auth.uid, not members.id)
      // We'll try to match by checking if any member IDs match
      const memberMap = new Map();
      allMembers?.forEach(m => {
        memberMap.set(m.id, m);
      });

      const exerciseMap = new Map();
      allExercises?.forEach(e => {
        exerciseMap.set(e.id, e);
      });

      // Enrich attempts - for now show member_id as fallback
      const enrichedAttempts = attempts?.map(attempt => ({
        ...attempt,
        members: memberMap.get(attempt.member_id) || { 
          first_name: 'Member', 
          last_name: attempt.member_id.substring(0, 8) 
        },
        smart_coach_exercises: exerciseMap.get(attempt.exercise_id) || { title: 'Practice Session' }
      })) || [];

      if (error) throw error;

      if (!enrichedAttempts || enrichedAttempts.length === 0) {
        setLoading(false);
        return;
      }

      // Calculate statistics
      const totalSessions = enrichedAttempts.length;
      
      // Unique members who practiced
      const uniqueMembers = new Set(enrichedAttempts.map(a => a.member_id)).size;
      
      // Average score
      const totalScore = enrichedAttempts.reduce((sum, a) => {
        return sum + (a.pitch_accuracy + a.timing_accuracy + a.tone_quality + a.breathing_control) / 4;
      }, 0);
      const avgScore = Math.round(totalScore / attempts.length);

      // Total practice time (in minutes)
      const totalTime = Math.round(
        enrichedAttempts.reduce((sum, a) => sum + (a.duration_seconds || 0), 0) / 60
      );

      // Sessions this week
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const sessionsThisWeek = enrichedAttempts.filter(
        a => new Date(a.created_at) > oneWeekAgo
      ).length;

      // Top performer this week
      const weekAttempts = enrichedAttempts.filter(
        a => new Date(a.created_at) > oneWeekAgo
      );
      
      const memberScores = new Map<string, { name: string; totalScore: number; count: number }>();
      
      weekAttempts.forEach(attempt => {
        const score = (attempt.pitch_accuracy + attempt.timing_accuracy + 
                      attempt.tone_quality + attempt.breathing_control) / 4;
        const memberId = attempt.member_id;
        const memberName = attempt.members 
          ? `${attempt.members.first_name} ${attempt.members.last_name}`
          : 'Unknown';

        if (memberScores.has(memberId)) {
          const existing = memberScores.get(memberId)!;
          existing.totalScore += score;
          existing.count += 1;
        } else {
          memberScores.set(memberId, { name: memberName, totalScore: score, count: 1 });
        }
      });

      let topPerformer = null;
      let highestAvg = 0;
      
      memberScores.forEach(({ name, totalScore, count }) => {
        const avg = totalScore / count;
        if (avg > highestAvg) {
          highestAvg = avg;
          topPerformer = { name, score: Math.round(avg) };
        }
      });

      setStats({
        totalSessions,
        totalMembers: uniqueMembers,
        avgScore,
        totalPracticeTime: totalTime,
        sessionsThisWeek,
        topPerformer
      });

      // Recent sessions (last 10)
      const recent = enrichedAttempts.slice(0, 10).map(a => ({
        id: a.id,
        member_name: a.members 
          ? `${a.members.first_name} ${a.members.last_name}`
          : 'Unknown',
        exercise_title: a.smart_coach_exercises?.title || 'Practice Session',
        created_at: a.created_at,
        pitch_accuracy: a.pitch_accuracy,
        timing_accuracy: a.timing_accuracy,
        tone_quality: a.tone_quality,
        breathing_control: a.breathing_control
      }));

      setRecentSessions(recent);

    } catch (error) {
      console.error('Error loading vocal coach data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Vocal Coach Analytics</h1>
        <p className="text-gray-600 mt-1">Monitor member practice and progress</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Total Sessions */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Sessions</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.totalSessions}</p>
            </div>
            <div className="bg-purple-100 p-3 rounded-full">
              <Music className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-2">{stats.sessionsThisWeek} this week</p>
        </div>

        {/* Active Members */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Members</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.totalMembers}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-2">Practicing members</p>
        </div>

        {/* Average Score */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Average Score</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.avgScore}%</p>
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-2">Across all exercises</p>
        </div>

        {/* Total Practice Time */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Practice Time</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.totalPracticeTime}m</p>
            </div>
            <div className="bg-orange-100 p-3 rounded-full">
              <Clock className="w-6 h-6 text-orange-600" />
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-2">Total minutes</p>
        </div>
      </div>

      {/* Top Performer This Week */}
      {stats.topPerformer && (
        <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 rounded-lg shadow p-6 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="bg-yellow-200 p-3 rounded-full">
                <Award className="w-8 h-8 text-yellow-700" />
              </div>
              <div>
                <p className="text-sm text-yellow-800 font-medium">Top Performer This Week</p>
                <p className="text-2xl font-bold text-yellow-900">{stats.topPerformer.name}</p>
                <p className="text-yellow-700">Average Score: {stats.topPerformer.score}%</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Sessions */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Recent Practice Sessions</h2>
            <div className="flex space-x-4">
              <Link
                to="/admin/vocal-coach/submissions"
                className="text-purple-600 hover:text-purple-800 text-sm font-medium"
              >
                Song Submissions →
              </Link>
              <Link
                to="/admin/vocal-coach/assignments"
                className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
              >
                Assignments →
              </Link>
            </div>
          </div>
        </div>

        {recentSessions.length === 0 ? (
          <div className="p-12 text-center">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No practice sessions yet</p>
            <p className="text-sm text-gray-500 mt-1">
              Sessions will appear here once members start practicing
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Member
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Exercise
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pitch
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Timing
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tone
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Breathing
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {recentSessions.map((session) => {
                  const avgScore = Math.round(
                    (session.pitch_accuracy + session.timing_accuracy + 
                     session.tone_quality + session.breathing_control) / 4
                  );
                  
                  return (
                    <tr key={session.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {session.member_name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{session.exercise_title}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-sm font-medium ${getScoreColor(session.pitch_accuracy)}`}>
                          {session.pitch_accuracy}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-sm font-medium ${getScoreColor(session.timing_accuracy)}`}>
                          {session.timing_accuracy}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-sm font-medium ${getScoreColor(session.tone_quality)}`}>
                          {session.tone_quality}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-sm font-medium ${getScoreColor(session.breathing_control)}`}>
                          {session.breathing_control}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(session.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

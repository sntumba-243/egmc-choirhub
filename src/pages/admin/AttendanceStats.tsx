import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface MemberAttendance {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  voice_part: string;
  role: string;
  attended: number;
  total_events: number;
  attendance_rate: number;
}

type TimePeriod = 'week' | 'month' | 'year' | 'all';

export default function AttendanceStats() {
  const [memberStats, setMemberStats] = useState<MemberAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('month');
  const [sortBy, setSortBy] = useState<'name' | 'rate'>('rate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    loadStats();
  }, [timePeriod]);

  const getDateRange = () => {
    const now = new Date();
    let startDate: Date;

    switch (timePeriod) {
      case 'week':
        // Start of this week (Sunday)
        startDate = new Date(now);
        startDate.setDate(now.getDate() - now.getDay());
        break;
      case 'month':
        // Start of this month (1st day of current month)
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        // Start of this year (January 1st)
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      case 'all':
        startDate = new Date('2000-01-01');
        break;
    }

    return startDate.toISOString().split('T')[0];
  };

  const loadStats = async () => {
    try {
      setLoading(true);

      // Get all active members (exclude inactive)
      const { data: members } = await supabase
        .from('members')
        .select('id, first_name, last_name, email, voice_part, role')
        .neq('role', 'inactive')
        .order('first_name', { ascending: true });

      const startDate = getDateRange();

      // Get events in the selected time period
      const { data: events } = await supabase
        .from('events')
        .select('id')
        .gte('date', startDate)
        .lte('date', new Date().toISOString().split('T')[0]);

      const eventIds = events?.map(e => e.id) || [];
      const totalEvents = eventIds.length;

      if (totalEvents === 0) {
        // No events in this period
        const emptyStats: MemberAttendance[] = (members || []).map(member => ({
          ...member,
          attended: 0,
          total_events: 0,
          attendance_rate: 0
        }));
        setMemberStats(emptyStats);
        setLoading(false);
        return;
      }

      // Get all RSVPs for events in this period
      const { data: rsvps } = await supabase
        .from('event_rsvps')
        .select('member_id, event_id, status')
        .in('event_id', eventIds);

      // Calculate attendance for each member
      const memberAttendance: MemberAttendance[] = (members || []).map(member => {
        const memberRsvps = rsvps?.filter(r => r.member_id === member.id) || [];
        const attended = memberRsvps.filter(r => r.status === 'attending').length;
        const rate = totalEvents > 0 ? Math.round((attended / totalEvents) * 100) : 0;

        return {
          ...member,
          attended,
          total_events: totalEvents,
          attendance_rate: rate
        };
      });

      setMemberStats(memberAttendance);
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const sortedMembers = [...memberStats].sort((a, b) => {
    if (sortBy === 'name') {
      const nameA = `${a.first_name} ${a.last_name}`.toLowerCase();
      const nameB = `${b.first_name} ${b.last_name}`.toLowerCase();
      return sortDir === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
    }
    // Sort by rate
    return sortDir === 'asc' ? a.attendance_rate - b.attendance_rate : b.attendance_rate - a.attendance_rate;
  });

  const toggleSort = (field: 'name' | 'rate') => {
    if (sortBy === field) {
      // Toggle direction if clicking same field
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      // Switch to new field with default direction
      setSortBy(field);
      setSortDir(field === 'name' ? 'asc' : 'desc');
    }
  };

  const getStatusEmoji = (rate: number) => {
    if (rate >= 75) return '🟢';
    if (rate >= 50) return '🟡';
    return '🔴';
  };

  const getStatusText = (rate: number) => {
    if (rate >= 75) return 'Excellent';
    if (rate >= 50) return 'Follow-up';
    return 'Rarely Attends';
  };

  const getStatusColor = (rate: number) => {
    if (rate >= 75) return 'text-green-600 bg-green-50';
    if (rate >= 50) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const averageAttendance = memberStats.length > 0
    ? Math.round(memberStats.reduce((sum, m) => sum + m.attendance_rate, 0) / memberStats.length)
    : 0;

  const excellentCount = memberStats.filter(m => m.attendance_rate >= 75).length;
  const needsFollowup = memberStats.filter(m => m.attendance_rate < 50 && m.attendance_rate > 0).length;

  const timePeriodLabels: Record<TimePeriod, string> = {
    week: 'This Week',
    month: 'This Month',
    year: 'This Year',
    all: 'All Time'
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-16 bg-gray-200 rounded"></div>)}
          </div>
        </div>
      </div>
    );
  }

  const totalEvents = memberStats[0]?.total_events || 0;

  return (
    <div className="space-y-4 pb-8">
      {/* Compact Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>
          <p className="text-sm text-gray-600">Based on RSVPs • {totalEvents} events in period</p>
        </div>
        
        {/* Time Period Filter */}
        <div className="flex gap-1 bg-white rounded-lg shadow-sm p-1">
          {(['week', 'month', 'year', 'all'] as TimePeriod[]).map(period => (
            <button
              key={period}
              onClick={() => setTimePeriod(period)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                timePeriod === period
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {timePeriodLabels[period]}
            </button>
          ))}
        </div>
      </div>

      {/* Compact Stats Cards */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-white rounded-lg shadow-sm p-3 border-l-2 border-purple-500">
          <div className="text-xs text-gray-600">Members</div>
          <div className="text-2xl font-bold text-gray-900">{memberStats.length}</div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-3 border-l-2 border-blue-500">
          <div className="text-xs text-gray-600">Events</div>
          <div className="text-2xl font-bold text-gray-900">{totalEvents}</div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-3 border-l-2 border-green-500">
          <div className="text-xs text-gray-600">Avg Rate</div>
          <div className="text-2xl font-bold text-gray-900">{averageAttendance}%</div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-3 border-l-2 border-yellow-500">
          <div className="text-xs text-gray-600">🟢 Excellent</div>
          <div className="text-2xl font-bold text-gray-900">{excellentCount}</div>
        </div>
      </div>

      {/* Sort Toggle - Compact */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-gray-600">Sort:</span>
        <button
          onClick={() => toggleSort('name')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            sortBy === 'name'
              ? 'bg-indigo-600 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-100 shadow-sm'
          }`}
        >
          Name {sortBy === 'name' && (sortDir === 'asc' ? '↑' : '↓')}
        </button>
        <button
          onClick={() => toggleSort('rate')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            sortBy === 'rate'
              ? 'bg-indigo-600 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-100 shadow-sm'
          }`}
        >
          Attendance {sortBy === 'rate' && (sortDir === 'asc' ? '↑' : '↓')}
        </button>
      </div>

      {/* Compact Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Member</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Voice Part</th>
              <th className="px-4 py-2 text-center text-xs font-semibold text-gray-700">Attendance</th>
              <th className="px-4 py-2 text-center text-xs font-semibold text-gray-700">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedMembers.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500">
                  No events in this time period
                </td>
              </tr>
            ) : (
              sortedMembers.map((member) => (
                <tr key={member.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="text-sm font-semibold text-gray-900">
                      {member.first_name} {member.last_name}
                    </div>
                    <div className="text-xs text-gray-500">{member.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                      {member.voice_part || 'Not Set'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="text-base font-bold text-gray-900">
                      {member.attended}/{member.total_events}
                    </div>
                    <div className="text-xs text-gray-500">
                      ({member.attendance_rate}%)
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="text-lg">{getStatusEmoji(member.attendance_rate)}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(member.attendance_rate)}`}>
                        {getStatusText(member.attendance_rate)}
                      </span>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Compact Legend */}
      <div className="bg-gray-50 rounded-lg p-3">
        <div className="flex items-center gap-4 text-xs text-gray-700">
          <span className="font-semibold">Status:</span>
          <span className="flex items-center gap-1">🟢 Excellent (75%+)</span>
          <span className="flex items-center gap-1">🟡 Follow-up (50-74%)</span>
          <span className="flex items-center gap-1">🔴 Rarely (below 50%)</span>
        </div>
      </div>
    </div>
  );
}

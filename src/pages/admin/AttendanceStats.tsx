import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Users, Calendar, TrendingUp, Award, ChevronDown, ChevronUp } from 'lucide-react';

interface MemberAttendance {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  voice_part: string;
  total_events: number;
  attended: number;
  attendance_rate: number;
}

interface EventAttendance {
  id: string;
  title: string;
  date: string;
  attending: number;
  not_attending: number;
}

export default function AttendanceStats() {
  const [memberStats, setMemberStats] = useState<MemberAttendance[]>([]);
  const [eventStats, setEventStats] = useState<EventAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'name' | 'rate'>('rate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);

      const { data: members } = await supabase
        .from('members')
        .select('id, first_name, last_name, email, voice_part')
        .eq('role', 'member');

      const today = new Date().toISOString().split('T')[0];
      const { data: events } = await supabase
        .from('events')
        .select('id, title, date')
        .eq('requires_rsvp', true)
        .lte('date', today)
        .order('date', { ascending: false });

      const { data: rsvps } = await supabase
        .from('rsvps')
        .select('member_id, event_id, status');

      const totalPastEvents = events?.length || 0;

      const memberAttendance: MemberAttendance[] = (members || []).map(member => {
        const memberRsvps = rsvps?.filter(r => r.member_id === member.id) || [];
        const attended = memberRsvps.filter(r => r.status === 'attending').length;
        const rate = totalPastEvents > 0 ? Math.round((attended / totalPastEvents) * 100) : 0;

        return {
          ...member,
          total_events: totalPastEvents,
          attended,
          attendance_rate: rate
        };
      });

      setMemberStats(memberAttendance);

      const eventAttendance: EventAttendance[] = (events || []).map(event => {
        const eventRsvps = rsvps?.filter(r => r.event_id === event.id) || [];
        return {
          ...event,
          attending: eventRsvps.filter(r => r.status === 'attending').length,
          not_attending: eventRsvps.filter(r => r.status === 'not_attending').length
        };
      });

      setEventStats(eventAttendance);
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
    return sortDir === 'asc' ? a.attendance_rate - b.attendance_rate : b.attendance_rate - a.attendance_rate;
  });

  const toggleSort = (field: 'name' | 'rate') => {
    if (sortBy === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
  };

  const getAttendanceColor = (rate: number) => {
    if (rate >= 80) return 'text-green-600 bg-green-100';
    if (rate >= 50) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const averageAttendance = memberStats.length > 0
    ? Math.round(memberStats.reduce((sum, m) => sum + m.attendance_rate, 0) / memberStats.length)
    : 0;

  const topAttenders = [...memberStats].sort((a, b) => b.attendance_rate - a.attendance_rate).slice(0, 5);

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-gray-200 rounded"></div>)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Attendance Statistics</h1>
        <p className="text-gray-600 mt-1">Track member attendance based on RSVP data</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Members</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{memberStats.length}</p>
            </div>
            <Users className="w-8 h-8 text-purple-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Past Events</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{eventStats.length}</p>
            </div>
            <Calendar className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Avg Attendance</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{averageAttendance}%</p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Perfect Attendance</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {memberStats.filter(m => m.attendance_rate === 100).length}
              </p>
            </div>
            <Award className="w-8 h-8 text-yellow-600" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
          <Award className="w-6 h-6 text-yellow-500 mr-2" />
          Top Attenders
        </h2>
        <div className="flex flex-wrap gap-3">
          {topAttenders.map((member, index) => (
            <div key={member.id} className="flex items-center bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg px-4 py-2 border border-purple-200">
              <span className="text-lg font-bold text-purple-600 mr-2">#{index + 1}</span>
              <span className="font-medium text-gray-900">{member.first_name} {member.last_name}</span>
              <span className={`ml-2 px-2 py-1 rounded-full text-xs font-bold ${getAttendanceColor(member.attendance_rate)}`}>
                {member.attendance_rate}%
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">All Members</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onClick={() => toggleSort('name')}>
                  <div className="flex items-center">
                    Member {sortBy === 'name' && (sortDir === 'asc' ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />)}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Voice Part</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Events Attended</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onClick={() => toggleSort('rate')}>
                  <div className="flex items-center">
                    Attendance Rate {sortBy === 'rate' && (sortDir === 'asc' ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />)}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sortedMembers.map((member) => (
                <tr key={member.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-900">{member.first_name} {member.last_name}</p>
                    <p className="text-sm text-gray-500">{member.email}</p>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{member.voice_part || '-'}</td>
                  <td className="px-6 py-4 text-gray-600">{member.attended} / {member.total_events}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="w-24 bg-gray-200 rounded-full h-2 mr-3">
                        <div className={`h-2 rounded-full ${member.attendance_rate >= 80 ? 'bg-green-500' : member.attendance_rate >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${member.attendance_rate}%` }}></div>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${getAttendanceColor(member.attendance_rate)}`}>{member.attendance_rate}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

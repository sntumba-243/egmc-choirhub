import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Users, 
  Plus, 
  CheckCircle, 
  Clock,
  Music,
  Dumbbell,
  X,
  Calendar,
  Trash2
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Member {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
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
}

export default function VocalCoachAssignments() {
  const [members, setMembers] = useState<Member[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignmentType, setAssignmentType] = useState<'exercise' | 'song'>('exercise');
  const [selectedMember, setSelectedMember] = useState('');
  const [selectedExercise, setSelectedExercise] = useState('');
  const [selectedSong, setSelectedSong] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load members
      const { data: membersData } = await supabase
        .from('members')
        .select('id, first_name, last_name, email')
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

      // Enrich assignments with member/exercise/song data
      const enriched = await Promise.all((assignmentsData || []).map(async (a) => {
        const member = membersData?.find(m => m.id === a.member_id);
        const exercise = exercisesData?.find(e => e.id === a.exercise_id);
        const song = songsData?.find(s => s.id === a.song_id);
        
        return {
          ...a,
          member,
          exercise,
          song
        };
      }));

      setAssignments(enriched);

    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignExercise = async () => {
    if (!selectedMember) {
      toast.error('Please select a member');
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
      
      const { error } = await supabase
        .from('exercise_assignments')
        .insert({
          member_id: selectedMember,
          assigned_by: userData?.user?.id,
          assignment_type: assignmentType,
          exercise_id: assignmentType === 'exercise' ? selectedExercise : null,
          song_id: assignmentType === 'song' ? selectedSong : null,
          due_date: dueDate || null,
          notes: notes || null
        });

      if (error) throw error;

      toast.success(`${assignmentType === 'song' ? 'Song' : 'Exercise'} assigned successfully!`);
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
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Exercise & Song Assignments</h1>
          <p className="text-gray-600 mt-1">Assign practice exercises and songs to choir members</p>
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
              <p className="text-3xl font-bold text-gray-900 mt-1">{assignments.length}</p>
            </div>
            <Music className="w-8 h-8 text-purple-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Completed</p>
              <p className="text-3xl font-bold text-green-600 mt-1">
                {assignments.filter(a => a.completed).length}
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-3xl font-bold text-orange-600 mt-1">
                {assignments.filter(a => !a.completed).length}
              </p>
            </div>
            <Clock className="w-8 h-8 text-orange-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Members</p>
              <p className="text-3xl font-bold text-blue-600 mt-1">
                {new Set(assignments.map(a => a.member_id)).size}
              </p>
            </div>
            <Users className="w-8 h-8 text-blue-600" />
          </div>
        </div>
      </div>

      {/* Assignments List */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">All Assignments</h2>
        </div>

        {assignments.length === 0 ? (
          <div className="p-12 text-center">
            <Music className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No assignments yet</p>
            <p className="text-sm text-gray-500 mt-1">
              Click "New Assignment" to get started
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Member
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Assignment
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Due Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {assignments.map((assignment) => (
                  <tr key={assignment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {assignment.member?.first_name} {assignment.member?.last_name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {assignment.assignment_type === 'song' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          <Music className="w-3 h-3 mr-1" />
                          Song
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          <Dumbbell className="w-3 h-3 mr-1" />
                          Exercise
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {assignment.assignment_type === 'song'
                          ? assignment.song?.title || 'Unknown Song'
                          : assignment.exercise?.title || 'Unknown Exercise'}
                      </div>
                      {assignment.notes && (
                        <div className="text-xs text-gray-500 mt-1">{assignment.notes}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {assignment.due_date
                        ? new Date(assignment.due_date).toLocaleDateString()
                        : 'No due date'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {assignment.completed ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Completed
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          <Clock className="w-3 h-3 mr-1" />
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => handleDeleteAssignment(assignment.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                onClick={() => {
                  setShowAssignModal(false);
                  resetForm();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Assignment Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Assignment Type
                </label>
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

              {/* Member Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Member *
                </label>
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
              </div>

              {/* Exercise/Song Selection */}
              {assignmentType === 'exercise' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Exercise *
                  </label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Song *
                  </label>
                  <select
                    value={selectedSong}
                    onChange={(e) => setSelectedSong(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 max-h-48 overflow-y-auto"
                  >
                    <option value="">Choose a song...</option>
                    {songs.map(song => (
                      <option key={song.id} value={song.id}>
                        {song.title} {song.composer && `- ${song.composer}`}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {songs.length} songs available from repertoire
                  </p>
                </div>
              )}

              {/* Due Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Due Date (Optional)
                </label>
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (Optional)
                </label>
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
                onClick={() => {
                  setShowAssignModal(false);
                  resetForm();
                }}
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

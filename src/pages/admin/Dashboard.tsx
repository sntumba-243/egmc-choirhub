import React, { useState, useEffect } from 'react';
import { Users, Music, Calendar, Mail, Download, Upload, Trash2, Settings } from 'lucide-react';
import { dataExportService } from '../../lib/dataExport';
import { membersService, songsService, eventsService, messagesService } from '../../lib/database';

interface AdminDashboardProps {
  onNavigate: (page: string) => void;
  onNavigateToMemberForm: () => void;
  onNavigateToSongForm: () => void;
  onNavigateToEventForm: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onNavigate,
  onNavigateToMemberForm,
  onNavigateToSongForm,
  onNavigateToEventForm,
}) => {
  const [importing, setImporting] = useState(false);
  const [stats, setStats] = useState({
    members: 0,
    songs: 0,
    upcomingEvents: 0,
    messages: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [members, songs, events, messages] = await Promise.all([
        membersService.getMembers(),
        songsService.getSongs(),
        eventsService.getEvents(),
        messagesService.getMessages(),
      ]);

      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const upcomingEvents = events.filter(event => new Date(event.date) >= now);

      setStats({
        members: members.length,
        songs: songs.length,
        upcomingEvents: upcomingEvents.length,
        messages: messages.length,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statsDisplay = [
    { label: 'Total Members', value: stats.members, icon: Users, color: 'bg-blue-50 text-blue-700', page: 'members' },
    { label: 'Songs in Repertoire', value: stats.songs, icon: Music, color: 'bg-green-50 text-green-700', page: 'repertoire' },
    { label: 'Upcoming Events', value: stats.upcomingEvents, icon: Calendar, color: 'bg-orange-50 text-orange-700', page: 'events' },
    { label: 'Messages Sent', value: stats.messages, icon: Mail, color: 'bg-red-50 text-red-700', page: 'messages' },
  ];

  const handleExport = () => {
    dataExportService.exportAllData();
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      await dataExportService.importData(file);
      alert('Data imported successfully! Refresh the page to see changes.');
    } catch (error) {
      alert('Failed to import data. Please check the file format.');
    } finally {
      setImporting(false);
      event.target.value = '';
    }
  };

  const handleClearData = () => {
    dataExportService.clearAllData();
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-md p-6">
        <h2 className="text-2xl font-bold text-blue-900 mb-6">Dashboard Overview</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {loading ? (
            <div className="col-span-4 text-center py-8 text-gray-600">Loading statistics...</div>
          ) : (
            statsDisplay.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <button
                  key={index}
                  onClick={() => onNavigate(stat.page)}
                  className="bg-white border-2 border-gray-200 rounded-xl p-5 hover:shadow-lg hover:border-gray-300 transition-all cursor-pointer text-left"
                >
                  <div className={`w-12 h-12 ${stat.color} rounded-lg flex items-center justify-center mb-3`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <p className="text-3xl font-bold text-blue-900 mb-1">{stat.value}</p>
                  <p className="text-sm text-gray-600">{stat.label}</p>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center gap-2 mb-6">
          <Settings className="w-6 h-6 text-blue-900" />
          <h3 className="text-xl font-bold text-blue-900">Data Management</h3>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-3">
              <Download className="w-6 h-6 text-blue-700 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold text-blue-900 mb-1">Export All Data</h4>
                <p className="text-sm text-blue-700 mb-3">
                  Download all choir data as a JSON file for backup purposes.
                </p>
                <button
                  onClick={handleExport}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-900 text-white rounded-lg font-semibold hover:bg-blue-800 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Export Data
                </button>
              </div>
            </div>
          </div>

          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start gap-3">
              <Upload className="w-6 h-6 text-green-700 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold text-green-900 mb-1">Import Data</h4>
                <p className="text-sm text-green-700 mb-3">
                  Restore choir data from a previously exported JSON file.
                </p>
                <label className="inline-flex items-center gap-2 px-4 py-2 bg-green-900 text-white rounded-lg font-semibold hover:bg-green-800 transition-colors cursor-pointer">
                  <Upload className="w-4 h-4" />
                  {importing ? 'Importing...' : 'Import Data'}
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImport}
                    disabled={importing}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-3">
              <Trash2 className="w-6 h-6 text-red-700 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold text-red-900 mb-1">Clear All Local Data</h4>
                <p className="text-sm text-red-700 mb-3">
                  Remove all locally stored data. This action cannot be undone.
                </p>
                <button
                  onClick={handleClearData}
                  className="flex items-center gap-2 px-4 py-2 bg-red-900 text-white rounded-lg font-semibold hover:bg-red-800 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear Data
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md p-6">
        <h3 className="text-xl font-bold text-blue-900 mb-4">Quick Actions</h3>
        <div className="flex md:grid md:grid-cols-3 gap-4 overflow-x-auto scrollbar-hide scroll-smooth -webkit-overflow-scrolling-touch pb-2">
          <button
            onClick={onNavigateToMemberForm}
            className="p-4 border-2 border-blue-200 rounded-lg hover:bg-blue-50 transition-colors text-left flex-shrink-0 min-w-[200px] md:min-w-0"
            title="Add New Member"
          >
            <Users className="w-6 h-6 text-blue-700 mb-2" />
            <p className="font-semibold text-blue-900">Add New Member</p>
            <p className="text-sm text-gray-600 mt-1 hidden sm:block">Register a new choir member</p>
          </button>
          <button
            onClick={onNavigateToSongForm}
            className="p-4 border-2 border-green-200 rounded-lg hover:bg-green-50 transition-colors text-left flex-shrink-0 min-w-[200px] md:min-w-0"
            title="Add New Song"
          >
            <Music className="w-6 h-6 text-green-700 mb-2" />
            <p className="font-semibold text-green-900">Add New Song</p>
            <p className="text-sm text-gray-600 mt-1 hidden sm:block">Add to repertoire</p>
          </button>
          <button
            onClick={onNavigateToEventForm}
            className="p-4 border-2 border-orange-200 rounded-lg hover:bg-orange-50 transition-colors text-left flex-shrink-0 min-w-[200px] md:min-w-0"
            title="Schedule Event"
          >
            <Calendar className="w-6 h-6 text-orange-700 mb-2" />
            <p className="font-semibold text-orange-900">Schedule Event</p>
            <p className="text-sm text-gray-600 mt-1 hidden sm:block">Create a new event</p>
          </button>
        </div>
      </div>
    </div>
  );
};

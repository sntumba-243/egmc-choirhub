import PWAInstallPrompt from './components/PWAInstallPrompt'
import IOSInstallPrompt from './components/IOSInstallPrompt'
import PWAUpdateNotification from './components/PWAUpdateNotification'
import EnhancedOfflineIndicator from './components/EnhancedOfflineIndicator'
import '@/lib/supabase'  // This loads Supabase globally
import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ProtectedRoute } from './components/ProtectedRoute';
import { MemberLayout } from './layouts/MemberLayout';
import { AdminLayout } from './layouts/AdminLayout';
import { MemberRepertoire } from './pages/member/Repertoire';
import { SongDetail } from './pages/member/SongDetail';
import { MemberCalendar } from './pages/member/Calendar';
import { EventDetail } from './pages/member/EventDetail';
import { MemberMessages } from './pages/member/Messages';
import { MessageDetail } from './pages/member/MessageDetail';
import { MemberPractice } from './pages/member/Practice';
import { MemberProfile } from './pages/member/Profile';
import { AdminDashboard } from './pages/admin/Dashboard';
import { AdminRepertoire } from './pages/admin/Repertoire';
import { SongForm } from './pages/admin/SongForm';
import { AdminMembers } from './pages/admin/Members';
import { MemberForm } from './pages/admin/MemberForm';
import { AdminEvents } from './pages/admin/Events';
import { EventForm } from './pages/admin/EventForm';
import { AdminMessages } from './pages/admin/Messages';
import { MessageForm } from './pages/admin/MessageForm';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [authView, setAuthView] = useState<'login' | 'register'>('login');
  const [memberTab, setMemberTab] = useState<'repertoire' | 'calendar' | 'messages' | 'practice' | 'profile'>('repertoire');
  const [adminPage, setAdminPage] = useState<'dashboard' | 'repertoire' | 'members' | 'events' | 'messages'>('dashboard');
  const [currentSongId, setCurrentSongId] = useState<string | null>(null);
  const [currentEventId, setCurrentEventId] = useState<string | null>(null);
  const [currentMessageId, setCurrentMessageId] = useState<string | null>(null);
  const [editingSongId, setEditingSongId] = useState<string | null | undefined>(undefined);
  const [editingMemberId, setEditingMemberId] = useState<string | null | undefined>(undefined);
  const [editingEventId, setEditingEventId] = useState<string | null | undefined>(undefined);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [viewingMessageId, setViewingMessageId] = useState<string | null>(null);
  const [membersRefreshKey, setMembersRefreshKey] = useState(0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-blue-50">
        <div className="text-blue-900 text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    if (authView === 'login') {
      return <Login onNavigateToRegister={() => setAuthView('register')} />;
    }
    return <Register onNavigateToLogin={() => setAuthView('login')} />;
  }

  if (user.role === 'member') {
    if (currentSongId) {
      return (
        <ProtectedRoute requiredRole="member">
          <SongDetail
            songId={currentSongId}
            onBack={() => {
              setCurrentSongId(null);
              setMemberTab('repertoire');
            }}
          />
        </ProtectedRoute>
      );
    }

    if (currentEventId) {
      return (
        <ProtectedRoute requiredRole="member">
          <EventDetail
            eventId={currentEventId}
            onBack={() => {
              setCurrentEventId(null);
              setMemberTab('calendar');
            }}
            onNavigateToSong={(songId) => {
              setCurrentSongId(songId);
              setCurrentEventId(null);
            }}
          />
        </ProtectedRoute>
      );
    }

    if (currentMessageId) {
      return (
        <ProtectedRoute requiredRole="member">
          <MessageDetail
            messageId={currentMessageId}
            onBack={() => {
              setCurrentMessageId(null);
              setMemberTab('messages');
            }}
          />
        </ProtectedRoute>
      );
    }

    return (
      <ProtectedRoute requiredRole="member">
        <MemberLayout activeTab={memberTab} onNavigate={setMemberTab}>
          {memberTab === 'repertoire' && <MemberRepertoire onNavigateToSong={setCurrentSongId} />}
          {memberTab === 'calendar' && <MemberCalendar onNavigateToEvent={setCurrentEventId} />}
          {memberTab === 'messages' && <MemberMessages onNavigateToMessage={setCurrentMessageId} />}
          {memberTab === 'practice' && <MemberPractice />}
          {memberTab === 'profile' && <MemberProfile />}
        </MemberLayout>
      </ProtectedRoute>
    );
  }

  if (user.role === 'admin') {
    if (editingSongId !== undefined) {
      return (
        <ProtectedRoute requiredRole="admin">
          <SongForm
            songId={editingSongId || undefined}
            onBack={() => {
              setEditingSongId(undefined);
              setAdminPage('repertoire');
            }}
          />
        </ProtectedRoute>
      );
    }

    if (editingMemberId !== undefined) {
      return (
        <ProtectedRoute requiredRole="admin">
          <MemberForm
            memberId={editingMemberId || undefined}
            onBack={() => {
              setEditingMemberId(undefined);
              setAdminPage('members');
            }}
            onSave={() => setMembersRefreshKey(prev => prev + 1)}
          />
        </ProtectedRoute>
      );
    }

    if (editingEventId !== undefined) {
      return (
        <ProtectedRoute requiredRole="admin">
          <EventForm
            eventId={editingEventId || undefined}
            onBack={() => {
              setEditingEventId(undefined);
              setAdminPage('events');
            }}
          />
        </ProtectedRoute>
      );
    }

    if (sendingMessage) {
      return (
        <ProtectedRoute requiredRole="admin">
          <MessageForm
            onBack={() => {
              setSendingMessage(false);
              setAdminPage('messages');
            }}
          />
        </ProtectedRoute>
      );
    }

    return (
      <ProtectedRoute requiredRole="admin">
        <AdminLayout activePage={adminPage} onNavigate={setAdminPage}>
          {adminPage === 'dashboard' && (
            <AdminDashboard
              onNavigate={setAdminPage}
              onNavigateToMemberForm={() => setEditingMemberId(null)}
              onNavigateToSongForm={() => setEditingSongId(null)}
              onNavigateToEventForm={() => setEditingEventId(null)}
            />
          )}
          {adminPage === 'repertoire' && <AdminRepertoire onNavigateToForm={setEditingSongId} />}
          {adminPage === 'members' && <AdminMembers key={membersRefreshKey} onNavigateToForm={(id) => setEditingMemberId(id === undefined ? null : id)} />}
          {adminPage === 'events' && <AdminEvents onNavigateToForm={setEditingEventId} />}
          {adminPage === 'messages' && <AdminMessages onNavigateToForm={() => setSendingMessage(true)} onNavigateToDetail={setViewingMessageId} />}
        </AdminLayout>
      </ProtectedRoute>
    );
  }

  return null;
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;

function App() {
  return (
    <AuthProvider>
      {/* ADD THESE 4 LINES HERE - Right at the top! */}
      <EnhancedOfflineIndicator />
      <PWAInstallPrompt />
      <IOSInstallPrompt />
      <PWAUpdateNotification />
      
      <Router>
        {/* Your existing routes and components stay the same */}
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        {/* etc... */}
      </Router>
    </AuthProvider>
  )
}

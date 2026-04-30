import { OfflineBanner } from "./components/OfflineBanner";
import { useEffect } from 'react';
import { lazy, Suspense } from 'react';
import { Sentry } from './lib/sentry';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ChurchProvider } from './contexts/ChurchContext';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';

// PWA Components
import PWAInstallPrompt from './components/PWAInstallPrompt';
import IOSInstallPrompt from './components/IOSInstallPrompt';
import PWAUpdateNotification from './components/PWAUpdateNotification';
import EnhancedOfflineIndicator from './components/EnhancedOfflineIndicator';
import { NativeUpdateBanner } from './components/NativeUpdateBanner';

// Firebase Notifications
import { requestNotificationPermission, setupMessageListener, storeDeviceToken } from './lib/firebase';

// Auth Pages

// PDF Viewer
import { PDFViewerPage } from './components/PDFViewer';
import { Login } from './pages/Login';

// Layouts
import MemberLayout from './layouts/MemberLayout';
import AdminLayout from './layouts/AdminLayout';

// Member Pages
import { MemberDashboard } from './pages/member/Dashboard';
import { MemberRepertoire } from './pages/member/Repertoire';
import { MemberCalendar } from './pages/member/Calendar';
import { EventDetail as MemberEventDetail } from './pages/member/EventDetail';
import { MessageCompose } from './pages/member/MessageCompose';
import { MemberMessages } from './pages/member/Messages-MOBILE';
import { MemberPractice } from './pages/member/Practice';
import { MemberProfile } from './pages/member/Profile';
import { SongDetail } from './pages/member/SongDetail';

// Vocal Coach Components
import { 
  PracticeSession, 
  VocalProgress 
} from './components/VocalCoach';
import { VocalCoach } from './pages/member/VocalCoach';

// Admin Pages
import { AdminDashboard } from './pages/admin/Dashboard';
import { AdminRepertoire } from './pages/admin/Repertoire';
import { ChurchRepertoire } from './pages/admin/ChurchRepertoire';
import { AdminFavorites } from './pages/admin/Favorites';
import { AdminMembers } from './pages/admin/Members';
import { AdminEvents } from './pages/admin/Events';
import { AdminMessages } from './pages/admin/Messages';
import { AdminSettings } from './pages/admin/Settings';
const ChurchThemeSettings = lazy(() => import("./pages/admin/ChurchThemeSettings").then(m => ({ default: m.ChurchThemeSettings })));
import AdminVocalCoach from './pages/admin/VocalCoach';
import VocalCoachAssignments from './pages/admin/VocalCoachAssignments';
import AttendanceStats from './pages/admin/AttendanceStats';
import TakeAttendance from './pages/admin/TakeAttendance';
import { BulkSongEditor } from './pages/admin/BulkSongEditor';
import { SongForm } from './pages/admin/SongForm';
import { MemberForm } from './pages/admin/MemberForm';
import { EventForm } from './pages/admin/EventForm';
import { AdminEventDetail } from './pages/admin/EventDetail';
import { MessageForm } from './pages/admin/MessageForm';

// Protected Route Component
import { ProtectedRoute } from './components/ProtectedRoute';

// Super Admin
import SuperAdminLayout from "./layouts/SuperAdminLayout";
import { SuperAdminDashboard } from "./pages/super-admin/Dashboard";
import { Churches } from "./pages/super-admin/Churches";
import { ChurchForm } from "./pages/super-admin/ChurchForm";
import { ChurchDetail } from "./pages/super-admin/ChurchDetail";
import { GlobalEvents } from "./pages/super-admin/GlobalEvents";
import { SuperAdminEventDetail } from "./pages/super-admin/EventDetail";

// Super Admin

const Submissions = lazy(() => import('./pages/admin/Submissions'));

function App() {
  return (
    <Sentry.ErrorBoundary fallback={
      <div className='min-h-screen flex items-center justify-center'>
        <div className='text-center p-8'>
          <h2 className='text-xl font-semibold text-gray-800 mb-2'>Something went wrong</h2>
          <p className='text-gray-500 mb-4'>Our team has been notified. Please refresh the page.</p>
          <button onClick={() => window.location.reload()} className='px-4 py-2 bg-blue-600 text-white rounded-lg'>
            Refresh
          </button>
        </div>
      </div>
    }>
    <AuthProvider>
      <ChurchProvider>
      <OfflineBanner />
      <AppRoutes />
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 2500,
          style: {
            background: '#1a1a1a',
            color: '#fff',
            fontSize: '13px',
            fontWeight: '500',
            padding: '10px 16px',
            borderRadius: '12px',
            maxWidth: '320px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          },
          success: {
            iconTheme: { primary: '#22c55e', secondary: '#fff' },
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: '#fff' },
          },
        }}
      />
      <PWAInstallPrompt />
      <IOSInstallPrompt />
      <PWAUpdateNotification />
      <EnhancedOfflineIndicator />
      <NativeUpdateBanner />
    </ChurchProvider>
    </AuthProvider>
    </Sentry.ErrorBoundary>
  );
}

function AppRoutes() {
  const { user, loading } = useAuth();

  // Initialize notifications
  useEffect(() => {
    if (user?.id) {
      initializeNotifications(user.id);
    }
  }, [user?.id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={!user ? <Login /> : <Navigate to={user.is_super_admin ? '/super-admin' : user.role === 'admin' ? '/admin' : '/member'} />} />

      {/* PDF Viewer */}
      <Route path="/pdf-viewer" element={<ProtectedRoute requiredRole="member"><PDFViewerPage /></ProtectedRoute>} />

      {/* Super Admin Routes */}
      <Route path="/super-admin" element={
        <ProtectedRoute requiredRole="super_admin">
          <SuperAdminLayout />
        </ProtectedRoute>
      }>
        <Route index element={<SuperAdminDashboard />} />
        <Route path="churches" element={<Churches />} />
        <Route path="churches/new" element={<ChurchForm />} />
        <Route path="churches/:id" element={<ChurchDetail />} />
        <Route path="churches/:id/edit" element={<ChurchForm />} />
        <Route path="repertoire" element={<AdminRepertoire />} />
        <Route path="favorites" element={<AdminFavorites />} />
        <Route path="repertoire/new" element={<SongForm />} />
        <Route path="repertoire/:id/edit" element={<SongForm />} />
        <Route path="members" element={<AdminMembers />} />
        <Route path="events" element={<GlobalEvents />} />
        <Route path="events/:id" element={<SuperAdminEventDetail />} />
        <Route path="members/new" element={<MemberForm />} />
        <Route path="members/:id/edit" element={<MemberForm />} />
        <Route path="events/new" element={<EventForm />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="theme" element={<Suspense fallback={<div className="flex items-center justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>}><ChurchThemeSettings /></Suspense>} />
      </Route>


      {/* Member Routes */}
      <Route path="/member" element={
        <ProtectedRoute requiredRole="member">
          <MemberLayout />
        </ProtectedRoute>
      }>
        <Route index element={<MemberDashboard />} />
        <Route path="repertoire" element={<MemberRepertoire />} />
        <Route path="repertoire/:id" element={<SongDetail />} />
        <Route path="events/:eventId" element={<MemberEventDetail />} />
        <Route path="calendar" element={<MemberCalendar />} />
        <Route path="calendar/:eventId" element={<MemberEventDetail />} />
        <Route path="messages" element={<MemberMessages />} />
        <Route path="messages/compose" element={<MessageCompose />} />
        <Route path="practice" element={<MemberPractice />} />
        <Route path="profile" element={<MemberProfile />} />
        
        {/* Vocal Coach Routes */}
        <Route path="vocal-coach" element={<VocalCoach />} />
        <Route path="vocal-coach/practice/:id" element={<PracticeSession />} />
        <Route path="vocal-coach/progress" element={<VocalProgress />} />
      </Route>

      {/* Admin Routes */}
      <Route path="/admin" element={
        <ProtectedRoute requiredRole="admin">
          <AdminLayout />
        </ProtectedRoute>
      }>
        <Route index element={<AdminDashboard />} />
        <Route path="repertoire" element={<AdminRepertoire />} />
            <Route path="repertoire/new" element={<SongForm />} />
            <Route path="repertoire/:id/edit" element={<SongForm />} />
        <Route path="members" element={<AdminMembers />} />
        <Route path="events" element={<AdminEvents />} />
        <Route path="attendance" element={<AttendanceStats />} />
        <Route path="attendance/take" element={<TakeAttendance />} />
        <Route path="attendance/take/:eventId" element={<TakeAttendance />} />
                <Route path="submissions" element={<Submissions />} />
        <Route path="messages" element={<AdminMessages />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="theme" element={<Suspense fallback={<div className="flex items-center justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>}><ChurchThemeSettings /></Suspense>} />
        <Route path="bulk-edit" element={<BulkSongEditor />} />
        <Route path="members/new" element={<MemberForm />} />
        <Route path="members/:id/edit" element={<MemberForm />} />
        <Route path="events/new" element={<EventForm />} />
        <Route path="events/:id" element={<AdminEventDetail />} />
        <Route path="events/:id/edit" element={<EventForm />} />
        <Route path="messages/new" element={<MessageForm />} />        <Route path="vocal-coach" element={<AdminVocalCoach />} />        <Route path="vocal-coach/assignments" element={<VocalCoachAssignments />} />
      </Route>

      {/* Root redirect */}
      <Route path="/" element={
        user ? (
          <Navigate to={user.is_super_admin ? '/super-admin' : user.role === 'admin' ? '/admin' : '/member'} />
        ) : (
          <Navigate to="/login" />
        )
      } />

      {/* 404 */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

// Initialize push notifications
async function initializeNotifications(userId: string) {
  try {
    // Request notification permission
    const token = await requestNotificationPermission();
    
    if (token) {
      // Store device token in database
      await storeDeviceToken(userId, token);

      // Set up listener for foreground messages
      setupMessageListener((payload) => {
      });
    }

  } catch (error) {
    console.error('❌ Error initializing notifications:', error);
  }
}

export default App;
// test
// deploy Fri Feb 27 10:45:09 CST 2026

import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Toaster } from 'react-hot-toast';

// PWA Components
import PWAInstallPrompt from './components/PWAInstallPrompt';
import IOSInstallPrompt from './components/IOSInstallPrompt';
import PWAUpdateNotification from './components/PWAUpdateNotification';
import EnhancedOfflineIndicator from './components/EnhancedOfflineIndicator';

// Auth Pages
import { Login } from './pages/Login';
import { Register } from './pages/Register';

// Layouts
import { MemberLayout } from './layouts/MemberLayout';
import { AdminLayout } from './layouts/AdminLayout';

// Member Pages
import { MemberDashboard } from './pages/member/Dashboard-MOBILE';
import { MemberRepertoire } from './pages/member/Repertoire-MOBILE';
import { MemberCalendar } from './pages/member/Calendar';
import { EventDetail } from './pages/member/EventDetail';
import { MemberMessages } from './pages/member/Messages-MOBILE';
import { MemberPractice } from './pages/member/Practice';
import { MemberProfile } from './pages/member/Profile';

// Admin Pages
import { AdminDashboard } from './pages/admin/Dashboard';
import { AdminRepertoire } from './pages/admin/Repertoire';
import { AdminMembers } from './pages/admin/Members';
import { AdminEvents } from './pages/admin/Events';
import { AdminMessages } from './pages/admin/Messages';

// Protected Route Component
import { ProtectedRoute } from './components/ProtectedRoute';

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
      <Toaster position="top-right" />
      <PWAInstallPrompt />
      <IOSInstallPrompt />
      <PWAUpdateNotification />
      <EnhancedOfflineIndicator />
    </AuthProvider>
  );
}

function AppRoutes() {
  const { user, loading } = useAuth();

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
      <Route path="/login" element={!user ? <Login /> : <Navigate to={user.role === 'admin' ? '/admin' : '/member'} />} />
      <Route path="/register" element={!user ? <Register /> : <Navigate to={user.role === 'admin' ? '/admin' : '/member'} />} />

      {/* Member Routes */}
      <Route path="/member" element={
        <ProtectedRoute requiredRole="member">
          <MemberLayout />
        </ProtectedRoute>
      }>
        <Route index element={<MemberDashboard />} />
        <Route path="repertoire" element={<MemberRepertoire />} />
        <Route path="calendar" element={<MemberCalendar />} />
        <Route path="calendar/:eventId" element={<EventDetail />} />
        <Route path="messages" element={<MemberMessages />} />
        <Route path="practice" element={<MemberPractice />} />
        <Route path="profile" element={<MemberProfile />} />
      </Route>

      {/* Admin Routes */}
      <Route path="/admin" element={
        <ProtectedRoute requiredRole="admin">
          <AdminLayout />
        </ProtectedRoute>
      }>
        <Route index element={<AdminDashboard />} />
        <Route path="repertoire" element={<AdminRepertoire />} />
        <Route path="members" element={<AdminMembers />} />
        <Route path="events" element={<AdminEvents />} />
        <Route path="messages" element={<AdminMessages />} />
      </Route>

      {/* Root redirect */}
      <Route path="/" element={
        user ? (
          <Navigate to={user.role === 'admin' ? '/admin' : '/member'} />
        ) : (
          <Navigate to="/login" />
        )
      } />

      {/* 404 */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;

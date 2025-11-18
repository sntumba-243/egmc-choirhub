import React from 'react';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  requiredRole: 'admin' | 'member' | 'guest';
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ requiredRole, children }) => {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-blue-50">
        <div className="text-blue-900 text-xl">Please log in to continue</div>
      </div>
    );
  }

  // Admin can only access admin routes
  if (requiredRole === 'admin' && user.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-blue-50">
        <div className="text-red-900 text-xl">Access denied</div>
      </div>
    );
  }

  // Member routes can be accessed by both 'member' and 'guest'
  if (requiredRole === 'member' && user.role === 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-blue-50">
        <div className="text-red-900 text-xl">Access denied</div>
      </div>
    );
  }

  return <>{children}</>;
};

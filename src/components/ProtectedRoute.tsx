import React from 'react';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  requiredRole: 'admin' | 'member';
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

  if (user.role !== requiredRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-blue-50">
        <div className="text-red-900 text-xl">Access denied</div>
      </div>
    );
  }

  return <>{children}</>;
};

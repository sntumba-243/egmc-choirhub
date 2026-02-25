import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'member' | 'admin' | 'super_admin';
  requireAdmin?: boolean;
}

export const ProtectedRoute = ({ children, requiredRole, requireAdmin = false }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }


  if (requiredRole === 'super_admin') {
    if (!user.is_super_admin) {
      if (user.role === 'admin') return <Navigate to="/admin" replace />;
      return <Navigate to="/member" replace />;
    }
  }

  if (requiredRole === 'admin' || requireAdmin) {
    if (user.role !== 'admin' && !user.is_super_admin) {
      return <Navigate to="/member" replace />;
    }
  }

  if (requiredRole === 'member') {
    // All roles can access member pages
  }

  return <>{children}</>;
};

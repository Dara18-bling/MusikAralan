import { Navigate, Outlet } from 'react-router-dom';

interface User {
  role: 'super_admin' | 'admin' | 'student';
  isAuthenticated: boolean;
}

// Simulated current user (In a real app, fetch this from context or state)
const currentUser: User = {
  role: 'admin', 
  isAuthenticated: true,
};

interface ProtectedRouteProps {
  allowedRoles: Array<'super_admin' | 'admin' | 'student'>;
}

export const ProtectedRoute = ({ allowedRoles }: ProtectedRouteProps) => {
  if (!currentUser.isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(currentUser.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />; // Renders the child routes if role is matched
};
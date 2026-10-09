import { Navigate, Outlet, useLocation } from 'react-router';
import { useApp } from '../AppContext.jsx';

// Route wrapper: sends logged-out visitors to the login page, then back here afterwards.
export default function RequireAuth() {
  const { user } = useApp();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <Outlet />;
}

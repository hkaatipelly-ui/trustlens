import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { Button, ErrorState, LoadingState } from './ui.jsx';

export default function ProtectedRoute({ children }) {
  const { user, loading, error, retry, logout } = useAuth();
  const location = useLocation();
  if (loading) return <div className="mx-auto max-w-lg px-5 pt-32"><LoadingState label="Verifying your session…" /></div>;
  if (error) return <div className="mx-auto max-w-lg px-5 pt-32"><ErrorState error={error} retry={retry} /><Button onClick={logout} className="mt-4">Return to login</Button></div>;
  return user ? children : <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
}

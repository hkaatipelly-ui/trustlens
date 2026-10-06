import { AnimatePresence } from 'motion/react';
import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import AppShell from './components/layout/AppShell.jsx';
import PageTransition from './components/motion/PageTransition.jsx';
import { OperationsProvider } from './contexts/OperationsContext.jsx';
import { LoadingState } from './components/ui.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';

const Home = lazy(() => import('./pages/Home.jsx'));
const Console = lazy(() => import('./pages/Console.jsx'));
const Approvals = lazy(() => import('./pages/Approvals.jsx'));
const Outbox = lazy(() => import('./pages/Outbox.jsx'));
const Audit = lazy(() => import('./pages/Audit.jsx'));
const Policies = lazy(() => import('./pages/Policies.jsx'));
const Playground = lazy(() => import('./pages/Playground.jsx'));

function Workspace() {
  const location = useLocation();
  return <OperationsProvider><AppShell><AnimatePresence mode="wait" initial={false}><Routes location={location} key={location.pathname}>
    {[['/', Home], ['/console', Console], ['/approvals', Approvals], ['/outbox', Outbox], ['/audit', Audit], ['/policies', Policies], ['/playground', Playground]].map(([path, Page]) => <Route key={path} path={path} element={<PageTransition><Suspense fallback={<LoadingState label="Opening operations view…" />}><Page /></Suspense></PageTransition>} />)}
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></AnimatePresence></AppShell></OperationsProvider>;
}

export default function App() {
  const location = useLocation();
  return <AnimatePresence mode="wait" initial={false}><Routes location={location} key={['/login', '/register'].includes(location.pathname) ? location.pathname : 'workspace'}>
    <Route path="/login" element={<Login />} />
    <Route path="/register" element={<Register />} />
    <Route path="*" element={<ProtectedRoute><Workspace /></ProtectedRoute>} />
  </Routes></AnimatePresence>;
}

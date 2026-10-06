import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import * as auth from '../services/auth.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState({ user: null, loading: true, error: null });
  const [attempt, setAttempt] = useState(0);
  const logout = useCallback(() => {
    localStorage.removeItem('tl_token');
    setSession({ user: null, loading: false, error: null });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    if (!localStorage.getItem('tl_token')) {
      setSession({ user: null, loading: false, error: null });
    } else {
      setSession({ user: null, loading: true, error: null });
      auth.getMe({ signal: controller.signal }).then(({ user }) => {
        if (active) setSession({ user, loading: false, error: null });
      }).catch((error) => {
        if (!active || controller.signal.aborted) return;
        if (error.status === 401) logout();
        else setSession({ user: null, loading: false, error });
      });
    }
    return () => { active = false; controller.abort(); };
  }, [attempt, logout]);

  useEffect(() => {
    function storage(event) { if (event.key === 'tl_token') setAttempt((value) => value + 1); }
    window.addEventListener('tl:session-expired', logout);
    window.addEventListener('storage', storage);
    return () => { window.removeEventListener('tl:session-expired', logout); window.removeEventListener('storage', storage); };
  }, [logout]);

  async function authenticate(method, details) {
    const { token, user } = await auth[method](details);
    localStorage.setItem('tl_token', token);
    setSession({ user, loading: false, error: null });
    return user;
  }
  return <AuthContext.Provider value={{ ...session, login: (details) => authenticate('login', details), register: (details) => authenticate('register', details), logout, retry: () => setAttempt((value) => value + 1) }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

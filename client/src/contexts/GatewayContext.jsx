import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { getHealth } from '../services/catalog.js';

const GatewayContext = createContext(null);

export function GatewayProvider({ children }) {
  const [health, setHealth] = useState({ data: null, error: null, waking: false });
  const pending = useRef(null);
  const reload = useCallback(async () => {
    pending.current?.controller.abort();
    clearTimeout(pending.current?.timer);
    const controller = new AbortController();
    const request = { controller, timer: null };
    pending.current = request;
    setHealth((old) => ({ ...old, error: null, waking: false }));
    request.timer = setTimeout(() => {
      if (!controller.signal.aborted) setHealth((old) => ({ ...old, waking: true }));
    }, 2000);
    try {
      const data = await getHealth({ signal: controller.signal });
      if (data?.status !== 'ok') throw new Error('The gateway returned an unexpected health response.');
      if (!controller.signal.aborted) setHealth({ data, error: null, waking: false });
    } catch (error) {
      if (!controller.signal.aborted) setHealth((old) => ({ ...old, error, waking: false }));
    } finally {
      clearTimeout(request.timer);
      if (pending.current === request) pending.current = null;
    }
  }, []);

  useEffect(() => {
    reload();
    function checkVisible() { if (!document.hidden && !pending.current) reload(); }
    const interval = setInterval(checkVisible, 60000);
    document.addEventListener('visibilitychange', checkVisible);
    return () => {
      pending.current?.controller.abort();
      clearTimeout(pending.current?.timer);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', checkVisible);
    };
  }, [reload]);
  return <GatewayContext.Provider value={{ ...health, reload }}>{children}</GatewayContext.Provider>;
}

export const useGateway = () => useContext(GatewayContext);

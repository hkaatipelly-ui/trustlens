import { useCallback, useEffect, useRef, useState } from 'react';

export default function useData(load, dependencies = [], { interval = 30000 } = {}) {
  const loader = useRef(load);
  loader.current = load;
  const [version, setVersion] = useState(0);
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const reload = useCallback(() => setVersion((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    let controller;
    async function fetchData() {
      controller?.abort();
      const current = new AbortController();
      controller = current;
      try {
        const data = await loader.current({ signal: current.signal });
        if (active && !current.signal.aborted) setState({ data, loading: false, error: null });
      } catch (error) {
        if (active && !current.signal.aborted) setState((old) => ({ ...old, loading: false, error }));
      }
    }
    fetchData();
    function update() { if (!document.hidden) fetchData(); }
    window.addEventListener('tl:data-changed', update);
    document.addEventListener('visibilitychange', update);
    const timer = interval ? window.setInterval(update, interval) : null;
    return () => {
      active = false;
      controller?.abort();
      window.clearInterval(timer);
      window.removeEventListener('tl:data-changed', update);
      document.removeEventListener('visibilitychange', update);
    };
    // Callers provide the values that identify the resource, not a new loader each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, interval, ...dependencies]);
  return { ...state, reload };
}

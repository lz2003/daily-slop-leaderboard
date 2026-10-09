import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';

/**
 * Fetch `path` from the API whenever it changes. Pass null to skip.
 * Returns { data, error, loading, reload }.
 */
export function useApi(path) {
  const [state, setState] = useState({ loading: !!path, data: null, error: null });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!path) {
      setState({ loading: false, data: null, error: null });
      return undefined;
    }
    let cancelled = false;
    setState({ loading: true, data: null, error: null });
    api(path)
      .then((data) => !cancelled && setState({ loading: false, data, error: null }))
      .catch((err) => !cancelled && setState({ loading: false, data: null, error: err.message }));
    return () => { cancelled = true; };
  }, [path, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { ...state, reload };
}

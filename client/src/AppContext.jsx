import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';

const AppContext = createContext(null);

/**
 * App-wide state: the logged-in user, supported games, the user's groups, and leaderboard
 * view preferences (shared so switching pages keeps the same period/sort).
 */
export function AppProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [user, setUser] = useState(null);
  const [games, setGames] = useState([]);
  const [groups, setGroups] = useState([]);
  const [prefs, setPrefs] = useState({ period: 'today', sort: 'total', game: null });

  const refreshGroups = useCallback(async () => {
    setGroups((await api('/api/groups')).groups);
  }, []);

  useEffect(() => {
    Promise.all([api('/api/me'), api('/api/games')])
      .then(async ([me, g]) => {
        setGames(g.games);
        if (me.user) await refreshGroups();
        setUser(me.user);
        setReady(true);
      })
      .catch((err) => setLoadError(err.message));
  }, [refreshGroups]);

  const signIn = useCallback(async (mode, credentials) => {
    const res = await api(`/api/${mode}`, { method: 'POST', body: credentials });
    await refreshGroups();
    setUser(res.user);
  }, [refreshGroups]);

  const logOut = useCallback(async () => {
    await api('/api/logout', { method: 'POST', body: {} });
    setUser(null);
    setGroups([]);
  }, []);

  const value = useMemo(() => ({
    ready, loadError, user, games, groups, prefs, setPrefs, refreshGroups, signIn, logOut,
    currentGame: games.find((g) => g.id === prefs.game) || games[0],
    gameById: (id) => games.find((g) => g.id === id) || games[0],
  }), [ready, loadError, user, games, groups, prefs, refreshGroups, signIn, logOut]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  return useContext(AppContext);
}

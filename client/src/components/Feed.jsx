import { Link } from 'react-router';
import { useApp } from '../AppContext.jsx';
import { fmt, prettyDate } from '../format.js';
import { gameUI } from '../games.jsx';
import { useApi } from '../useApi.js';

// Recent submissions from members of a group.
export default function Feed({ groupId }) {
  const { gameById } = useApp();
  const { data, error, loading } = useApi(`/api/feed?group=${groupId}`);

  if (loading) return <p className="muted">Loading…</p>;
  if (error) return <p className="error">{error}</p>;
  if (!data.results.length) return <p className="muted">Nothing yet.</p>;

  return (
    <ul className="feed">
      {data.results.map((r) => {
        const game = gameById(r.game);
        const note = gameUI(r.game).feedNote(r.details);
        return (
          <li key={r.id}>
            <Link to={`/u/${encodeURIComponent(r.username)}`}><strong>{r.username}</strong></Link>{' '}
            <span className="score">{fmt(r.score)} {game.scoreLabel}</span>
            <span className="sub">
              {game.name} · {prettyDate(r.date)}{note ? ` · ${note}` : ''}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

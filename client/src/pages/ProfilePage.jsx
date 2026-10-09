import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useApp } from '../AppContext.jsx';
import { fmt, localDate, prettyDate } from '../format.js';
import { useApi } from '../useApi.js';
import { gameUI } from '../games.jsx';
import { Card, StatCard } from '../components/Badges.jsx';
import GameTabs from '../components/GameTabs.jsx';

// Consecutive days played, ending today (or yesterday, if today isn't in yet).
function currentStreak(results) {
  const dates = new Set(results.map((r) => r.date));
  let streak = 0;
  for (let i = dates.has(localDate()) ? 0 : -1; dates.has(localDate(i)); i--) streak++;
  return streak;
}

function ProfileStats({ results, game }) {
  const scores = results.map((r) => r.score);
  const total = scores.reduce((a, b) => a + b, 0);
  const best = game.higherIsBetter ? Math.max(...scores) : Math.min(...scores);
  const unit = game.scoreLabel;
  return (
    <div className="stats">
      <StatCard value={results.length} label="Days played" />
      <StatCard value={currentStreak(results)} label="Current streak" />
      <StatCard value={scores.length ? fmt(best) : '—'} label={`Best ${unit}`} />
      <StatCard value={scores.length ? fmt(Math.round(total / scores.length)) : '—'} label={`Average ${unit}`} />
      <StatCard value={fmt(total)} label={`Total ${unit}`} />
    </div>
  );
}

function HistoryTable({ results, game }) {
  const { ResultCell } = gameUI(game.id);
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Day</th><th>Result</th><th className="num">{game.scoreLabel}</th></tr></thead>
        <tbody>
          {results.map((r) => (
            <tr key={r.id}>
              <td>{prettyDate(r.date)}</td>
              <td><ResultCell details={r.details} /></td>
              <td className="num"><strong>{fmt(r.score)}</strong></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ProfilePage() {
  const { username } = useParams();
  const { user: me, games, currentGame } = useApp();
  const [gameId, setGameId] = useState(currentGame.id);
  const { data, error, loading } = useApi(`/api/users/${encodeURIComponent(username)}`);

  if (loading && !data) return <div className="card empty">Loading…</div>;
  if (error) return <div className="card"><p className="error">{error}</p></div>;

  const { user } = data;
  const game = games.find((g) => g.id === gameId);
  const results = data.results.filter((r) => r.game === gameId);
  const isMe = me.id === user.id;
  return (
    <>
      <div className="page-head">
        <div>
          <h1>{user.username}</h1>
          <div className="muted">Joined {new Date(`${user.createdAt}Z`).toLocaleDateString()}</div>
        </div>
      </div>
      <GameTabs games={games} value={gameId} onChange={setGameId} />
      <ProfileStats results={results} game={game} />
      <Card title={`${game.name} history`}>
        {results.length
          ? <HistoryTable results={results} game={game} />
          : <p className="muted">No {game.name} results yet.{isMe && <> <Link to="/submit">Submit one →</Link></>}</p>}
      </Card>
    </>
  );
}

import { Link } from 'react-router';
import { useApp } from '../AppContext.jsx';
import { fmt } from '../format.js';
import { gameUI } from '../games.jsx';
import { Medal } from './Badges.jsx';

function PlayerLink({ username }) {
  return <Link to={`/u/${encodeURIComponent(username)}`}>{username}</Link>;
}

function useIsMe() {
  const { user } = useApp();
  return (username) => (user && user.username === username ? 'me' : '');
}

// One day's results: each player's score plus a game-specific summary of their result.
export function DayTable({ rows, game }) {
  const isMe = useIsMe();
  const { ResultCell } = gameUI(game.id);
  const sorted = [...rows].sort((a, b) => (game.higherIsBetter ? b.total - a.total : a.total - b.total));
  return (
    <table>
      <thead>
        <tr><th>#</th><th>Player</th><th>Result</th><th className="num">{game.scoreLabel}</th></tr>
      </thead>
      <tbody>
        {sorted.map((r, i) => (
          <tr key={r.username} className={isMe(r.username)}>
            <td className="rank"><Medal rank={i + 1} /></td>
            <td className="player"><PlayerLink username={r.username} /></td>
            <td>{r.result && <ResultCell details={r.result.details} />}</td>
            <td className="num"><strong>{fmt(r.total)}</strong></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const COLUMNS = [
  { key: 'total', label: (unit) => `Total ${unit}` },
  { key: 'average', label: () => 'Avg' },
  { key: 'best', label: () => 'Best' },
  { key: 'days', label: () => 'Days' },
];

// Multi-day aggregate, re-rankable by any column.
export function RangeTable({ rows, game, sort, onSort }) {
  const isMe = useIsMe();
  const dir = game.higherIsBetter ? -1 : 1;
  const sorted = [...rows].sort((a, b) => (sort === 'days'
    ? b.days - a.days || dir * (a.total - b.total)
    : dir * (a[sort] - b[sort])));

  return (
    <>
      <table>
        <thead>
          <tr>
            <th>#</th><th>Player</th>
            {COLUMNS.map((c) => (
              <th key={c.key} className={`num sortable ${sort === c.key ? 'sorted' : ''}`} onClick={() => onSort(c.key)}>
                {c.label(game.scoreLabel)}{sort === c.key ? ' ↓' : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr key={r.username} className={isMe(r.username)}>
              <td className="rank"><Medal rank={i + 1} /></td>
              <td className="player"><PlayerLink username={r.username} /></td>
              <td className="num"><strong>{fmt(r.total)}</strong></td>
              <td className="num">{fmt(r.average)}</td>
              <td className="num">{fmt(r.best)}</td>
              <td className="num">{r.days}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted small">
        Click a column to re-rank. "Total" rewards playing every day; "Avg" is fairer for occasional players.
      </p>
    </>
  );
}

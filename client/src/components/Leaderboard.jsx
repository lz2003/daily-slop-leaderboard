import { Link } from 'react-router';
import { useApp } from '../AppContext.jsx';
import { localDate, prettyDate } from '../format.js';
import { useApi } from '../useApi.js';
import GameTabs from './GameTabs.jsx';
import { DayTable, RangeTable } from './LeaderboardTables.jsx';

export const PERIODS = [
  { key: 'today', label: 'Today', range: () => [localDate(), localDate()] },
  { key: 'yesterday', label: 'Yesterday', range: () => [localDate(-1), localDate(-1)] },
  { key: 'week', label: '7 days', range: () => [localDate(-6), localDate()] },
  { key: 'month', label: '30 days', range: () => [localDate(-29), localDate()] },
  { key: 'all', label: 'All time', range: () => ['0000-01-01', '9999-12-31'] },
];

function PeriodTabs({ value, onChange }) {
  return (
    <div className="seg">
      {PERIODS.map((p) => (
        <button key={p.key} type="button" className={p.key === value ? 'on' : ''} onClick={() => onChange(p.key)}>
          {p.label}
        </button>
      ))}
    </div>
  );
}

function GroupSelect({ groups, value, onChange }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label="Group">
      {groups.map((g) => <option key={g.id} value={g.id}>👥 {g.name}</option>)}
    </select>
  );
}

/**
 * A group's leaderboard for one game at a time, with game tabs and period controls.
 * Pass `onGroupChange` to show a group picker.
 */
export default function Leaderboard({ groupId, onGroupChange }) {
  const { games, groups, currentGame: game, prefs, setPrefs } = useApp();
  const [from, to] = PERIODS.find((p) => p.key === prefs.period).range();
  const single = from === to;
  const params = new URLSearchParams({ game: game.id, from, to, group: groupId });
  const { data, error, loading } = useApi(`/api/leaderboard?${params}`);

  const update = (patch) => setPrefs((p) => ({ ...p, ...patch }));

  let body;
  if (loading) {
    body = <div className="empty">Loading…</div>;
  } else if (error) {
    body = <div className="error">{error}</div>;
  } else if (!data.rows.length) {
    body = (
      <div className="empty">
        No {game.name} results {single ? `for ${prettyDate(from).toLowerCase()}` : 'in this period'} yet.
        <br /><Link to="/submit">Submit yours →</Link>
      </div>
    );
  } else if (single) {
    body = <DayTable rows={data.rows} game={game} />;
  } else {
    body = <RangeTable rows={data.rows} game={game} sort={prefs.sort} onSort={(sort) => update({ sort })} />;
  }

  return (
    <>
      <GameTabs games={games} value={game.id} onChange={(id) => update({ game: id })} />
      <div className="controls">
        {onGroupChange && groups.length > 1 && (
          <GroupSelect groups={groups} value={groupId} onChange={onGroupChange} />
        )}
        <PeriodTabs value={prefs.period} onChange={(period) => update({ period })} />
      </div>
      <div className="table-wrap">{body}</div>
    </>
  );
}

import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useApp } from '../AppContext.jsx';
import { Card, PlayLinks } from '../components/Badges.jsx';
import Feed from '../components/Feed.jsx';
import Leaderboard from '../components/Leaderboard.jsx';

// Which group the home page last showed (a per-browser convenience; storage may be unavailable).
function readLastGroup() {
  try { return localStorage.getItem('lastGroup'); } catch { return null; }
}
function writeLastGroup(id) {
  try { localStorage.setItem('lastGroup', String(id)); } catch { /* ignore */ }
}

function Welcome({ games }) {
  return (
    <div className="card auth-card" style={{ maxWidth: 520 }}>
      <h1>🏆 Daily Slop</h1>
      <p>Play the daily games, paste your results, and see who's the most skilled in your friend group.</p>
      <p className="muted small">Supported: <PlayLinks games={games} /></p>
      <div className="form-actions">
        <Link to="/signup"><button type="button">Sign up</button></Link>
        <Link to="/login">Log in</Link>
      </div>
    </div>
  );
}

function NoGroups() {
  return (
    <div className="card auth-card" style={{ maxWidth: 520 }}>
      <h1>Join a group to see a leaderboard</h1>
      <p>Leaderboards are per group. Create one and invite your friends, or join with an invite code.</p>
      <div className="form-actions">
        <Link to="/groups"><button type="button">Create or join a group</button></Link>
        <Link to="/submit">Submit a result</Link>
      </div>
    </div>
  );
}

export default function HomePage() {
  const { user, games, groups } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();

  const ids = groups.map((g) => String(g.id));
  const wanted = [searchParams.get('group'), readLastGroup()].find((id) => id && ids.includes(id));
  const group = groups.find((g) => String(g.id) === (wanted || ids[0]));

  useEffect(() => {
    if (group) writeLastGroup(group.id);
  }, [group]);

  if (!user) return <Welcome games={games} />;
  if (!group) return <NoGroups />;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{groups.length > 1 ? 'Leaderboard' : group.name}</h1>
          <div className="muted">
            <PlayLinks games={games} prefix="Play " /> · <Link to={`/groups/${group.id}`}>Group details</Link>
          </div>
        </div>
        <Link to="/submit"><button type="button">Submit a result</button></Link>
      </div>
      <div className="grid-2">
        <Card>
          <Leaderboard
            groupId={String(group.id)}
            onGroupChange={(id) => setSearchParams({ group: id }, { replace: true })}
          />
        </Card>
        <Card title="Recent results">
          <Feed groupId={group.id} />
        </Card>
      </div>
    </>
  );
}

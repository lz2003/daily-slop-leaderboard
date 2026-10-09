import { Link, useNavigate, useParams } from 'react-router';
import { api } from '../api.js';
import { useApp } from '../AppContext.jsx';
import { plural } from '../format.js';
import { useApi } from '../useApi.js';
import { Card } from '../components/Badges.jsx';
import Feed from '../components/Feed.jsx';
import Leaderboard from '../components/Leaderboard.jsx';
import { useToast } from '../components/Toast.jsx';

function InviteCard({ code }) {
  const toast = useToast();
  const link = `${window.location.origin}/join/${code}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      toast('Invite link copied');
    } catch {
      window.prompt('Copy this invite link:', link);
    }
  }

  return (
    <Card title="Invite friends">
      <div>Code: <span className="code">{code}</span></div>
      <div className="form-actions"><button type="button" className="secondary" onClick={copy}>Copy invite link</button></div>
    </Card>
  );
}

function MembersCard({ group, members }) {
  const { refreshGroups } = useApp();
  const navigate = useNavigate();

  async function leave() {
    const last = members.length === 1 ? " You're the last member, so the group will be deleted." : '';
    if (!window.confirm(`Leave "${group.name}"?${last}`)) return;
    await api(`/api/groups/${group.id}/leave`, { method: 'POST', body: {} });
    await refreshGroups();
    navigate('/groups');
  }

  return (
    <Card title="Members">
      <ul className="list">
        {members.map((m) => (
          <li key={m.id}>
            <Link to={`/u/${encodeURIComponent(m.username)}`}>{m.username}</Link>
            {m.id === group.owner_id && <span className="muted small">creator</span>}
          </li>
        ))}
      </ul>
      <div className="form-actions"><button type="button" className="danger" onClick={leave}>Leave group</button></div>
    </Card>
  );
}

export default function GroupPage() {
  const { id } = useParams();
  const { data, error, loading } = useApi(`/api/groups/${encodeURIComponent(id)}`);

  if (loading && !data) return <div className="card empty">Loading…</div>;
  if (error) {
    return (
      <div className="card">
        <p className="error">{error}</p>
        <Link to="/groups">← Back to groups</Link>
      </div>
    );
  }

  const { group, members } = data;
  return (
    <>
      <div className="page-head">
        <div>
          <Link to="/groups" className="small">← Groups</Link>
          <h1>{group.name}</h1>
          <div className="muted">{plural(members.length, 'member')}</div>
        </div>
        <Link to="/submit"><button type="button">Submit a result</button></Link>
      </div>
      <div className="grid-2">
        <Card><Leaderboard groupId={String(group.id)} /></Card>
        <div>
          <InviteCard code={group.invite_code} />
          <MembersCard group={group} members={members} />
          <Card title="Recent results"><Feed groupId={group.id} /></Card>
        </div>
      </div>
    </>
  );
}

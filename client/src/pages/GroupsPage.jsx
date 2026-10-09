import { useEffect, useId, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { api } from '../api.js';
import { useApp } from '../AppContext.jsx';
import { plural } from '../format.js';
import { Card } from '../components/Badges.jsx';

// A one-field form card that POSTs and then opens the resulting group.
function GroupActionForm({ title, label, placeholder, inputStyle, buttonText, submit }) {
  const { refreshGroups } = useApp();
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inputId = useId();

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { group } = await submit(value);
      await refreshGroups();
      navigate(`/groups/${group.id}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      <h2>{title}</h2>
      <label htmlFor={inputId}>{label}</label>
      <input id={inputId} required maxLength={40} placeholder={placeholder} style={inputStyle} value={value}
        onChange={(e) => setValue(e.target.value)} />
      <div className="error">{error}</div>
      <div className="form-actions"><button type="submit" disabled={busy}>{buttonText}</button></div>
    </form>
  );
}

export function CreateGroupForm() {
  return (
    <GroupActionForm title="Create a group" label="Name" placeholder="e.g. The Roll Call" buttonText="Create"
      submit={(name) => api('/api/groups', { method: 'POST', body: { name } })} />
  );
}

export function JoinGroupForm() {
  return (
    <GroupActionForm title="Join a group" label="Invite code" placeholder="ABCD2345" buttonText="Join"
      inputStyle={{ textTransform: 'uppercase' }}
      submit={(code) => api('/api/groups/join', { method: 'POST', body: { code } })} />
  );
}

export default function GroupsPage() {
  const { groups, refreshGroups } = useApp();

  // Member counts may have changed since we last loaded.
  useEffect(() => { refreshGroups(); }, [refreshGroups]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Groups</h1>
          <div className="muted">Compete with friends on a private leaderboard.</div>
        </div>
      </div>
      <Card title="Your groups">
        {groups.length ? (
          <ul className="list">
            {groups.map((g) => (
              <li key={g.id}>
                <Link to={`/groups/${g.id}`}><strong>{g.name}</strong></Link>
                <span className="muted small">{plural(g.member_count, 'member')}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">You're not in any groups yet. Create one or join with an invite code.</p>
        )}
      </Card>
      <div className="grid-even">
        <CreateGroupForm />
        <JoinGroupForm />
      </div>
    </>
  );
}

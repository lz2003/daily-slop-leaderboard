import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api } from '../api.js';
import { useApp } from '../AppContext.jsx';

// Landing page for invite links: /join/:code
export default function JoinPage() {
  const { code } = useParams();
  const { refreshGroups } = useApp();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  async function join() {
    try {
      const { group } = await api('/api/groups/join', { method: 'POST', body: { code } });
      await refreshGroups();
      navigate(`/groups/${group.id}`);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="card auth-card">
      <h1>Join group</h1>
      <p>You've been invited with code <span className="code">{code}</span>.</p>
      <div className="error">{error}</div>
      <div className="form-actions">
        <button type="button" onClick={join}>Join group</button>
        <Link to="/">Cancel</Link>
      </div>
    </div>
  );
}

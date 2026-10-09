import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { useApp } from '../AppContext.jsx';

// Log in or sign up, depending on `mode`.
export default function AuthPage({ mode }) {
  const { user, signIn } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isSignup = mode === 'signup';
  const next = location.state?.from || '/';

  if (user) return <Navigate to={next} replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await signIn(mode, { username, password });
      navigate(next, { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="card auth-card">
      <h1>{isSignup ? 'Create an account' : 'Welcome back'}</h1>
      <form onSubmit={handleSubmit}>
        <label htmlFor="u">Username</label>
        <input
          id="u"
          autoFocus
          autoComplete="username"
          required
          pattern={isSignup ? '[A-Za-z0-9_.\\-]{3,24}' : undefined}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <label htmlFor="p">Password</label>
        <input
          id="p"
          type="password"
          autoComplete={isSignup ? 'new-password' : 'current-password'}
          required
          minLength={isSignup ? 8 : undefined}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {isSignup && <div className="muted small" style={{ marginTop: 6 }}>At least 8 characters.</div>}
        <div className="error">{error}</div>
        <div className="form-actions">
          <button type="submit" disabled={busy}>{isSignup ? 'Sign up' : 'Log in'}</button>
          <span className="muted small">
            {isSignup
              ? <>Have an account? <Link to="/login" state={location.state}>Log in</Link></>
              : <>New here? <Link to="/signup" state={location.state}>Sign up</Link></>}
          </span>
        </div>
      </form>
    </div>
  );
}

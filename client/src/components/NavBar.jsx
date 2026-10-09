import { Link, NavLink, useNavigate } from 'react-router';
import { useApp } from '../AppContext.jsx';

export default function NavBar() {
  const { user, logOut } = useApp();
  const navigate = useNavigate();

  async function handleLogOut() {
    await logOut();
    navigate('/');
  }

  return (
    <header className="topbar">
      <Link to="/" className="brand">🏆 Daily Slop</Link>
      <nav id="nav">
        {user ? (
          <>
            <NavLink to="/" end>Leaderboard</NavLink>
            <NavLink to="/groups">Groups</NavLink>
            <NavLink to={`/u/${encodeURIComponent(user.username)}`}>Profile</NavLink>
            <button type="button" className="link" onClick={handleLogOut}>Log out</button>
            <NavLink to="/submit" className="cta">+ Submit</NavLink>
          </>
        ) : (
          <>
            <NavLink to="/login">Log in</NavLink>
            <NavLink to="/signup" className="cta">Sign up</NavLink>
          </>
        )}
      </nav>
    </header>
  );
}

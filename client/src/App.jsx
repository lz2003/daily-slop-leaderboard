import { Route, Routes } from 'react-router';
import { useApp } from './AppContext.jsx';
import NavBar from './components/NavBar.jsx';
import RequireAuth from './components/RequireAuth.jsx';
import HomePage from './pages/HomePage.jsx';
import AuthPage from './pages/AuthPage.jsx';
import SubmitPage from './pages/SubmitPage.jsx';
import GroupsPage from './pages/GroupsPage.jsx';
import GroupPage from './pages/GroupPage.jsx';
import JoinPage from './pages/JoinPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

export default function App() {
  const { ready, loadError } = useApp();

  return (
    <>
      <NavBar />
      <main>
        {loadError && <div className="card"><p className="error">{loadError}</p></div>}
        {ready && (
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<AuthPage mode="login" />} />
            <Route path="/signup" element={<AuthPage mode="signup" />} />
            <Route element={<RequireAuth />}>
              <Route path="/submit" element={<SubmitPage />} />
              <Route path="/groups" element={<GroupsPage />} />
              <Route path="/groups/:id" element={<GroupPage />} />
              <Route path="/join/:code" element={<JoinPage />} />
              <Route path="/u/:username" element={<ProfilePage />} />
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        )}
      </main>
    </>
  );
}

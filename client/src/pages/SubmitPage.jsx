import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../api.js';
import { useApp } from '../AppContext.jsx';
import { fmt, localDate, prettyDate } from '../format.js';
import { useApi } from '../useApi.js';
import GameTabs from '../components/GameTabs.jsx';
import ResultPreview from '../components/ResultPreview.jsx';
import { useToast } from '../components/Toast.jsx';

// Parse the pasted text (debounced) so the player can see what we picked up before submitting.
function usePreview(gameId, text) {
  const [preview, setPreview] = useState(null);
  useEffect(() => {
    if (!text.trim()) {
      setPreview(null);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      api('/api/results/preview', { method: 'POST', body: { game: gameId, text } })
        .then((p) => !cancelled && setPreview({ ok: true, ...p }))
        .catch((err) => !cancelled && setPreview({ ok: false, error: err.message }));
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [gameId, text]);
  return preview;
}

export default function SubmitPage() {
  const { games, currentGame, gameById, setPrefs } = useApp();
  const navigate = useNavigate();
  const toast = useToast();
  const today = localDate();

  const [gameId, setGameId] = useState(currentGame.id);
  const [pickedDate, setPickedDate] = useState(today);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const game = gameById(gameId);
  const preview = usePreview(gameId, text);
  // Some games' share text says which day it was (e.g. Krillion's dive number).
  const date = game.datedByResult ? (preview?.ok ? preview.date : '') : pickedDate;
  const isFuture = !!date && date > today;
  // Each game/day can only be used once — check whether this one already is.
  const existing = useApi(date && !isFuture ? `/api/results/mine?game=${gameId}&date=${date}` : null);
  const taken = !!existing.data?.result;
  const dayLabel = date === today ? 'today' : date ? prettyDate(date) : '';

  async function handleSubmit(e) {
    e.preventDefault();
    if (!window.confirm(`Submit this as your ${game.name} result for ${dayLabel}? You won't be able to change it.`)) return;
    setBusy(true);
    setError('');
    try {
      const r = await api('/api/results', { method: 'POST', body: { game: gameId, text, date } });
      toast(`Saved — ${fmt(r.score)} ${game.scoreLabel}!`);
      setPrefs((p) => ({ ...p, game: gameId, period: r.date === today ? 'today' : 'all' }));
      navigate('/');
    } catch (err) {
      setError(err.message);
      setBusy(false);
      existing.reload();
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Submit a result</h1>
          <div className="muted">
            Hit <strong>Share</strong> in <a href={game.url} target="_blank" rel="noopener noreferrer">{game.name} ↗</a> to
            copy your result, then paste it here.
          </div>
        </div>
      </div>
      <GameTabs games={games} value={gameId} onChange={(id) => { setGameId(id); setText(''); setError(''); }} />
      <div className="grid-2">
        <form className="card" onSubmit={handleSubmit}>
          <label htmlFor="t">Share text</label>
          <textarea id="t" autoFocus required placeholder={game.placeholder} value={text}
            onChange={(e) => setText(e.target.value)} />

          <label htmlFor={game.datedByResult ? undefined : 'd'}>Day played</label>
          {game.datedByResult ? (
            <div className="muted small">
              {date ? <><strong>{prettyDate(date)}</strong> ({date}) — taken from your result.</>
                : `Worked out from your result — no need to pick one.`}
            </div>
          ) : (
            <input id="d" type="date" value={pickedDate} max={today} required style={{ maxWidth: 200 }}
              onChange={(e) => setPickedDate(e.target.value)} />
          )}
          <div className="small" style={{ marginTop: 6 }}>
            {isFuture && <span className="error">That day hasn't happened yet.</span>}
            {existing.error && <span className="error">{existing.error}</span>}
            {taken && (
              <span className="error">
                ✅ You already submitted {game.name} for {dayLabel}:{' '}
                <strong>{fmt(existing.data.result.score)} {game.scoreLabel}</strong>.
                {game.datedByResult ? '' : ' Pick another day.'}
              </span>
            )}
          </div>

          <div className="error">{error}</div>
          <div className="form-actions">
            <button type="submit" disabled={busy || !preview?.ok || !date || taken || isFuture || existing.loading}>
              {!date ? 'Submit' : date === today ? 'Submit for today' : `Submit for ${dayLabel}`}
            </button>
            <span className="muted small">One result per game per day — it can't be changed or deleted.</span>
          </div>
        </form>

        <div className="card">
          <h2>Preview</h2>
          {!preview && <span className="muted">Paste your result to see what we picked up.</span>}
          {preview && !preview.ok && <span className="error">{preview.error}</span>}
          {preview?.ok && <ResultPreview score={preview.score} details={preview.details} game={game} />}
        </div>
      </div>
    </>
  );
}

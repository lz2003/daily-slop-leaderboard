// Per-game display pieces. Each entry may provide:
//   ResultCell({ details })  — compact summary for a leaderboard row
//   Preview({ details })     — fuller breakdown for the submit preview
//   feedNote(details)        — a few words for the recent-results feed
import { TierBadge } from './components/Badges.jsx';

const rngdle = {
  ResultCell({ details: d }) {
    return (
      <>
        {d.number && `🎲 ${d.number} `}<TierBadge tier={d.tier} />
        {d.badgeCount > 0 && <span className="sub">{d.badgeCount} badges{d.percentile ? ` · ${d.percentile}` : ''}</span>}
      </>
    );
  },
  Preview({ details: d }) {
    const shown = d.badges || [];
    return (
      <>
        {d.number && <div>🎲 Rolled <strong>{d.number}</strong></div>}
        {d.tier && <div style={{ margin: '6px 0' }}><TierBadge tier={d.tier} /> {d.percentile}</div>}
        {shown.length > 0 && (
          <div className="small">
            {shown.map((b, i) => <div key={i}>{b.text}</div>)}
            {d.badgeCount > shown.length && <div className="muted">+{d.badgeCount - shown.length} more</div>}
          </div>
        )}
      </>
    );
  },
  feedNote: (d) => d.tier,
};

const KRILLION_TILE_NAMES = {
  plankton: 'Plankton', tooclever: 'Too Clever', schooler: 'Schooler', rare: 'Rare',
  deepcut: 'Deep Cut', krillion: 'One in a Krillion', miss: 'Miss',
};
const KRILLION_TILE_EMOJI = {
  plankton: '🫧', tooclever: '🤡', schooler: '🐟', rare: '🦑', deepcut: '🏮', krillion: '🌟', miss: '⬛',
};

// A player's seven prompts and what they answered.
function KrillionAnswers({ answers }) {
  return (
    <ol className="answers">
      {answers.map((a) => (
        <li key={a.round}>
          <span className="answer-tile" title={KRILLION_TILE_NAMES[a.tile] || ''}>{KRILLION_TILE_EMOJI[a.tile] || '·'}</span>
          <span className="answer-body">
            <span className="answer-prompt">{a.prompt}</span>
            <span className="answer-text">
              {a.answer === null ? <em className="muted">no answer</em> : a.recognized ? a.answer : <em>"{a.answer}"</em>}
            </span>
            {a.others !== null && (
              <span className="answer-others">{a.others.toLocaleString()} other{a.others === 1 ? '' : 's'} chose this</span>
            )}
          </span>
          <span className="answer-points">{a.points}</span>
        </li>
      ))}
    </ol>
  );
}

function KrillionAnswersToggle({ details: d }) {
  if (d.answersHidden) {
    return <span className="sub">🙈 Answers hidden until you've played this dive</span>;
  }
  if (!d.answers) return null;
  return (
    <details className="answers-toggle">
      <summary>Answers</summary>
      <KrillionAnswers answers={d.answers} />
    </details>
  );
}

const krillion = {
  ResultCell({ details: d }) {
    return (
      <>
        <span className="tiles">{d.emojis}</span>
        <span className="sub">Dive #{d.dive}</span>
        <KrillionAnswersToggle details={d} />
      </>
    );
  },
  Preview({ details: d }) {
    const counts = {};
    (d.tiles || []).forEach((t) => { counts[t] = (counts[t] || 0) + 1; });
    return (
      <>
        <div>🦐 Dive <strong>#{d.dive}</strong></div>
        <div className="tiles" style={{ margin: '6px 0' }}>{d.emojis}</div>
        <div className="small muted">
          {Object.entries(counts).map(([t, n]) => `${n}× ${KRILLION_TILE_NAMES[t] || t}`).join(' · ')}
        </div>
        {d.answers && <KrillionAnswers answers={d.answers} />}
      </>
    );
  },
  feedNote: (d) => d.emojis,
};

const UI = { rngdle, krillion };

const fallback = {
  ResultCell: () => null,
  Preview: () => null,
  feedNote: () => null,
};

export function gameUI(id) {
  return UI[id] || fallback;
}

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

const krillion = {
  ResultCell({ details: d }) {
    return (
      <>
        <span className="tiles">{d.emojis}</span>
        <span className="sub">Dive #{d.dive}</span>
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

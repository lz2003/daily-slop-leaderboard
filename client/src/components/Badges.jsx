// Small presentational bits shared across pages.

export function TierBadge({ tier }) {
  if (!tier) return null;
  return <span className={`tier ${tier}`}>{tier}</span>;
}

const MEDALS = ['🥇', '🥈', '🥉'];

export function Medal({ rank }) {
  return MEDALS[rank - 1] ? <span className="medal">{MEDALS[rank - 1]}</span> : rank;
}

export function Card({ title, children, className = '', ...rest }) {
  return (
    <div className={`card ${className}`} {...rest}>
      {title && <h2>{title}</h2>}
      {children}
    </div>
  );
}

export function StatCard({ value, label }) {
  return (
    <div className="stat">
      <div className="v">{value}</div>
      <div className="k">{label}</div>
    </div>
  );
}

export function PlayLinks({ games, prefix = '' }) {
  return games.map((g, i) => (
    <span key={g.id}>
      {i > 0 && ' · '}
      <a href={g.url} target="_blank" rel="noopener noreferrer">{prefix}{g.name} ↗</a>
    </span>
  ));
}

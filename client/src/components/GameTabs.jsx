// Segmented control for switching between games. Renders nothing when there's only one.
export default function GameTabs({ games, value, onChange }) {
  if (games.length < 2) return null;
  return (
    <div className="seg game-tabs" role="tablist" aria-label="Game">
      {games.map((g) => (
        <button key={g.id} type="button" role="tab" aria-selected={g.id === value}
          className={g.id === value ? 'on' : ''} onClick={() => onChange(g.id)}>
          {g.name}
        </button>
      ))}
    </div>
  );
}

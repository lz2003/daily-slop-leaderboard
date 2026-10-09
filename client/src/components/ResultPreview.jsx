import { fmt } from '../format.js';
import { gameUI } from '../games.jsx';

// What we parsed out of a pasted share text.
export default function ResultPreview({ score, details, game }) {
  const { Preview } = gameUI(game.id);
  return (
    <div className="preview">
      <div className="big">
        {fmt(score)} <span className="muted" style={{ fontSize: '1rem' }}>{game.scoreLabel}</span>
      </div>
      <Preview details={details} />
    </div>
  );
}

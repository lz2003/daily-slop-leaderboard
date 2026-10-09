// Parser for Krillion (https://krillion.io/) share text.
//
// The daily share text looks like:
//
//   Krillion #85 🦐
//   420
//
//   🫧🐟🦑⬛🏮🌟🤡
//
//   https://krillion.io        (optional)
//
// Archive replays ("Krillion ⟲ #12"), unlimited ("Krillion ∞ #3") and themed packs use other
// headers; only the daily dive counts.

const TILES = {
  '🫧': 'plankton',
  '🤡': 'tooclever',
  '🐟': 'schooler',
  '🦑': 'rare',
  '🏮': 'deepcut',
  '🌟': 'krillion',
  '⬛': 'miss',
};
const ROUNDS = 7;
const MAX_SCORE = 700;

// Dive #1 was 2026-07-16 (Krillion's days roll over in America/New_York).
const FIRST_DIVE_UTC = Date.UTC(2026, 6, 16);

function diveDate(dive) {
  return new Date(FIRST_DIVE_UTC + (dive - 1) * 86400000).toISOString().slice(0, 10);
}

const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });

function parse(text) {
  const lines = String(text || '')
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.trim());

  const headerIdx = lines.findIndex((l) => /^Krillion\b/i.test(l));
  if (headerIdx === -1) {
    throw new Error('That doesn\'t look like a Krillion result — it should start with "Krillion #".');
  }
  const header = lines[headerIdx].match(/^Krillion\s+#(\d+)\b/i);
  if (!header) {
    throw new Error('Only the daily dive counts — archive, unlimited and themed-pack results can\'t be submitted.');
  }
  const dive = parseInt(header[1], 10);
  if (dive < 1) throw new Error('Invalid dive number.');

  const rest = lines.slice(headerIdx + 1).filter((l) => l !== '');
  const scoreLine = rest[0] || '';
  if (!/^\d+$/.test(scoreLine)) {
    throw new Error('Could not find the score (the number on the line after "Krillion #…").');
  }
  const score = parseInt(scoreLine, 10);
  if (score > MAX_SCORE) throw new Error(`A Krillion score can't be more than ${MAX_SCORE}.`);

  const tileLine = rest.find((l, i) => i > 0 && [...segmenter.segment(l)].every((s) => TILES[s.segment])) || '';
  const tiles = [...segmenter.segment(tileLine)].map((s) => TILES[s.segment]);
  if (tiles.length > ROUNDS) throw new Error(`Expected at most ${ROUNDS} answer tiles.`);

  return {
    score,
    date: diveDate(dive),
    details: { dive, tiles, emojis: tileLine },
  };
}

module.exports = {
  id: 'krillion',
  name: 'Krillion',
  url: 'https://krillion.io/',
  scoreLabel: 'pts',
  higherIsBetter: true,
  // The share text identifies the day, so players don't pick a date.
  datedByResult: true,
  placeholder: 'Krillion #85 🦐\n420\n\n🫧🐟🦑⬛🏮🌟🤡\n\nhttps://krillion.io',
  parse,
  summarize(details) {
    return [`Dive #${details.dive}`, details.emojis].filter(Boolean).join(' · ');
  },
};

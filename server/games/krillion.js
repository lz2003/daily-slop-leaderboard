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
//
// Players can optionally also paste their answers, copied from the results page:
//
//   1
//   Name a Justin Bieber song
//   Sorry
//   33,246 other players chose this     (missing for misses)
//   10+                                 (round points, then the expand toggle: + or −)
//   2
//   ...
//
// If a round was expanded when copied, its full answer sheet follows the points line; we skip it.

const TILES = {
  '🫧': 'plankton',
  '🤡': 'tooclever',
  '🐟': 'schooler',
  '🦑': 'rare',
  '🏮': 'deepcut',
  '🌟': 'krillion',
  '⬛': 'miss',
};
// Points per round for each tile (from Krillion's tier definitions; a miss scores nothing).
const TILE_POINTS = {
  plankton: 10, tooclever: 15, schooler: 30, rare: 60, deepcut: 85, krillion: 100, miss: 0,
};
const ROUNDS = 7;
const MAX_SCORE = 700;

// Dive #1 was 2026-07-16 (Krillion's days roll over in America/New_York).
const FIRST_DIVE_UTC = Date.UTC(2026, 6, 16);

function diveDate(dive) {
  return new Date(FIRST_DIVE_UTC + (dive - 1) * 86400000).toISOString().slice(0, 10);
}

const nyDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
});

// The date of the current daily dive (Krillion's day rolls over in New York).
function currentDate(now = new Date()) {
  return nyDate.format(now);
}

const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });

const COUNT_RE = /^([\d,]+)\s+other players?\s+chose this$/i;
const POINTS_RE = /^(\d+)\s*[+−-]?$/;

// Parse the copied results-page rounds. Round markers ("1", "2", …) must appear in order, so an
// answer that happens to be a number can't start a new round early.
function parseAnswers(text) {
  const lines = String(text || '')
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const rounds = [];
  for (let i = 0; i < lines.length && rounds.length < ROUNDS;) {
    const round = rounds.length + 1;
    if (lines[i] !== String(round)) {
      i++;
      continue;
    }
    const prompt = lines[i + 1];
    const rawAnswer = lines[i + 2];
    let j = i + 3;
    let others = null;
    const count = COUNT_RE.exec(lines[j] || '');
    if (count) {
      others = parseInt(count[1].replace(/,/g, ''), 10);
      j++;
    }
    const points = POINTS_RE.exec(lines[j] || '');
    if (!prompt || !rawAnswer || !points) {
      throw new Error(`Couldn't read round ${round} of your answers. Copy the whole "the catch" list from the results page.`);
    }
    // Unrecognised answers are shown in quotes; no answer at all is shown as "—".
    const quoted = /^"(.*)"$/.exec(rawAnswer);
    rounds.push({
      round,
      prompt,
      answer: rawAnswer === '—' ? null : quoted ? quoted[1] : rawAnswer,
      recognized: !quoted && rawAnswer !== '—',
      others,
      points: parseInt(points[1], 10),
    });
    i = j + 1;
  }

  if (!rounds.length) {
    throw new Error('Couldn\'t find any rounds in your answers. Copy the list starting at round "1" from the results page.');
  }
  return rounds;
}

// The answers must belong to this share: same number of rounds, and each round's points must match
// its tile. Catches answers pasted from a different day.
function attachTiles(rounds, tiles) {
  if (tiles.length && rounds.length !== tiles.length) {
    throw new Error(`Your answers have ${rounds.length} rounds but your result has ${tiles.length} tiles.`);
  }
  return rounds.map((r, k) => {
    const tile = tiles[k];
    if (tile && TILE_POINTS[tile] !== r.points) {
      throw new Error(`Round ${r.round} of your answers scored ${r.points}, but your result shows ${tile} there. Are these from the same dive?`);
    }
    return { ...r, tile: tile || null };
  });
}

function parse(text, { answers } = {}) {
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

  const details = { dive, tiles, emojis: tileLine };
  if (answers && String(answers).trim()) details.answers = attachTiles(parseAnswers(answers), tiles);

  return { score, date: diveDate(dive), details };
}

module.exports = {
  diveDate,
  id: 'krillion',
  name: 'Krillion',
  url: 'https://krillion.io/',
  scoreLabel: 'pts',
  higherIsBetter: true,
  // The share text identifies the day, so players don't pick a date.
  datedByResult: true,
  currentDate,
  answersInput: {
    label: 'Your answers (optional)',
    help: 'On the results page, copy the "the catch" list (rounds 1–7) and paste it here. Group-mates see your answers once they\'ve played this dive, or after the day is over.',
    placeholder: '1\nName a Justin Bieber song\nSorry\n33,246 other players chose this\n10+\n2\n…',
  },
  placeholder: 'Krillion #85 🦐\n420\n\n🫧🐟🦑⬛🏮🌟🤡\n\nhttps://krillion.io',
  parse,
  summarize(details) {
    return [`Dive #${details.dive}`, details.emojis].filter(Boolean).join(' · ');
  },
};

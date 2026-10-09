// Parser for RNGdle (https://www.rngdle.com/) share text.
//
// The share text looks like:
//
//   RNGdle 🎲 650,000
//
//   🟥 MYTHIC • Top 1%
//
//   🟥 🦴 Semi-Eon
//   🟪 🏛️ Epoch
//   🟦 🌌 Deep Void (4)
//   +19 more
//
//   "optional poem"
//
//   10,069,608 EP
//   https://rngdle.com

const TIERS = ['TRASH', 'COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'ANOMALY', 'MYTHIC'];
const TIER_SQUARES = ['🟫', '⬜', '🟩', '🟦', '🟪', '🟧', '🟥'];

function parse(text) {
  const lines = String(text || '')
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.trim());

  const headerIdx = lines.findIndex((l) => /^RNGdle\b/i.test(l));
  if (headerIdx === -1) {
    throw new Error("That doesn't look like an RNGdle result — it should start with \"RNGdle 🎲\".");
  }
  const number = lines[headerIdx].replace(/^RNGdle\s*🎲?\s*/i, '').trim();

  // The total EP is the last "<n> EP" line.
  let score = null;
  for (let i = lines.length - 1; i > headerIdx; i--) {
    const m = lines[i].match(/^([\d,.\s]+)\s*EP$/i);
    if (m) {
      score = parseInt(m[1].replace(/[^\d]/g, ''), 10);
      break;
    }
  }
  if (score === null || Number.isNaN(score)) {
    throw new Error('Could not find the EP total (a line like "10,069,608 EP").');
  }

  let tier = null;
  let percentile = null;
  let tierIdx = -1;
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const m = lines[i].match(/\b(TRASH|UNCOMMON|COMMON|RARE|EPIC|ANOMALY|MYTHIC)\b(?:\s*•\s*((?:Top|Bottom)\s*<?\d+%))?/);
    if (m) {
      tier = m[1];
      percentile = m[2] || null;
      tierIdx = i;
      break;
    }
  }

  // Badge lines follow the tier line: "<square> <emoji> <label>", then optionally "+N more".
  const badges = [];
  let moreBadges = 0;
  if (tierIdx !== -1) {
    let i = tierIdx + 1;
    while (i < lines.length && lines[i] === '') i++;
    for (; i < lines.length && lines[i] !== ''; i++) {
      const more = lines[i].match(/^\+(\d+)\s*more$/i);
      if (more) {
        moreBadges = parseInt(more[1], 10);
        continue;
      }
      const square = TIER_SQUARES.find((s) => lines[i].startsWith(s));
      if (!square) break;
      const rest = lines[i].slice(square.length).trim();
      badges.push({ tier: TIERS[TIER_SQUARES.indexOf(square)], text: rest });
    }
  }

  return {
    score,
    details: {
      number,
      tier,
      percentile,
      badges,
      badgeCount: badges.length + moreBadges,
    },
  };
}

module.exports = {
  id: 'rngdle',
  name: 'RNGdle',
  url: 'https://www.rngdle.com/',
  scoreLabel: 'EP',
  higherIsBetter: true,
  placeholder: 'RNGdle 🎲 650,000\n\n🟥 MYTHIC • Top 1%\n\n🟥 🦴 Semi-Eon\n🟪 🏛️ Epoch\n+19 more\n\n10,069,608 EP\nhttps://rngdle.com',
  parse,
  // Short one-line summary shown next to a result.
  summarize(details) {
    const parts = [];
    if (details.number) parts.push(`🎲 ${details.number}`);
    if (details.tier) parts.push(details.tier + (details.percentile ? ` · ${details.percentile}` : ''));
    if (details.badgeCount) parts.push(`${details.badgeCount} badge${details.badgeCount === 1 ? '' : 's'}`);
    return parts.join(' · ');
  },
};

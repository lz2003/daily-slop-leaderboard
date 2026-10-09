// Registry of supported games. To add a game, create a module exporting
// { id, name, url, scoreLabel, higherIsBetter, placeholder, parse(text), summarize(details) }
// and add it to this list. parse() may also return a `date` (YYYY-MM-DD) when the share text
// identifies the day; set `datedByResult: true` so the UI doesn't ask for one. Games that accept a
// second pasted text (e.g. answers) describe it in `answersInput`; parse() receives it as { answers }.
// `currentDate()` returns the game's own "today" if it differs from UTC.
const games = [require('./rngdle'), require('./krillion')];

const byId = Object.fromEntries(games.map((g) => [g.id, g]));

function publicInfo(g) {
  return {
    id: g.id,
    name: g.name,
    url: g.url,
    scoreLabel: g.scoreLabel,
    higherIsBetter: g.higherIsBetter,
    placeholder: g.placeholder,
    datedByResult: !!g.datedByResult,
    answersInput: g.answersInput || null,
  };
}

module.exports = { games, byId, publicInfo };

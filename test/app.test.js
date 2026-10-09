// Parser unit tests + API integration tests. Run with `npm test`.
const { test } = require('node:test');
const assert = require('node:assert');
const rngdle = require('../server/games/rngdle');
const krillion = require('../server/games/krillion');
const { openDb } = require('../server/db');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp, serveStatic } = require('../server/app');

const SAMPLE = `RNGdle 🎲 650,000

🟥 MYTHIC • Top 1%

🟥 🦴 Semi-Eon
🟪 🏛️ Epoch
🟦 🌌 Deep Void (4)
+19 more

"the void stares back"

10,069,608 EP
https://rngdle.com`;

// ---------- parser ----------

test('parses a full share', () => {
  const { score, details } = rngdle.parse(SAMPLE);
  assert.strictEqual(score, 10069608);
  assert.strictEqual(details.number, '650,000');
  assert.strictEqual(details.tier, 'MYTHIC');
  assert.strictEqual(details.percentile, 'Top 1%');
  assert.strictEqual(details.badges.length, 3);
  assert.deepStrictEqual(details.badges[0], { tier: 'MYTHIC', text: '🦴 Semi-Eon' });
  assert.strictEqual(details.badgeCount, 22);
});

test('parses a minimal share with no badges or percentile', () => {
  const { score, details } = rngdle.parse('RNGdle 🎲 12\n\n⬜ COMMON\n\n\n140 EP\nhttps://rngdle.com');
  assert.strictEqual(score, 140);
  assert.strictEqual(details.tier, 'COMMON');
  assert.strictEqual(details.percentile, null);
  assert.strictEqual(details.badgeCount, 0);
});

test('does not mistake UNCOMMON for COMMON', () => {
  const { details } = rngdle.parse('RNGdle 🎲 7\n\n🟩 UNCOMMON • Bottom 5%\n\n🟩 ✨ Lucky\n\n900 EP');
  assert.strictEqual(details.tier, 'UNCOMMON');
  assert.strictEqual(details.percentile, 'Bottom 5%');
  assert.strictEqual(details.badgeCount, 1);
});

test('handles CRLF and surrounding junk', () => {
  const { score } = rngdle.parse(`hey look\r\n${SAMPLE.replace(/\n/g, '\r\n')}\r\n`);
  assert.strictEqual(score, 10069608);
});

test('rejects non-RNGdle text', () => {
  assert.throws(() => rngdle.parse('Wordle 1,234 3/6'), /RNGdle/);
  assert.throws(() => rngdle.parse('RNGdle 🎲 5\n\nno score here'), /EP/);
});

// ---------- Krillion parser ----------

test('parses a Krillion daily share and dates it from the dive number', () => {
  const r = krillion.parse('Krillion #85 🦐\n420\n\n🫧🐟🦑⬛🏮🌟🤡\n\nhttps://krillion.io');
  assert.strictEqual(r.score, 420);
  assert.strictEqual(r.date, '2026-10-08');
  assert.strictEqual(r.details.dive, 85);
  assert.deepStrictEqual(r.details.tiles, ['plankton', 'schooler', 'rare', 'miss', 'deepcut', 'krillion', 'tooclever']);
  assert.strictEqual(krillion.parse('Krillion #1 🦐\n0\n\n⬛⬛⬛⬛⬛⬛⬛').date, '2026-07-16');
});

test('rejects non-daily Krillion shares and bad scores', () => {
  assert.throws(() => krillion.parse('Krillion ⟲ #12 🦐\n300\n\n🫧🫧🫧🫧🫧🫧🫧'), /daily dive/);
  assert.throws(() => krillion.parse('Krillion ∞ #3 🦐\n300\n\n🫧🫧🫧🫧🫧🫧🫧'), /daily dive/);
  assert.throws(() => krillion.parse('Krillion #85 🦐\n9000\n\n🌟🌟🌟🌟🌟🌟🌟'), /700/);
  assert.throws(() => krillion.parse('Krillion #85 🦐\n\n🌟🌟'), /score/);
  assert.throws(() => krillion.parse(SAMPLE), /Krillion/);
});

// ---------- API ----------

// A fetch wrapper that keeps its own session cookie, like a separate browser.
function client(base) {
  let cookie = '';
  return async function req(method, path, body) {
    const res = await fetch(base + path, {
      method,
      headers: {
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...(cookie && { Cookie: cookie }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const set = res.headers.getSetCookie();
    if (set.length) cookie = set.map((c) => c.split(';')[0]).join('; ');
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };
}

const today = new Date().toISOString().slice(0, 10);

test('full flow: accounts, groups, results, leaderboards', async () => {
  const db = openDb(':memory:');
  // Stand-in for the built React app, to check the SPA fallback.
  const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'dsl-dist-'));
  fs.writeFileSync(path.join(dist, 'index.html'), '<div id="root"></div>');
  const server = createApp(db, { frontend: serveStatic(dist) }).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://localhost:${server.address().port}`;
  try {
    const alice = client(base);
    const bob = client(base);
    const carol = client(base);

    assert.strictEqual((await alice('POST', '/api/signup', { username: 'alice', password: 'short' })).status, 400);
    assert.strictEqual((await alice('POST', '/api/signup', { username: 'alice', password: 'password1' })).status, 200);
    assert.strictEqual((await bob('POST', '/api/signup', { username: 'ALICE', password: 'password1' })).status, 409);
    assert.strictEqual((await bob('POST', '/api/signup', { username: 'bob', password: 'password2' })).status, 200);
    assert.strictEqual((await carol('POST', '/api/signup', { username: 'carol', password: 'password3' })).status, 200);

    // login/logout
    assert.strictEqual((await carol('POST', '/api/logout', {})).status, 200);
    assert.strictEqual((await carol('GET', '/api/me')).body.user, null);
    assert.strictEqual((await carol('POST', '/api/login', { username: 'carol', password: 'nope' })).status, 401);
    assert.strictEqual((await carol('POST', '/api/login', { username: 'carol', password: 'password3' })).status, 200);
    assert.strictEqual((await carol('GET', '/api/me')).body.user.username, 'carol');

    // group: alice creates, bob joins, carol doesn't
    const g = (await alice('POST', '/api/groups', { name: 'Rollers' })).body.group;
    assert.ok(g.invite_code);
    assert.strictEqual((await bob('POST', '/api/groups/join', { code: g.invite_code.toLowerCase() })).status, 200);
    assert.strictEqual((await carol('GET', `/api/groups/${g.id}`)).status, 404);
    assert.strictEqual((await alice('GET', `/api/groups/${g.id}`)).body.members.length, 2);

    // results: any present/past day, once per game per day
    const sub = (c, ep, date = today) => c('POST', '/api/results', { game: 'rngdle', date, text: `RNGdle 🎲 1\n\n⬜ COMMON\n\n${ep} EP` });
    assert.strictEqual((await alice('GET', `/api/results/mine?game=rngdle&date=${today}`)).body.result, null);
    assert.strictEqual((await alice('POST', '/api/results', { game: 'rngdle', date: today, text: 'garbage' })).status, 400);
    assert.strictEqual((await alice('POST', '/api/results', { game: 'nope', date: today, text: SAMPLE })).status, 400);
    assert.strictEqual((await sub(alice, 300)).status, 200);
    const again = await sub(alice, 100);
    assert.strictEqual(again.status, 409);
    assert.match(again.body.error, /already submitted/);
    assert.strictEqual((await alice('GET', `/api/results/mine?game=rngdle&date=${today}`)).body.result.score, 300);
    assert.strictEqual((await sub(bob, 200)).status, 200);
    assert.strictEqual((await sub(carol, 999)).status, 200);
    assert.strictEqual((await sub(bob, 1, '2999-01-01')).status, 400);
    assert.strictEqual((await sub(bob, 1, '2026-02-31')).status, 400); // not a real date
    assert.strictEqual((await sub(bob, 1, 'yesterday')).status, 400);
    // past days are allowed, but each day only once
    assert.strictEqual((await sub(alice, 50, '2026-01-01')).status, 200);
    assert.strictEqual((await sub(alice, 999, '2026-01-01')).status, 409);
    assert.strictEqual((await alice('GET', '/api/results/mine?game=rngdle&date=2026-01-01')).body.result.score, 50);
    assert.strictEqual((await alice('GET', '/api/results/mine?game=rngdle&date=2025-06-01')).body.result, null);

    // results can't be deleted or overwritten
    const prof = (await alice('GET', '/api/users/alice')).body;
    assert.strictEqual((await alice('DELETE', `/api/results/${prof.results[0].id}`, {})).status, 404);
    assert.strictEqual((await alice('GET', '/api/users/alice')).body.results.length, 2);

    // leaderboards are per group only
    assert.strictEqual((await alice('GET', `/api/leaderboard?game=rngdle&from=${today}&to=${today}`)).status, 400);
    let lb = (await alice('GET', `/api/leaderboard?game=rngdle&group=${g.id}&from=${today}&to=${today}`)).body;
    assert.deepStrictEqual(lb.rows.map((r) => [r.username, r.total]), [['alice', 300], ['bob', 200]]); // no carol
    assert.strictEqual(lb.rows[0].result.details.tier, 'COMMON');
    lb = (await bob('GET', `/api/leaderboard?game=rngdle&group=${g.id}`)).body;
    assert.deepStrictEqual(lb.rows.map((r) => [r.username, r.total, r.days, r.best, r.average]),
      [['alice', 350, 2, 300, 175], ['bob', 200, 1, 200, 200]]);
    assert.strictEqual((await carol('GET', `/api/leaderboard?game=rngdle&group=${g.id}`)).status, 404);

    // feed is per group; profiles only visible to group-mates
    assert.strictEqual((await alice('GET', '/api/feed')).status, 400);
    assert.deepStrictEqual((await alice('GET', `/api/feed?group=${g.id}`)).body.results.map((r) => r.username).sort(),
      ['alice', 'alice', 'bob']);
    assert.strictEqual((await carol('GET', `/api/feed?group=${g.id}`)).status, 404);
    assert.strictEqual((await bob('GET', '/api/users/alice')).status, 200);
    assert.strictEqual((await carol('GET', '/api/users/alice')).status, 404);
    assert.strictEqual((await carol('GET', '/api/users/carol')).status, 200);

    // Krillion: the date comes from the dive number, whatever date the client sends
    const kr = (c, dive, pts) => c('POST', '/api/results', {
      game: 'krillion', date: '1999-01-01', text: `Krillion #${dive} 🦐\n${pts}\n\n🫧🐟🦑⬛🏮🌟🤡`,
    });
    let res = await kr(alice, 80, 410);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.date, '2026-10-03');
    assert.strictEqual((await kr(alice, 80, 999 - 300)).status, 409); // same dive again
    assert.strictEqual((await kr(bob, 80, 520)).status, 200);
    assert.strictEqual((await kr(bob, 99999, 100)).status, 400); // future dive
    const pv = (await alice('POST', '/api/results/preview', { game: 'krillion', text: 'Krillion #81 🦐\n5\n\n⬛' })).body;
    assert.strictEqual(pv.date, '2026-10-04');

    // each game has its own leaderboard within the group
    lb = (await alice('GET', `/api/leaderboard?game=krillion&group=${g.id}`)).body;
    assert.deepStrictEqual(lb.rows.map((r) => [r.username, r.total]), [['bob', 520], ['alice', 410]]);
    lb = (await alice('GET', `/api/leaderboard?game=rngdle&group=${g.id}`)).body;
    assert.deepStrictEqual(lb.rows.map((r) => [r.username, r.total]), [['alice', 350], ['bob', 200]]);
    assert.strictEqual((await alice('GET', '/api/games')).body.games.find((x) => x.id === 'krillion').datedByResult, true);

    // leaving: last member out deletes the group
    await bob('POST', `/api/groups/${g.id}/leave`, {});
    await alice('POST', `/api/groups/${g.id}/leave`, {});
    assert.strictEqual(db.prepare('SELECT COUNT(*) n FROM groups').get().n, 0);

    // CSRF guard: non-JSON POSTs are rejected
    const form = await fetch(`${base}/api/groups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'name=x',
    });
    assert.strictEqual(form.status, 415);

    // SPA fallback still serves the frontend for client-side routes
    assert.match(await (await fetch(`${base}/groups/1`)).text(), /<div id="root">/);
    // ...but unknown API routes are still JSON 404s
    assert.strictEqual((await fetch(`${base}/api/nope`)).status, 404);
  } finally {
    server.close();
    fs.rmSync(dist, { recursive: true, force: true });
  }
});

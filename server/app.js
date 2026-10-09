const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const gamesRegistry = require('./games');
const { transaction } = require('./db');

const SESSION_COOKIE = 'sid';
const SESSION_MAX_AGE_DAYS = 60;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ---------- helpers ----------

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

function parseCookies(header) {
  const out = {};
  (header || '').split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

function inviteCode() {
  // Unambiguous characters only.
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (const b of crypto.randomBytes(8)) code += alphabet[b % alphabet.length];
  return code;
}

function utcDate(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return d.toISOString().slice(0, 10);
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Wrap sync route handlers so thrown HttpErrors become JSON responses.
const h = (fn) => (req, res, next) => {
  try {
    const out = fn(req, res);
    if (out !== undefined) res.json(out);
  } catch (err) {
    next(err);
  }
};

// ---------- app ----------

// Serve a built single-page app from `dir`, falling back to index.html for client-side routes.
function serveStatic(dir) {
  return (app) => {
    app.use(express.static(dir));
    app.get('/{*splat}', (req, res) => res.sendFile(path.join(dir, 'index.html')));
  };
}

/**
 * Build the Express app. `frontend(app)` is called after the API routes are mounted so it can
 * add whatever serves the UI (built files in production, Vite middleware in development).
 */
function createApp(db, { frontend } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '20kb' }));
  // Express 5 leaves req.body undefined when there is no body.
  app.use((req, res, next) => {
    req.body ??= {};
    next();
  });

  // CSRF guard: state-changing API requests must be JSON (cross-site forms can't send that
  // without a CORS preflight, which we never grant). Combined with SameSite=Lax cookies.
  app.use('/api', (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD' && !req.is('application/json')) {
      return res.status(415).json({ error: 'Expected application/json' });
    }
    next();
  });

  const q = {
    userByName: db.prepare('SELECT * FROM users WHERE username = ?'),
    insertUser: db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)'),
    insertSession: db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)'),
    sessionUser: db.prepare(`
      SELECT u.id, u.username FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token = ? AND s.created_at > datetime('now', ?)`),
    deleteSession: db.prepare('DELETE FROM sessions WHERE token = ?'),

    insertGroup: db.prepare('INSERT INTO groups (name, invite_code, owner_id) VALUES (?, ?, ?)'),
    groupById: db.prepare('SELECT * FROM groups WHERE id = ?'),
    groupByCode: db.prepare('SELECT * FROM groups WHERE invite_code = ?'),
    addMember: db.prepare('INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)'),
    removeMember: db.prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?'),
    isMember: db.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?'),
    myGroups: db.prepare(`
      SELECT g.id, g.name, g.invite_code, g.owner_id,
             (SELECT COUNT(*) FROM group_members m2 WHERE m2.group_id = g.id) AS member_count
      FROM groups g JOIN group_members m ON m.group_id = g.id
      WHERE m.user_id = ? ORDER BY g.name COLLATE NOCASE`),
    groupMembers: db.prepare(`
      SELECT u.id, u.username, m.joined_at FROM group_members m JOIN users u ON u.id = m.user_id
      WHERE m.group_id = ? ORDER BY u.username COLLATE NOCASE`),
    deleteGroup: db.prepare('DELETE FROM groups WHERE id = ?'),
    memberCount: db.prepare('SELECT COUNT(*) AS n FROM group_members WHERE group_id = ?'),

    // Results are write-once: no upsert, no delete.
    insertResult: db.prepare(`
      INSERT INTO results (user_id, game, play_date, score, details, raw_text)
      VALUES (@user_id, @game, @play_date, @score, @details, @raw_text)`),
    resultFor: db.prepare('SELECT * FROM results WHERE user_id = ? AND game = ? AND play_date = ?'),
    sharesGroup: db.prepare(`
      SELECT 1 FROM group_members a JOIN group_members b ON a.group_id = b.group_id
      WHERE a.user_id = ? AND b.user_id = ? LIMIT 1`),
    userResults: db.prepare(`
      SELECT r.id, r.game, r.play_date, r.score, r.details, r.created_at
      FROM results r WHERE r.user_id = ? AND (@game IS NULL OR r.game = @game)
      ORDER BY r.play_date DESC LIMIT 365`),
  };

  // Attach the logged-in user (if any).
  app.use((req, res, next) => {
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    req.user = token ? q.sessionUser.get(token, `-${SESSION_MAX_AGE_DAYS} days`) || null : null;
    req.sessionToken = token;
    next();
  });

  function requireUser(req) {
    if (!req.user) throw new HttpError(401, 'Please log in first.');
    return req.user;
  }

  function requireGame(id) {
    const game = gamesRegistry.byId[id];
    if (!game) throw new HttpError(400, `Unknown game "${id}".`);
    return game;
  }

  function requireMembership(req, groupId) {
    const user = requireUser(req);
    const group = q.groupById.get(groupId);
    if (!group || !q.isMember.get(group.id, user.id)) throw new HttpError(404, 'Group not found.');
    return group;
  }

  function startSession(res, userId) {
    const token = crypto.randomBytes(32).toString('hex');
    q.insertSession.run(token, userId);
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: SESSION_MAX_AGE_DAYS * 86400000,
    });
  }

  function formatResult(row, game) {
    const details = JSON.parse(row.details);
    return {
      id: row.id,
      game: row.game,
      date: row.play_date,
      score: row.score,
      details,
      summary: game ? game.summarize(details) : '',
      username: row.username,
      createdAt: row.created_at,
    };
  }

  // ---------- auth ----------

  app.get('/api/me', h((req) => ({ user: req.user })));

  app.post('/api/signup', h((req, res) => {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');
    if (!/^[A-Za-z0-9_.-]{3,24}$/.test(username)) {
      throw new HttpError(400, 'Username must be 3–24 characters: letters, numbers, _ . -');
    }
    if (password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters.');
    if (q.userByName.get(username)) throw new HttpError(409, 'That username is taken.');
    const info = q.insertUser.run(username, hashPassword(password));
    startSession(res, info.lastInsertRowid);
    return { user: { id: Number(info.lastInsertRowid), username } };
  }));

  app.post('/api/login', h((req, res) => {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');
    const user = q.userByName.get(username);
    if (!user || !verifyPassword(password, user.password_hash)) {
      throw new HttpError(401, 'Wrong username or password.');
    }
    startSession(res, user.id);
    return { user: { id: user.id, username: user.username } };
  }));

  app.post('/api/logout', h((req, res) => {
    if (req.sessionToken) q.deleteSession.run(req.sessionToken);
    res.clearCookie(SESSION_COOKIE);
    return { ok: true };
  }));

  // ---------- games ----------

  app.get('/api/games', h(() => ({ games: gamesRegistry.games.map(gamesRegistry.publicInfo) })));

  // ---------- groups ----------

  app.get('/api/groups', h((req) => {
    const user = requireUser(req);
    return { groups: q.myGroups.all(user.id) };
  }));

  app.post('/api/groups', h((req) => {
    const user = requireUser(req);
    const name = String(req.body.name || '').trim();
    if (name.length < 1 || name.length > 40) throw new HttpError(400, 'Group name must be 1–40 characters.');
    const group = transaction(db, () => {
      let code;
      do code = inviteCode(); while (q.groupByCode.get(code));
      const info = q.insertGroup.run(name, code, user.id);
      q.addMember.run(info.lastInsertRowid, user.id);
      return q.groupById.get(info.lastInsertRowid);
    });
    return { group };
  }));

  app.post('/api/groups/join', h((req) => {
    const user = requireUser(req);
    const code = String(req.body.code || '').trim().toUpperCase();
    const group = q.groupByCode.get(code);
    if (!group) throw new HttpError(404, 'No group with that invite code.');
    q.addMember.run(group.id, user.id);
    return { group };
  }));

  app.get('/api/groups/:id', h((req) => {
    const group = requireMembership(req, req.params.id);
    return { group, members: q.groupMembers.all(group.id) };
  }));

  app.post('/api/groups/:id/leave', h((req) => {
    const group = requireMembership(req, req.params.id);
    transaction(db, () => {
      q.removeMember.run(group.id, req.user.id);
      if (q.memberCount.get(group.id).n === 0) q.deleteGroup.run(group.id);
    });
    return { ok: true };
  }));

  // ---------- results ----------

  app.post('/api/results/preview', h((req) => {
    const game = requireGame(req.body.game);
    let parsed;
    try {
      parsed = game.parse(req.body.text);
    } catch (err) {
      throw new HttpError(400, err.message);
    }
    return {
      score: parsed.score,
      date: parsed.date || null,
      details: parsed.details,
      summary: game.summarize(parsed.details),
    };
  }));

  // Results can be posted for any real date up to the player's today. The upper bound is
  // UTC+1 day so players ahead of UTC can still submit their local "today".
  function requirePlayableDate(dateParam) {
    const date = String(dateParam || '');
    const parsed = new Date(`${date}T00:00:00Z`);
    if (!DATE_RE.test(date) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
      throw new HttpError(400, 'Invalid date.');
    }
    if (date > utcDate(1)) throw new HttpError(400, "You can't submit a result for a future day.");
    return date;
  }

  // The logged-in user's result for a game on a given day, if they've submitted one.
  app.get('/api/results/mine', h((req) => {
    const user = requireUser(req);
    const game = requireGame(req.query.game);
    const row = q.resultFor.get(user.id, game.id, requirePlayableDate(req.query.date));
    return { result: row ? formatResult({ ...row, username: user.username }, game) : null };
  }));

  app.post('/api/results', h((req) => {
    const user = requireUser(req);
    const game = requireGame(req.body.game);
    const text = String(req.body.text || '');
    let parsed;
    try {
      parsed = game.parse(text);
    } catch (err) {
      throw new HttpError(400, err.message);
    }
    // Some games' share text says which day it was; that beats whatever date was sent.
    const date = requirePlayableDate(parsed.date || req.body.date);
    const alreadySubmitted = () =>
      new HttpError(409, `You've already submitted ${game.name} for ${date}. Results can't be changed.`);
    if (q.resultFor.get(user.id, game.id, date)) throw alreadySubmitted();

    try {
      q.insertResult.run({
        user_id: user.id,
        game: game.id,
        play_date: date,
        score: parsed.score,
        details: JSON.stringify(parsed.details),
        raw_text: text.slice(0, 4000),
      });
    } catch (err) {
      // Lost a race with a concurrent submit for the same day.
      if (/UNIQUE constraint/.test(err.message)) throw alreadySubmitted();
      throw err;
    }
    return { ok: true, date, score: parsed.score, summary: game.summarize(parsed.details) };
  }));

  // Profiles are visible to yourself and to people you share a group with.
  app.get('/api/users/:username', h((req) => {
    const me = requireUser(req);
    const user = q.userByName.get(req.params.username);
    if (!user || (user.id !== me.id && !q.sharesGroup.get(me.id, user.id))) {
      throw new HttpError(404, 'User not found.');
    }
    const game = req.query.game ? requireGame(req.query.game).id : null;
    const rows = q.userResults.all({ game }, user.id);
    return {
      user: { id: user.id, username: user.username, createdAt: user.created_at },
      results: rows.map((r) => formatResult(r, gamesRegistry.byId[r.game])),
    };
  }));

  // Leaderboard for one group: aggregate members' scores over a date range.
  app.get('/api/leaderboard', h((req) => {
    const game = requireGame(req.query.game || 'rngdle');
    const from = String(req.query.from || '0000-01-01');
    const to = String(req.query.to || '9999-12-31');
    if (!DATE_RE.test(from) || !DATE_RE.test(to)) throw new HttpError(400, 'Invalid date range.');
    if (!req.query.group) throw new HttpError(400, 'Pick a group.');
    const groupId = requireMembership(req, req.query.group).id;

    const rows = db.prepare(`
      SELECT u.username,
             COUNT(*)          AS days,
             SUM(r.score)      AS total,
             AVG(r.score)      AS average,
             ${game.higherIsBetter ? 'MAX' : 'MIN'}(r.score) AS best
      FROM results r
      JOIN users u ON u.id = r.user_id
      JOIN group_members m ON m.user_id = r.user_id AND m.group_id = @groupId
      WHERE r.game = @game AND r.play_date BETWEEN @from AND @to
      GROUP BY r.user_id
      ORDER BY total ${game.higherIsBetter ? 'DESC' : 'ASC'}, u.username COLLATE NOCASE
      LIMIT 500`).all({ game: game.id, from, to, groupId });

    // For single-day boards include each player's result details.
    let dayResults = null;
    if (from === to) {
      dayResults = {};
      db.prepare(`
        SELECT r.*, u.username FROM results r
        JOIN users u ON u.id = r.user_id
        JOIN group_members m ON m.user_id = r.user_id AND m.group_id = ?
        WHERE r.game = ? AND r.play_date = ?`).all(groupId, game.id, from)
        .forEach((r) => { dayResults[r.username] = formatResult(r, game); });
    }

    return {
      game: gamesRegistry.publicInfo(game),
      from,
      to,
      rows: rows.map((r) => ({
        ...r,
        average: Math.round(r.average),
        result: dayResults ? dayResults[r.username] : undefined,
      })),
    };
  }));

  // Recent submissions from members of one group.
  app.get('/api/feed', h((req) => {
    if (!req.query.group) throw new HttpError(400, 'Pick a group.');
    const groupId = requireMembership(req, req.query.group).id;
    const rows = db.prepare(`
      SELECT r.*, u.username FROM results r
      JOIN users u ON u.id = r.user_id
      JOIN group_members m ON m.user_id = r.user_id AND m.group_id = ?
      ORDER BY r.created_at DESC, r.id DESC LIMIT 20`).all(groupId);
    return { results: rows.map((r) => formatResult(r, gamesRegistry.byId[r.game])) };
  }));

  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

  // ---------- frontend ----------

  if (frontend) frontend(app);

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON.' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request too large.' });
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  });

  return app;
}

module.exports = { createApp, serveStatic };

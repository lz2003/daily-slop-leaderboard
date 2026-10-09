# daily-slop-leaderboard

Leaderboard for daily slop. This is hella vibe coded. 

Make an account, paste your daily game result, and compare scores within your friend groups.

Supported games:
- [RNGdle](https://www.rngdle.com/) — score = total EP. Players pick the day they played.
- [Krillion](https://krillion.io/) — score = dive points (max 700). The day comes from the dive number in the share text; only daily dives count (not archive, unlimited or themed packs). Players can optionally paste their answers too (the "the catch" list from the results page); they're checked against the share's tiles, and other players' answers stay hidden until the dive is over or you've submitted that dive yourself.

## Running

Needs Node 26+ (`nvm use` picks up `.nvmrc`). The database uses Node's built-in `node:sqlite`, so there are no native modules to compile.

```bash
npm install
npm run dev        # http://localhost:3000 — API + React app with hot reload
npm start          # builds the React app into dist/ and serves it
npm test
```

Data lives in SQLite at `data/leaderboard.db` (override with `DB_FILE`, port with `PORT`). Delete `data/` to reset.

## Features

- **Accounts**: username + password (scrypt-hashed), httpOnly session cookie.
- **Submitting**: hit *Share* in the game, paste the text. It's parsed and previewed live. Pick the day you played (today or any past day, never a future one). Each game can have **one result per day**, and results can't be edited or deleted.
- **Groups**: create a group, share the invite code or link. The last member to leave deletes the group.
- **Leaderboards are per group, per game** (switch games with the tabs): Today / Yesterday / 7 days / 30 days / All time, showing only that group's members. Multi-day views can be ranked by total, average, best, or days played. There is no global leaderboard.
- **Profiles**: history, streak, best/average/total — visible to yourself and people you share a group with.

## Layout

```
server/
  index.js           entry point (Vite middleware with --dev, otherwise serves dist/)
  app.js             Express app + JSON API
  db.js              SQLite schema (node:sqlite)
  games/             one module per game (parser + metadata)
client/              React app (Vite)
  src/
    main.jsx         entry: router + providers
    App.jsx          routes
    AppContext.jsx   logged-in user, games, groups, leaderboard prefs
    api.js           fetch wrapper; useApi.js fetch-on-render hook
    pages/           one component per page (Home, Auth, Submit, Groups, Group, Join, Profile, NotFound)
    components/      shared pieces (NavBar, Leaderboard + tables, Feed, ResultPreview, Toast, …)
test/app.test.js     parser + API tests (node:test)
```

## Adding a game

Create `server/games/<id>.js` exporting `{ id, name, url, scoreLabel, higherIsBetter, placeholder, parse(text), summarize(details) }`, where `parse` returns `{ score, details }` or throws a friendly error, and add it to `server/games/index.js`. If the share text identifies the day, also return `date` from `parse` and set `datedByResult: true`. To accept a second pasted text (like Krillion's answers), describe it in `answersInput`; `parse(text, { answers })` receives it. On the client, add the game's display pieces (`ResultCell`, `Preview`, `feedNote`) to `client/src/games.jsx`; game tabs appear automatically.

const path = require('node:path');
const fs = require('node:fs');
const { openDb } = require('./db');
const { createApp, serveStatic } = require('./app');

const PORT = Number(process.env.PORT) || 3000;
const DB_FILE = process.env.DB_FILE || path.join(__dirname, '..', 'data', 'leaderboard.db');
const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const DEV = process.argv.includes('--dev');

// In development, Vite serves the React app with hot reloading from inside this server.
async function viteFrontend() {
  const { createServer } = await import('vite');
  const vite = await createServer({
    configFile: path.join(ROOT, 'vite.config.js'),
    server: { middlewareMode: true },
    appType: 'spa',
  });
  return (app) => app.use(vite.middlewares);
}

async function main() {
  let frontend;
  if (DEV) {
    frontend = await viteFrontend();
  } else if (fs.existsSync(path.join(DIST, 'index.html'))) {
    frontend = serveStatic(DIST);
  } else {
    console.warn('No built frontend in dist/ — run `npm run build`, or use `npm run dev`.');
  }

  const app = createApp(openDb(DB_FILE), { frontend });
  app.listen(PORT, () => {
    console.log(`Daily Slop Leaderboard running at http://localhost:${PORT}${DEV ? ' (dev)' : ''}`);
  });
}

main();

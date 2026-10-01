import { createApp } from './app.mjs';

const [major] = process.versions.node.split('.').map(Number);
if (major < 22) {
  console.error('Node.js 22 ou plus récent est requis pour la base SQLite intégrée.');
  process.exit(1);
}

const port = Number(process.env.PORT ?? 8080);
const databasePath = process.env.DATABASE_PATH ?? 'data/planning.sqlite';
const staticDir = process.env.STATIC_DIR || null;

const app = createApp({ databasePath, staticDir });

app.server.listen(port, '0.0.0.0', () => {
  console.log(`Planning Pro écoute sur http://127.0.0.1:${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    void app.close().then(
      () => process.exit(0),
      () => process.exit(1),
    );
  });
}

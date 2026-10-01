import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { openDatabase, readState, writeState } from './database.mjs';
import { validateState } from './validate.mjs';

const MAX_BODY_BYTES = 1_000_000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json',
};

/**
 * API HTTP + fichiers statiques éventuels. Une seule ligne SQLite garde
 * l'état complet, le même quel que soit le port du navigateur.
 */
export function createApp({ databasePath, staticDir = null }) {
  const database = openDatabase(databasePath);
  const server = createServer((request, response) => {
    void handleRequest(request, response, database, staticDir).catch((error) => {
      if (response.headersSent) {
        response.destroy();
        return;
      }
      const status = error.statusCode ?? 500;
      sendJson(response, request, status, { error: 'Erreur interne.' });
    });
  });

  return {
    server,
    close() {
      return new Promise((resolveClose, rejectClose) => {
        server.close((error) => {
          database.close();
          if (error) {
            rejectClose(error);
          } else {
            resolveClose();
          }
        });
      });
    },
  };
}

async function handleRequest(request, response, database, staticDir) {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1');
  const { pathname } = url;

  if (request.method === 'OPTIONS' && pathname.startsWith('/api/')) {
    response.writeHead(204, corsHeaders(request));
    response.end();
    return;
  }

  if (pathname === '/api/health' && request.method === 'GET') {
    sendJson(response, request, 200, { ok: true });
    return;
  }

  if (pathname === '/api/state' && request.method === 'GET') {
    sendJson(response, request, 200, { state: readState(database) });
    return;
  }

  if (pathname === '/api/state' && request.method === 'PUT') {
    const raw = await readBody(request);
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      sendJson(response, request, 400, { error: 'JSON invalide.' });
      return;
    }
    const result = validateState(parsed);
    if (!result.ok) {
      sendJson(response, request, 400, { error: result.error });
      return;
    }
    writeState(database, parsed);
    sendJson(response, request, 200, { ok: true });
    return;
  }

  if (pathname.startsWith('/api/')) {
    sendJson(response, request, 404, { error: 'Introuvable.' });
    return;
  }

  if (request.method === 'GET' && staticDir) {
    serveStatic(request, response, staticDir, pathname);
    return;
  }

  sendJson(response, request, 404, { error: 'Introuvable.' });
}

function serveStatic(request, response, staticDir, pathname) {
  const filePath = resolveInside(staticDir, pathname);
  if (filePath && existsSync(filePath) && statSync(filePath).isFile()) {
    sendFile(response, request, filePath);
    return;
  }

  const extension = extname(pathname);
  const indexPath = resolve(staticDir, 'index.html');
  if (!extension && existsSync(indexPath)) {
    sendFile(response, request, indexPath);
    return;
  }

  sendJson(response, request, 404, { error: 'Introuvable.' });
}

function sendFile(response, request, filePath) {
  const type = MIME_TYPES[extname(filePath)] ?? 'application/octet-stream';
  response.writeHead(200, {
    'content-type': type,
    'cache-control': extname(filePath) === '.html' ? 'no-cache' : 'public, max-age=3600',
    ...corsHeaders(request),
  });
  createReadStream(filePath).pipe(response);
}

function resolveInside(root, urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  const full = resolve(root, `.${decoded}`);
  const base = resolve(root);
  if (full !== base && !full.startsWith(`${base}${sep}`)) {
    return null;
  }
  return full;
}

function readBody(request) {
  return new Promise((resolveBody, rejectBody) => {
    const chunks = [];
    let size = 0;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        const error = new Error('Corps trop volumineux.');
        error.statusCode = 413;
        rejectBody(error);
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolveBody(Buffer.concat(chunks).toString('utf8')));
    request.on('error', rejectBody);
  });
}

function sendJson(response, request, status, body) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(payload),
    ...corsHeaders(request),
  });
  response.end(payload);
}

function corsHeaders(request) {
  const origin = request.headers.origin;
  if (!isLocalOrigin(origin)) {
    return { vary: 'Origin' };
  }
  return {
    vary: 'Origin',
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET, PUT, OPTIONS',
    'access-control-allow-headers': 'content-type',
  };
}

function isLocalOrigin(origin) {
  if (!origin) {
    return false;
  }
  try {
    const url = new URL(origin);
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
    );
  } catch {
    return false;
  }
}

import * as path from 'path';
import { pathToFileURL } from 'url';

// CRITICAL: Must run at import time (module top-level) before app.ready fires.
// Electron requires registerSchemesAsPrivileged to be called before app.whenReady().
// Guard against non-Electron environments (e.g., vitest running in Node.js).
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { protocol } = require('electron') as typeof import('electron');
  if (protocol && protocol.registerSchemesAsPrivileged) {
    protocol.registerSchemesAsPrivileged([
      {
        scheme: 'animecix-library',
        privileges: {
          standard: true,
          secure: true,
          supportFetchAPI: true,
          bypassCSP: true,
          // No stream: true — library serves static HTML/JS/CSS assets, not video
        },
      },
    ]);
  }
} catch {
  // Not running in Electron — skip scheme registration (e.g., in tests)
}

/**
 * Resolves a URL pathname to a safe absolute filesystem path within basePath.
 * Returns null if the resolved path would escape basePath (path traversal protection).
 */
export function resolveAssetPath(pathname: string, basePath: string): string | null {
  // Decode URL-encoded characters (handles %2F etc.)
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  // Map root or empty to index.html
  if (decoded === '/' || decoded === '') {
    decoded = '/index.html';
  }

  const resolvedBase = path.resolve(basePath);
  const joined = path.join(resolvedBase, decoded);
  const resolved = path.resolve(joined);

  // Path traversal check: resolved path must start with resolvedBase
  if (!resolved.startsWith(resolvedBase + path.sep) && resolved !== resolvedBase) {
    return null;
  }

  return resolved;
}

/**
 * Returns the MIME type for a given file extension.
 */
export function getMimeType(ext: string): string {
  const mimeTypes: Record<string, string> = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.wasm': 'application/wasm',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
    '.ttf': 'font/ttf',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
  };
  return mimeTypes[ext] ?? 'application/octet-stream';
}

/**
 * Registers the animecix-library:// protocol handler.
 * Must be called after app.whenReady().
 *
 * Serves two hostnames:
 *   - animecix-library://bundle/  — library SPA assets from assets/library
 *   - animecix-library://posters/ — poster images from userData/posters
 *
 * Path resolution handles both dev and packaged modes:
 *   - Dev: app.getAppPath() = project root, library assets at <root>/assets/library/
 *   - Prod: process.resourcesPath = resources dir, extraResource at <resources>/library/
 */
export function registerLibraryProtocol(): void {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { protocol, net, app } = require('electron') as typeof import('electron');

  // In development: assets/library/ is relative to project root (app.getAppPath())
  // In production (packaged): extraResource places library/ alongside the asar in resources dir
  const basePath = app.isPackaged
    ? path.join(process.resourcesPath, 'library')
    : path.join(app.getAppPath(), 'assets', 'library');

  // Poster images are stored in userData/posters (alongside the SQLite DB)
  const postersDir = path.join(app.getPath('userData'), 'posters');

  protocol.handle('animecix-library', async (request) => {
    const url = new URL(request.url);
    const hostname = url.hostname;
    const pathname = url.pathname;

    if (hostname === 'posters') {
      // Serve poster images from userData/posters with path traversal protection
      const filePath = resolveAssetPath(pathname, postersDir);
      if (filePath === null) {
        return new Response('Forbidden', { status: 403 });
      }

      const ext = path.extname(filePath);
      const mimeType = getMimeType(ext);

      try {
        const fileUrl = pathToFileURL(filePath).toString();
        const response = await net.fetch(fileUrl);
        const body = await response.arrayBuffer();
        return new Response(body, {
          status: response.status,
          headers: { 'Content-Type': mimeType },
        });
      } catch {
        return new Response('Not Found', { status: 404 });
      }
    }

    if (hostname === 'bundle') {
      // Serve library SPA assets from basePath with path traversal protection
      let filePath = resolveAssetPath(pathname, basePath);
      if (filePath === null) {
        return new Response('Forbidden', { status: 403 });
      }

      let ext = path.extname(filePath);

      // SPA fallback: if file has no extension (route like /browse),
      // serve index.html so the React app handles client-side routing
      if (!ext) {
        filePath = path.join(path.resolve(basePath), 'index.html');
        ext = '.html';
      }

      const mimeType = getMimeType(ext);

      try {
        const fileUrl = pathToFileURL(filePath).toString();
        const response = await net.fetch(fileUrl);
        const body = await response.arrayBuffer();
        return new Response(body, {
          status: response.status,
          headers: { 'Content-Type': mimeType },
        });
      } catch {
        return new Response('Not Found', { status: 404 });
      }
    }

    // Unknown hostname — reject
    return new Response('Forbidden', { status: 403 });
  });
}

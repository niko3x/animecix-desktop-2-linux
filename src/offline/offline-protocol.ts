import * as path from 'path';
import * as fs from 'fs';

// CRITICAL: Must run at import time (module top-level) before app.ready fires.
// Electron requires registerSchemesAsPrivileged to be called before app.whenReady().
// Guard against non-Electron environments (e.g., vitest running in Node.js).
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { protocol } = require('electron') as typeof import('electron');
  if (protocol && protocol.registerSchemesAsPrivileged) {
    protocol.registerSchemesAsPrivileged([
      {
        scheme: 'animecix-offline',
        privileges: {
          standard: true,
          secure: true,
          supportFetchAPI: true,
          stream: true,    // REQUIRED for video streaming
          bypassCSP: true,
        },
      },
    ]);
  }
} catch {
  // Not running in Electron — skip scheme registration (e.g., in tests)
}

/**
 * Parsed representation of an animecix-offline:// URL.
 *
 * URL format:
 *   animecix-offline://episode/{episodeId}/video       -> MP4 file
 *   animecix-offline://episode/{episodeId}/sub/{lang}  -> ASS subtitle file
 */
export interface OfflineRequest {
  episodeId: string;
  type: 'video' | 'sub';
  language?: string; // only present when type === 'sub'
}

/**
 * Parses an animecix-offline:// URL into its component parts.
 * Returns null if the URL does not match the expected format.
 */
export function parseOfflineUrl(url: string): OfflineRequest | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  // pathname from new URL() will have a leading slash, e.g. /abc123/video
  // The host component (episode) ends up in parsed.hostname for custom schemes.
  // Full path: animecix-offline://episode/{episodeId}/video
  //   hostname = "episode"
  //   pathname = "/{episodeId}/video" or "/{episodeId}/sub/{lang}"

  if (parsed.hostname !== 'episode') {
    return null;
  }

  // Strip leading slash and split segments
  const segments = parsed.pathname.replace(/^\//, '').split('/').filter(Boolean);

  // Must have at least 2 segments: [episodeId, type]
  if (segments.length < 2) {
    return null;
  }

  const [episodeId, type, ...rest] = segments;

  if (!episodeId || !type) {
    return null;
  }

  if (type === 'video') {
    return { episodeId, type: 'video' };
  }

  if (type === 'sub') {
    // Must have exactly one more segment: the language code
    if (rest.length !== 1 || !rest[0]) {
      return null;
    }
    return { episodeId, type: 'sub', language: rest[0] };
  }

  return null;
}

/**
 * Resolves a relative path to an absolute path within basePath.
 * Returns null if the resolved path would escape basePath (path traversal protection).
 *
 * Mirrors resolveAssetPath from tau-protocol.ts.
 */
export function resolveOfflinePath(
  relativePath: string,
  basePath: string,
): string | null {
  // Decode URL-encoded characters (handles %2e%2e%2f / %2F etc.)
  let decoded: string;
  try {
    decoded = decodeURIComponent(relativePath);
  } catch {
    return null;
  }

  const resolvedBase = path.resolve(basePath);
  const joined = path.join(resolvedBase, decoded);
  const resolved = path.resolve(joined);

  // Path traversal check: resolved path must start with resolvedBase + sep
  // (or equal resolvedBase itself, to allow serving the directory listing if needed)
  if (!resolved.startsWith(resolvedBase + path.sep) && resolved !== resolvedBase) {
    return null;
  }

  return resolved;
}

/**
 * Returns the MIME type for a given file extension.
 */
export function getOfflineMimeType(ext: string): string {
  const mimeTypes: Record<string, string> = {
    '.mp4': 'video/mp4',
    '.ts': 'video/mp2t',
    '.ass': 'text/x-ssa',
    '.srt': 'text/plain',
    '.vtt': 'text/vtt',
    '.json': 'application/json',
  };
  return mimeTypes[ext] ?? 'application/octet-stream';
}

/**
 * Minimal interface for the storage dependency.
 * Matches the methods added to StorageService in Plan 01.
 */
export interface OfflineStorageService {
  getEpisodeVideoPaths(episodeId: string): {
    videoPath: string;
    subPaths: string; // JSON array of { language: string; path: string }
  } | null;
  getDownloadById(id: string): {
    id: string;
    episodeId: string;
    outputPath: string;
    status: string;
    subUrls: { language: string; url: string }[];
  } | null;
  getCacheEntry(episodeId: string): {
    episodeId: string;
    mp4Path: string;
    subPaths: string; // JSON array string
    sizeBytes: number;
    lastAccessed: number;
    createdAt: number;
  } | null;
}

/**
 * Registers the animecix-offline:// protocol handler.
 * Must be called after app.whenReady().
 *
 * @param downloadsDir  Directory where completed downloads are stored.
 * @param cacheDir      Directory where streaming cache files are stored.
 * @param storage       StorageService instance with download/cache lookup methods.
 */
export function registerOfflineProtocol(
  downloadsDir: string,
  cacheDir: string,
  storage: OfflineStorageService,
): void {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { protocol } = require('electron') as typeof import('electron');

  const resolvedDownloads = path.resolve(downloadsDir);
  const resolvedCache = path.resolve(cacheDir);

  protocol.handle('animecix-offline', async (request) => {
    const parsed = parseOfflineUrl(request.url);
    if (!parsed) {
      return new Response('Bad Request', { status: 400 });
    }

    const { episodeId, type, language } = parsed;

    let filePath: string | null = null;

    // Priority 1: Check episode_metadata (decoupled from download_queue)
    const meta = storage.getEpisodeVideoPaths(episodeId);
    if (meta) {
      if (type === 'video') {
        filePath = meta.videoPath;
      } else if (type === 'sub' && language) {
        try {
          const subs = JSON.parse(meta.subPaths) as { language: string; path: string }[];
          const match = subs.find((s) => s.language === language);
          if (match) filePath = match.path;
        } catch { /* malformed — fall through */ }
      }
    }

    // Priority 2: Legacy fallback — check completed downloads in download_queue
    if (!filePath) {
      const download = storage.getDownloadById(episodeId);
      if (download && download.status === 'completed') {
        if (type === 'video') {
          filePath = download.outputPath;
        } else if (type === 'sub' && language) {
          const basePath = download.outputPath.replace(/\.mp4$/, '');
          filePath = `${basePath}.${language}.ass`;
        }
      }
    }

    // Priority 3: Check streaming cache
    if (!filePath) {
      const cacheEntry = storage.getCacheEntry(episodeId);
      if (cacheEntry) {
        if (type === 'video') {
          filePath = cacheEntry.mp4Path;
        } else if (type === 'sub' && language) {
          try {
            const subPaths = JSON.parse(cacheEntry.subPaths) as {
              language: string;
              path: string;
            }[];
            const match = subPaths.find((s) => s.language === language);
            if (match) {
              filePath = match.path;
            }
          } catch {
            // malformed subPaths — fall through to 404
          }
        }
      }
    }

    if (!filePath) {
      return new Response('Not Found', { status: 404 });
    }

    // Security: resolved file path must be within one of the allowed root directories.
    const resolvedFile = path.resolve(filePath);
    if (
      !resolvedFile.startsWith(resolvedDownloads + path.sep) &&
      !resolvedFile.startsWith(resolvedCache + path.sep)
    ) {
      return new Response('Forbidden', { status: 403 });
    }

    const ext = path.extname(filePath);
    const mimeType = getOfflineMimeType(ext);

    try {
      const stat = fs.statSync(filePath);
      const fileSize = stat.size;
      const rangeHeader = request.headers.get('range');

      if (rangeHeader) {
        const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
        if (match) {
          const start = parseInt(match[1], 10);
          const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;
          const chunkSize = end - start + 1;

          const nodeStream = fs.createReadStream(filePath, { start, end });
          const body = new ReadableStream({
            start(controller) {
              nodeStream.on('data', (chunk: Buffer) => controller.enqueue(chunk));
              nodeStream.on('end', () => controller.close());
              nodeStream.on('error', (e) => controller.error(e));
            },
            cancel() { nodeStream.destroy(); },
          });

          return new Response(body, {
            status: 206,
            headers: {
              'Content-Type': mimeType,
              'Content-Range': `bytes ${start}-${end}/${fileSize}`,
              'Content-Length': String(chunkSize),
              'Accept-Ranges': 'bytes',
            },
          });
        }
      }

      const nodeStream = fs.createReadStream(filePath);
      const body = new ReadableStream({
        start(controller) {
          nodeStream.on('data', (chunk: Buffer) => controller.enqueue(chunk));
          nodeStream.on('end', () => controller.close());
          nodeStream.on('error', (e) => controller.error(e));
        },
        cancel() { nodeStream.destroy(); },
      });

      return new Response(body, {
        status: 200,
        headers: {
          'Content-Type': mimeType,
          'Content-Length': String(fileSize),
          'Accept-Ranges': 'bytes',
        },
      });
    } catch (err) {
      console.error('[offline-protocol] Failed:', err);
      return new Response('Not Found', { status: 404 });
    }
  });
}

/**
 * library.ipc.ts -- IPC handler registration for all library channels.
 *
 * Follows the download.ipc.ts pattern: exported function registers handlers,
 * receives dependencies via parameters.
 *
 * Channels:
 *   library:getAnimes    -- returns all anime groupings from StorageService
 *   library:getEpisodes  -- returns episodes for a specific anime
 *   library:show         -- shows the library BrowserView overlay
 *   library:hide         -- hides the library BrowserView overlay
 *   library:playEpisode  -- hides library, navigates mainWindow to tau-player, sends initVideoData
 */

import { ipcMain, BrowserWindow, net, app } from 'electron';
import { StorageService } from '../storage/StorageService';
import { LibraryManager } from './LibraryManager';
import path from 'node:path';
import fs from 'node:fs';
import log from 'electron-log';

export function registerLibraryIpc(
  mainWindow: BrowserWindow,
  storage: StorageService,
  libraryManager: LibraryManager,
): void {
  ipcMain.handle('library:getAnimes', async () => {
    return storage.getLibraryAnimes();
  });

  ipcMain.handle('library:getEpisodes', async (_event, animeTitle: string) => {
    return storage.getLibraryEpisodes(animeTitle);
  });

  ipcMain.handle('library:show', async () => {
    libraryManager.show();
  });

  ipcMain.handle('library:hide', async () => {
    libraryManager.hide();
    if (!mainWindow.isDestroyed()) {
      const currentUrl = mainWindow.webContents.getURL();
      if (!currentUrl.startsWith('https://')) {
        void mainWindow.loadURL('https://animecix.tv');
      }
    }
  });

  ipcMain.handle('library:playEpisode', async (_event, episodeId: string) => {
    // Step 1: Hide the library BrowserView overlay
    libraryManager.hide();

    // Step 2: Build offline video and subtitle URLs
    const offlineUrl = `animecix-offline://episode/${episodeId}/video`;

    // Gather subtitle languages from download or cache metadata
    const subtitles: { language: string; url: string; name: string; id: number }[] = [];
    const dl = storage.getDownloadById(episodeId);
    if (dl && dl.status === 'completed' && dl.subUrls) {
      for (const sub of dl.subUrls) {
        subtitles.push({
          language: sub.language,
          url: `animecix-offline://episode/${episodeId}/sub/${sub.language}`,
          name: sub.language,
          id: 0,
        });
      }
    } else {
      const cached = storage.getCacheEntry(episodeId);
      if (cached && cached.subPaths) {
        try {
          const subPaths = JSON.parse(cached.subPaths) as { language: string; path: string }[];
          for (const sub of subPaths) {
            subtitles.push({
              language: sub.language,
              url: `animecix-offline://episode/${episodeId}/sub/${sub.language}`,
              name: sub.language,
              id: 0,
            });
          }
        } catch {
          // Malformed subPaths -- play without subtitles
        }
      }
    }

    // Step 3: Navigate mainWindow to tau-player with offline path.
    // tau-player:// is a local protocol -- works without network.
    // The "/embed/offline" path is a dummy -- the player will receive real
    // data via initVideoData message below (same pattern as Angular's loadOfflineVideo).
    if (!mainWindow.isDestroyed()) {
      await mainWindow.loadURL('tau-player://bundle/embed/offline');

      // Step 4: After page load, send initVideoData to the player.
      // The player's useParentMessages hook listens for window 'message' events.
      // executeJavaScript runs in the renderer context where window.postMessage works.
      // This mirrors the Angular website's loadOfflineVideo postMessage pattern exactly.
      const payload = JSON.stringify({
        action: 'initVideoData',
        video: {
          _id: episodeId,
          urls: [{ label: 'offline', url: offlineUrl, size: 0 }],
          subs: subtitles,
          duration: 0,
          title_id: '',
          season_number: '',
          episode_number: '',
          translator: '',
        },
        skipMeta: null,
        source: { type: 'local', url: offlineUrl },
      });
      await mainWindow.webContents.executeJavaScript(
        `window.postMessage(${payload}, '*');`,
      );
      log.info(`[library] Playing offline episode: ${episodeId}`);
    }
  });
}

/**
 * downloadPoster -- Downloads a poster image to userData/posters/{episodeId}.jpg.
 *
 * Per D-08: Poster images are saved locally so the library can display them offline.
 * Per T-07-04: Only HTTPS URLs are allowed to prevent SSRF.
 *
 * @param posterUrl - The HTTPS URL of the poster image
 * @param episodeId - Used as the filename (sanitized by SQLite lookup, not user-controlled path)
 * @returns The local file path if successful, empty string on failure (non-fatal)
 */
export async function downloadPoster(
  posterUrl: string,
  episodeId: string,
): Promise<string> {
  if (!posterUrl || !posterUrl.startsWith('https://')) return '';

  const postersDir = path.join(app.getPath('userData'), 'posters');
  if (!fs.existsSync(postersDir)) {
    fs.mkdirSync(postersDir, { recursive: true });
  }

  const posterPath = path.join(postersDir, `${episodeId}.jpg`);
  if (fs.existsSync(posterPath)) return posterPath; // idempotent

  try {
    const res = await net.fetch(posterUrl);
    if (!res.ok) return '';
    const buf = await res.arrayBuffer();
    fs.writeFileSync(posterPath, Buffer.from(buf));
    return posterPath;
  } catch {
    return ''; // non-fatal -- library shows placeholder if poster missing
  }
}

import { ipcMain, net } from 'electron';
import { createHmac } from 'node:crypto';
import type { StorageService } from '../storage/StorageService';

const PLAYER_SECRET = import.meta.env.VITE_PLAYER_SECRET || '';

function signSlug(slug: string): string {
  return createHmac('sha256', PLAYER_SECRET).update(slug).digest('hex');
}

/**
 * Register video data pre-fetch and subtitle preference IPC handlers.
 *
 * video:fetch — Website calls this to fetch video data via main process (no CORS).
 * Returns { video, meta } so the website can pass it to the player iframe via postMessage.
 *
 * subtitle:get/set — Website persists subtitle language preferences to SQLite.
 * The website bridges between the player iframe (postMessage) and SQLite (IPC).
 */
export function registerPlayerIpc(storage: StorageService): void {
  ipcMain.handle('video:fetch', async (_event, id: string, vid?: string) => {
    try {
      const referrer = import.meta.env.VITE_API_BASE_URL + '/embed/';
      const videoUrl = import.meta.env.VITE_API_BASE_URL + '/api/video/' + id + (vid ? '?vid=' + vid : '');
      const videoRes = await net.fetch(videoUrl, { referrer });
      const video = await videoRes.json();

      let meta = null;
      if (video.title_id && video.season_number && video.episode_number) {
        const slug = video.title_id + '_' + video.season_number + '_' + video.episode_number + '_' + video.translator;
        try {
          const sig = signSlug(slug);
          const metaRes = await net.fetch(
            import.meta.env.VITE_API_BASE_URL + '/api/most-sought/' + slug + '?tauId=' + video._id,
            { referrer, headers: { 'x-player-sig': sig } }
          );
          meta = await metaRes.json();
        } catch {
          // Skip markers not available — non-fatal
        }
      }

      return { video, meta };
    } catch (err) {
      console.error('video:fetch failed:', err);
      return null;
    }
  });

  ipcMain.handle('subtitle:get', (_event, animeId: string) => {
    return storage.getSubtitlePref(animeId) ?? 'tr';
  });

  ipcMain.handle('subtitle:set', (_event, animeId: string, language: string) => {
    storage.setSubtitlePref(animeId, language);
  });
}

// Updater IPC channel names — camelCase verb after namespace (Phase 1 convention)
// Shared between main process (updater.ipc.ts) and renderer/preload (preload.ts)

export const UPDATER_CHANNELS = {
  // Renderer → Main (invoke)
  CHECK_FOR_UPDATES: 'updater:checkForUpdates',
  INSTALL: 'updater:install',
  // Renderer → Main (send)
  DISMISS_BANNER: 'updater:dismissBanner',
  // Main → Renderer (send/on)
  UPDATE_READY: 'updater:updateReady',
  UPDATE_AVAILABLE: 'updater:updateAvailable',
  UPDATE_NOT_AVAILABLE: 'updater:updateNotAvailable',
  DOWNLOAD_PROGRESS: 'updater:downloadProgress',
  ERROR: 'updater:error',
} as const;

export interface UpdateReadyPayload {
  version: string;
  releaseNotes?: string;
}

export interface DownloadProgressPayload {
  percent: number;          // 0..100
  bytesPerSecond: number;
  transferred: number;
  total: number;
}

export interface UpdaterApi {
  checkForUpdates(): Promise<void>;
  install(): Promise<void>;
  dismissBanner(): void;
  openDownloadPage(): void;
  /** Returns an unsubscribe function */
  onUpdateReady(cb: (payload: UpdateReadyPayload) => void): () => void;
  /** Returns an unsubscribe function */
  onDownloadProgress(cb: (payload: DownloadProgressPayload) => void): () => void;
}

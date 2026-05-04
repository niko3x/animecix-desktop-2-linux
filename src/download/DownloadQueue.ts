import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { app } from 'electron';
import { Downloader } from './Downloader';
import type { DownloadProgress, DownloadQueueItem } from './download.types';
import type { StorageService } from '../storage/StorageService';

const MAX_DOWNLOAD_SIZE = 10 * 1024 * 1024 * 1024; // 10 GB

function sanitizeFilename(name: string): string {
  return name
    .replace(/[/\\:*?"<>|]/g, '_')
    .trim()
    .slice(0, 200);
}

export class DownloadQueue extends EventEmitter {
  private storage: StorageService;
  private downloadsDir: string;
  private activeDownloader: Downloader | null = null;
  private activeDownloadId: string | null = null;

  constructor(storage: StorageService, downloadsDir?: string) {
    super();
    this.storage = storage;
    this.downloadsDir = downloadsDir ?? path.join(app.getPath('downloads'), 'AnimeciX');

    // Crash recovery: reset any 'downloading' items to 'queued'
    const incomplete = this.storage.getIncompleteDownloads();
    for (const item of incomplete) {
      if (item.status === 'downloading') {
        this.storage.updateDownloadStatus(item.id, 'queued');
      }
    }

    this.processNext();
  }

  async add(
    episodeId: string,
    url: string,
    title: string,
    subUrls: { language: string; url: string }[],
  ): Promise<string> {
    Downloader.validateUrl(url);

    // Ensure downloads directory exists
    if (!fs.existsSync(this.downloadsDir)) {
      fs.mkdirSync(this.downloadsDir, { recursive: true });
    }

    const id = episodeId;
    const safeName = sanitizeFilename(title);
    const outputPath = path.join(this.downloadsDir, safeName + '.mp4');

    // HEAD request to get Content-Length
    const totalBytes = await this.getContentLength(url);

    if (totalBytes > MAX_DOWNLOAD_SIZE) {
      throw new Error(
        `File size ${totalBytes} exceeds maximum allowed size of ${MAX_DOWNLOAD_SIZE} bytes`,
      );
    }

    const chunkDefs = Downloader.splitIntoChunks(totalBytes, 4);
    const chunks = chunkDefs.map((c, i) => ({
      chunkIndex: i,
      byteStart: c.start,
      byteEnd: c.end,
      tempPath: outputPath + '.part' + i,
    }));

    this.storage.enqueueDownload({
      id,
      episodeId,
      title,
      url,
      subUrls: JSON.stringify(subUrls),
      outputPath,
      totalBytes,
      chunks,
    });

    this.processNext();
    return id;
  }

  pause(id: string): void {
    if (this.activeDownloadId === id && this.activeDownloader) {
      this.activeDownloader.pause();
      this.storage.updateDownloadStatus(id, 'paused');
      this.activeDownloader = null;
      this.activeDownloadId = null;
    } else {
      // Queued item — just mark as paused
      this.storage.updateDownloadStatus(id, 'paused');
    }
  }

  resume(id: string): void {
    this.storage.updateDownloadStatus(id, 'queued');
    this.processNext();
  }

  cancel(id: string): void {
    if (this.activeDownloadId === id && this.activeDownloader) {
      this.activeDownloader.pause(); // aborts requests
      this.activeDownloader = null;
      this.activeDownloadId = null;
    }

    const item = this.storage.getDownloadById(id);
    if (item) {
      // Clean up temp chunk files
      for (const chunk of item.chunks) {
        try {
          if (fs.existsSync(chunk.tempPath)) {
            fs.unlinkSync(chunk.tempPath);
          }
        } catch {
          // Ignore cleanup errors
        }
      }
      // Clean up completed video file if it exists
      try {
        if (fs.existsSync(item.outputPath)) {
          fs.unlinkSync(item.outputPath);
        }
      } catch { /* ignore */ }

      this.storage.deleteEpisodeMetadata(item.episodeId);
    }

    this.storage.deleteDownload(id);
    this.processNext();
  }

  pauseAll(): void {
    const all = this.storage.getAllDownloads();
    for (const item of all) {
      if (item.status === 'downloading' || item.status === 'queued') {
        this.pause(item.id);
      }
    }
  }

  cancelAll(): void {
    const all = this.storage.getAllDownloads();
    for (const item of all) {
      if (item.status === 'downloading' || item.status === 'queued' || item.status === 'paused') {
        this.cancel(item.id);
      }
    }
  }

  getQueue(): DownloadProgress[] {
    const all = this.storage.getAllDownloads();
    return all.map((item) => {
      const downloadedBytes = item.chunks.reduce(
        (sum, c) => sum + c.bytesDownloaded,
        0,
      );
      return {
        id: item.id,
        episodeId: item.episodeId,
        title: item.title,
        status: item.status,
        progressPercent:
          item.totalBytes > 0 ? (downloadedBytes / item.totalBytes) * 100 : 0,
        speedBps: 0,
        totalBytes: item.totalBytes,
        downloadedBytes,
      };
    });
  }

  private processNext(): void {
    // Sequential: only 1 active download at a time
    if (this.activeDownloader) return;

    const incomplete = this.storage.getIncompleteDownloads();
    const next = incomplete.find((item) => item.status === 'queued');
    if (!next) {
      this.emit('queueEmpty');
      return;
    }

    this.activeDownloadId = next.id;
    this.storage.updateDownloadStatus(next.id, 'downloading');

    const downloader = new Downloader(
      next.url,
      next.outputPath,
      next.chunks,
      this.storage,
    );
    this.activeDownloader = downloader;

    downloader.on('progress', (progress: { downloadedBytes: number; totalBytes: number; speedBps: number }) => {
      this.emit('progress', {
        id: next.id,
        episodeId: next.episodeId,
        title: next.title,
        status: 'downloading' as const,
        progressPercent:
          progress.totalBytes > 0
            ? (progress.downloadedBytes / progress.totalBytes) * 100
            : 0,
        speedBps: progress.speedBps,
        totalBytes: progress.totalBytes,
        downloadedBytes: progress.downloadedBytes,
      });
    });

    downloader.on('complete', () => {
      this.storage.updateDownloadStatus(next.id, 'completed');
      this.activeDownloader = null;
      this.activeDownloadId = null;

      // Download subtitles
      this.downloadSubtitles(next)
        .catch(() => {
          // Subtitle download failure is non-fatal
        })
        .finally(() => {
          this.emit('downloadComplete', { id: next.id, episodeId: next.episodeId, title: next.title });
          this.processNext();
        });
    });

    downloader.on('error', (err: Error) => {
      this.storage.updateDownloadStatus(next.id, 'failed');
      this.activeDownloader = null;
      this.activeDownloadId = null;
      this.emit('error', { id: next.id, error: err });
      this.processNext();
    });

    downloader.start();
  }

  private async downloadSubtitles(item: DownloadQueueItem): Promise<void> {
    if (!item.subUrls || item.subUrls.length === 0) return;

    const dir = path.dirname(item.outputPath);
    const safeName = sanitizeFilename(item.title);

    for (const sub of item.subUrls) {
      const subPath = path.join(dir, `${safeName}.${sub.language}.ass`);
      await this.downloadFile(sub.url, subPath);
    }
  }

  private downloadFile(url: string, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const httpModule = parsed.protocol === 'https:' ? https : http;

      const file = fs.createWriteStream(dest);
      httpModule
        .get(url, (res) => {
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            file.close();
            fs.unlinkSync(dest);
            this.downloadFile(res.headers.location, dest).then(resolve).catch(reject);
            return;
          }
          res.pipe(file);
          file.on('finish', () => {
            file.close();
            resolve();
          });
        })
        .on('error', (err) => {
          file.close();
          try { fs.unlinkSync(dest); } catch { /* ignore */ }
          reject(err);
        });
    });
  }

  private getContentLength(url: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const httpModule = parsed.protocol === 'https:' ? https : http;

      const req = httpModule.request(url, { method: 'HEAD' }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          this.getContentLength(res.headers.location).then(resolve).catch(reject);
          return;
        }
        const len = parseInt(res.headers['content-length'] ?? '0', 10);
        resolve(len);
      });
      req.on('error', reject);
      req.end();
    });
  }
}

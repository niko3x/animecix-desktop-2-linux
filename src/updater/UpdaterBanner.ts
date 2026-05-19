/**
 * UpdaterBanner — BrowserView overlay that appears at the bottom of the main window
 * when an update is ready to install (UPDATER_CHANNELS.UPDATE_READY).
 *
 * Architecture choice: BrowserView overlay (not executeJavaScript injection) because:
 * - The main window loads animecix.tv (remote origin) — script injection is fragile
 *   across navigations and requires relaxed CSP.
 * - BrowserView is origin-isolated, survives navigation, and has its own preload.
 * - The same preload.ts file is reused so animecixAPI.updater is available in the banner.
 */

import { BrowserView, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'node:path';
import log from 'electron-log';
import { UPDATER_CHANNELS } from '../types/updater.js';
import type { UpdaterService } from './UpdaterService.js';

const BANNER_HEIGHT = 64;

const BANNER_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><style>
html,body{margin:0;padding:0;font-family:system-ui,-apple-system,sans-serif;background:#111827;color:#f9fafb;height:100%;overflow:hidden}
.banner{display:flex;align-items:center;gap:12px;padding:0 16px;height:100%;border-top:1px solid #1f2937}
.msg{flex:1;font-size:14px;font-weight:500;color:#e5e7eb}
button{padding:8px 14px;border:0;border-radius:4px;cursor:pointer;font-size:13px;font-weight:500}
button:hover{filter:brightness(1.15)}
.primary{background:#3b82f6;color:#fff}
.secondary{background:transparent;color:#9ca3af;border:1px solid #374151}
</style></head><body>
<div class="banner"><span class="msg">Yeni sürüm hazır</span>
<button class="primary" id="install">Şimdi yeniden başlat</button>
<button class="secondary" id="dismiss">Sonra</button>
<button class="secondary" id="manual" style="color:#6b7280;font-size:12px;border:none;padding:4px 8px">Sorun mu yaşıyorsunuz?</button></div>
<script>
document.getElementById('install').onclick=()=>window.animecixAPI.updater.install();
document.getElementById('dismiss').onclick=()=>{window.animecixAPI.updater.dismissBanner();};
document.getElementById('manual').onclick=()=>{window.animecixAPI.updater.openDownloadPage();};
if (${process.platform === 'linux' && !process.env.APPIMAGE}) {
  document.querySelector('.msg').textContent='Yeni sürüm mevcut';
  const btn=document.getElementById('install');
  btn.textContent='Yeni sürümü indir';
  btn.onclick=()=>{window.animecixAPI.updater.openDownloadPage();};
  document.getElementById('manual').style.display='none';
}

</script></body></html>`;

export class UpdaterBanner {
  private view: BrowserView | null = null;
  private mainWindow: BrowserWindow;
  private resizeHandler: (() => void) | null = null;

  constructor(mainWindow: BrowserWindow, service: UpdaterService) {
    this.mainWindow = mainWindow;

    // Listen for UPDATE_READY via UpdaterService event bridge
    service.onEvent((channel) => {
      if (channel === UPDATER_CHANNELS.UPDATE_READY) {
        this.show();
      }
    });

    // Dismiss IPC — renderer sends this when "Sonra" is clicked
    ipcMain.on(UPDATER_CHANNELS.DISMISS_BANNER, () => {
      this.hide();
    });

    ipcMain.on('updater:openDownloadPage', () => {
      shell.openExternal('https://animecix.tv/pages/118/download-apps');
    });
  }

  private show(): void {
    if (this.view) return; // already visible

    const preloadPath = path.join(__dirname, 'preload.js');

    this.view = new BrowserView({
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        // INTENTIONAL: sandbox: false is needed for preload contextBridge in this BrowserView.
        // See OPEN-SOURCE-AUDIT.md "Intentional Bypasses §3".
        sandbox: false,
      },
    });

    this.mainWindow.addBrowserView(this.view);
    this.updateBounds();

    // Track resize so banner stays pinned to bottom
    this.resizeHandler = () => this.updateBounds();
    this.mainWindow.on('resize', this.resizeHandler);

    this.view.webContents.loadURL(
      'data:text/html;charset=utf-8,' + encodeURIComponent(BANNER_HTML)
    ).catch((err) => {
      log.error('[updater-banner] Failed to load banner HTML:', err?.message);
    });

    log.info('[updater-banner] Banner shown');
  }

  private hide(): void {
    if (!this.view) return;

    if (this.resizeHandler) {
      this.mainWindow.removeListener('resize', this.resizeHandler);
      this.resizeHandler = null;
    }

    if (!this.mainWindow.isDestroyed()) {
      this.mainWindow.removeBrowserView(this.view);
    }
    if (!this.view.webContents.isDestroyed()) {
      this.view.webContents.destroy();
    }
    this.view = null;
    log.info('[updater-banner] Banner hidden');
  }

  private updateBounds(): void {
    if (!this.view) return;
    const [width, height] = this.mainWindow.getContentSize();
    this.view.setBounds({
      x: 0,
      y: height - BANNER_HEIGHT,
      width,
      height: BANNER_HEIGHT,
    });
  }

  dispose(): void {
    this.hide();
  }
}

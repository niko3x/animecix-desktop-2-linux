import { app, BrowserWindow, screen, shell } from 'electron';
import path from 'node:path';
import { StorageService } from '../storage/StorageService';
import type { TrayManager } from '../download/TrayManager';

const isMac = process.platform === 'darwin';

// Debounce helper
function debounce<T extends (...args: Parameters<T>) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return ((...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}

export function createWindow(storage: StorageService): BrowserWindow {
  const savedBounds = storage.getWindowBounds();

  // Validate saved bounds are within a visible display
  let x: number | undefined;
  let y: number | undefined;
  let width = savedBounds.width;
  let height = savedBounds.height;

  if (savedBounds.x !== undefined && savedBounds.y !== undefined) {
    const display = screen.getDisplayMatching({
      x: savedBounds.x,
      y: savedBounds.y,
      width: savedBounds.width,
      height: savedBounds.height,
    });
    const workArea = display.workArea;
    const isVisible =
      savedBounds.x < workArea.x + workArea.width &&
      savedBounds.x + savedBounds.width > workArea.x &&
      savedBounds.y < workArea.y + workArea.height &&
      savedBounds.y + savedBounds.height > workArea.y;

    if (isVisible) {
      x = savedBounds.x;
      y = savedBounds.y;
    }
  }

  // Fall back to defaults if no valid position
  if (x === undefined || y === undefined) {
    width = 1280;
    height = 800;
    x = undefined;
    y = undefined;
  }

  const browserWindowOptions: Electron.BrowserWindowConstructorOptions = {
    width,
    height,
    ...(x !== undefined && y !== undefined ? { x, y } : {}),
    show: false,
    backgroundColor: '#1D1D1D',
    frame: false,
    title: 'AnimeciX',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: false, // Allow cross-origin video canvas access (color extraction)
      preload: path.join(__dirname, 'preload.js'),
    },
  };

  if (isMac) {
    browserWindowOptions.titleBarStyle = 'hidden';
  } else {
    browserWindowOptions.titleBarStyle = 'hidden';
    browserWindowOptions.titleBarOverlay = {
      color: '#1D1D1D',
      symbolColor: '#ffffff',
      height: 40,
    };
  }

  const win = new BrowserWindow(browserWindowOptions);

  // Restore maximized state
  if (savedBounds.maximized) {
    win.maximize();
  }

  // Show window when ready
  win.once('ready-to-show', () => {
    win.show();
  });

  // Dev: load local Angular dev server; Production: load animecix.tv
  const startUrl = app.isPackaged
    ? 'https://animecix.tv'
    : 'http://localhost:4200';
  void win.loadURL(startUrl);

  // Persist bounds on resize/move — debounced, skip while maximized
  const saveBounds = debounce(() => {
    if (win.isMaximized()) return; // Don't save maximized dimensions as restore bounds
    const bounds = win.getBounds();
    storage.saveWindowBounds({ ...bounds, maximized: false });
  }, 500);

  win.on('resize', saveBounds);
  win.on('move', saveBounds);

  // When window is un-maximized, save the restored bounds
  win.on('unmaximize', () => {
    const bounds = win.getBounds();
    storage.saveWindowBounds({ ...bounds, maximized: false });
  });

  // When maximized, persist the maximized flag (but not the inflated dimensions)
  win.on('maximize', () => {
    const bounds = win.getBounds();
    storage.saveWindowBounds({ ...bounds, maximized: true });
  });

  // Handle window-all-closed in WindowService (non-macOS quit)
  app.on('window-all-closed', () => {
    if (!isMac) {
      app.quit();
    }
  });

  // Intercept popup links — open in default browser, never open new BrowserWindow
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  return win;
}

export function setupCloseIntercept(
  win: BrowserWindow,
  getTrayManager: () => TrayManager | null,
): void {
  win.on('close', (event) => {
    const trayManager = getTrayManager();
    if (trayManager && trayManager.hasActiveDownloads()) {
      event.preventDefault();
      win.hide();
      trayManager.createTray();
    }
  });
}

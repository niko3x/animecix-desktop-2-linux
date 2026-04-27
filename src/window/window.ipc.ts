import { ipcMain, BrowserWindow } from 'electron';

export function registerWindowIpc(win: BrowserWindow): void {
  // Window control handlers
  ipcMain.handle('window:minimize', () => {
    win.minimize();
  });

  ipcMain.handle('window:maximize', () => {
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  });

  ipcMain.handle('window:close', () => {
    win.close();
  });

  ipcMain.handle('window:isMaximized', () => {
    return win.isMaximized();
  });

  // D-09: setFullscreen IPC handler. Renderer (animecix.tv) calls this in response to
  // postMessage from the player iframe (Plan 05). Boolean(...) coercion is defense-in-depth
  // per RESEARCH.md ASVS V5 — contextBridge can serialize unexpected values to null/undefined.
  // The async OS fullscreen transition is reported back via the existing
  // enter-full-screen / leave-full-screen listeners below (D-11 — no new event source).
  ipcMain.handle('window:setFullscreen', (_event, fullscreen: boolean) => {
    win.setFullScreen(Boolean(fullscreen));
  });

  // Fullscreen event notifications to renderer
  win.on('enter-full-screen', () => {
    win.webContents.send('window:fullscreen-changed', true);
  });

  win.on('leave-full-screen', () => {
    win.webContents.send('window:fullscreen-changed', false);
  });
}

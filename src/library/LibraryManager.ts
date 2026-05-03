import { BrowserWindow } from 'electron';
import log from 'electron-log';

export class LibraryManager {
  private active = false;
  private mainWindow: BrowserWindow;

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
  }

  show(): void {
    if (this.active) return;
    this.active = true;
    void this.mainWindow.loadURL('animecix-library://bundle/');
    log.info('[library] Navigated mainWindow to library page');
  }

  hide(): void {
    if (!this.active) return;
    this.active = false;
    void this.mainWindow.loadURL('https://animecix.tv');
    log.info('[library] Navigated mainWindow back to website');
  }

  isVisible(): boolean {
    return this.active;
  }

  getMainWindow(): BrowserWindow {
    return this.mainWindow;
  }

  deactivate(): void {
    this.active = false;
  }

  dispose(): void {
    this.active = false;
  }
}

// deep-link.ts — animecix:// protocol registration and URL parsing
// Security: All URL data is validated before use in navigation (T-02-06, T-02-07, T-02-08)

import { app } from 'electron';
import path from 'node:path';
import type { WebContents } from 'electron';

const ANIMECIX_SCHEME = 'animecix://';
const CALLBACK_BASE = import.meta.env.VITE_SITE_URL + '/secure/short-login/';

/**
 * Register animecix:// as the default protocol client for this app.
 * In dev mode (process.defaultApp), passes execPath and argv[1] as args.
 */
export function registerDeepLinkProtocol(): void {
  if (process.defaultApp) {
    // Dev mode: Electron uses the script file as the "app"
    app.setAsDefaultProtocolClient('animecix', process.execPath, [
      path.resolve(process.argv[1]),
    ]);
  } else {
    app.setAsDefaultProtocolClient('animecix');
  }
}

/**
 * Parse an animecix:// deep link URL.
 * Returns { status, data } on success, null on invalid input.
 *
 * Valid format: animecix://login[{status}|]{data}
 * Security: rejects non-animecix:// schemes, non-login paths, and data with '..' or '/'
 */
export function parseDeepLinkUrl(
  rawUrl: string,
): { status: string | null; data: string } | null {
  const url = decodeURIComponent(rawUrl);

  // Validate scheme
  if (!url.startsWith(ANIMECIX_SCHEME)) {
    return null;
  }

  const rest = url.slice(ANIMECIX_SCHEME.length);

  // Must have a path
  if (!rest) {
    return null;
  }

  // Must start with 'login'
  if (!rest.startsWith('login')) {
    return null;
  }

  // Windows appends trailing slash to custom protocol URLs — strip it
  const afterLogin = rest.slice('login'.length).replace(/\/+$/, '');

  // Must have data after 'login'
  if (!afterLogin) {
    return null;
  }

  // Deep link format: animecix://login{status|data}
  // Strip curly braces from the payload before parsing
  const payload = afterLogin.replace(/[{}]/g, '');

  let status: string | null = null;
  let data: string;

  if (payload.includes('|')) {
    const pipeIdx = payload.indexOf('|');
    status = payload.slice(0, pipeIdx);
    data = payload.slice(pipeIdx + 1);
  } else {
    data = payload;
  }

  // Validate data: reject path traversal and forward slashes
  if (data.includes('..') || data.includes('/')) {
    return null;
  }

  // Reject empty data
  if (!data) {
    return null;
  }

  return { status, data };
}

/**
 * Build the callback URL for the animecix login flow.
 * Returns null if data is empty or contains path traversal characters.
 *
 * Security: only constructs URLs to animecix.tv/secure/short-login/ (T-02-07)
 */
export function buildCallbackUrl(data: string): string | null {
  if (!data) {
    return null;
  }
  if (data.includes('..') || data.includes('/')) {
    return null;
  }
  return `${CALLBACK_BASE}${data}`;
}

/**
 * Find the first animecix:// URL in the given argv array.
 * Used to handle cold-start deep links passed via process.argv.
 */
export function extractDeepLinkFromArgs(args: string[]): string | null {
  return args.find((arg) => arg.startsWith(ANIMECIX_SCHEME)) ?? null;
}

/**
 * Handle a deep link URL by parsing it and navigating the given WebContents.
 * Returns true if handled successfully, false if the URL was invalid.
 *
 * Security: only navigates to validated animecix.tv/secure/short-login/ URLs (T-02-08)
 */
export function handleDeepLink(url: string, webContents: WebContents): boolean {
  const parsed = parseDeepLinkUrl(url);
  if (!parsed) {
    return false;
  }

  const callbackUrl = buildCallbackUrl(parsed.data);
  if (!callbackUrl) {
    return false;
  }

  webContents.loadURL(callbackUrl);
  return true;
}

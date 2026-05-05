# AnimeciX Desktop

Electron desktop application for [AnimeciX](https://animecix.tv) — anime streaming, downloading, and offline playback.

## Features

- Stream anime directly from the AnimeciX catalog
- Download episodes for offline viewing
- Background downloads with system tray support
- ASS/SSA subtitle rendering (via JASSUB)
- Discord Rich Presence integration
- Auto-updates (macOS + Windows)
- Cross-origin color extraction for dynamic UI themes
- Ad blocking with EasyList/EasyPrivacy filters
- Offline library with browse and search

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Electron 41 + Electron Forge 7 (Vite plugin) |
| Language | TypeScript 5.9 (strict, `noImplicitAny: true`) |
| UI | React 19 (player + library pages) |
| Video | Vidstack React + hls.js + JASSUB |
| Database | better-sqlite3 (synchronous SQLite, WAL mode) |
| Build | 5 Vite configs (main, preload, renderer, player, library) |
| Testing | Vitest 4 |

## Architecture

```
Main Process (Electron)
  ├── StorageService      SQLite database (window bounds, downloads, cache, prefs)
  ├── DownloadQueue       Multi-threaded video downloader with pause/resume
  ├── StreamCache         Transparent + explicit video caching
  ├── DiscordService      Rich Presence integration
  ├── UpdaterService      Auto-update via electron-updater
  ├── LibraryManager      Offline library overlay
  ├── AdBlocker           EasyList/EasyPrivacy filter engine
  ├── HeaderRewriter      CDN request header management
  └── TrayManager         System tray for background downloads

Preload (contextBridge)
  └── window.animecix     IPC bridge — ipcRenderer is never exposed directly

Renderer
  ├── animecix.tv         Angular website (loaded in main BrowserWindow)
  ├── tau-player://       React video player (Vidstack + JASSUB) in iframe
  └── animecix-library:// React offline library overlay
```

### Custom Protocol Schemes

| Protocol | Purpose |
|----------|---------|
| `tau-player://` | Serves local video player assets |
| `animecix-offline://` | Serves cached/downloaded video files |
| `animecix-library://` | Serves offline library React app |
| `animecix://` | Deep link protocol for Google auth callback |

## Getting Started

### Prerequisites

- **Node.js** >= 22
- **npm** >= 10
- **Python 3** + C++ build tools (for `better-sqlite3` native compilation)
  - macOS: `xcode-select --install`
  - Windows: `npm install -g windows-build-tools` or install Visual Studio Build Tools
- **Git**

### Setup

```bash
# Clone
git clone https://github.com/CaptainSP/animecix-desktop-2.git
cd animecix-desktop-2

# Install dependencies (also rebuilds native modules for Electron)
npm install

# Copy environment config and fill in your values
cp .env.example .env
# Edit .env with your API URLs, CDN domain, site URL, and Discord Client ID

# Start in development mode (connects to localhost:4200 Angular dev server)
npm start
```

### Environment Variables

The app uses Vite build-time environment variables. Copy `.env.example` to `.env` and configure:

| Variable | Description |
|----------|-------------|
| `VITE_API_BASE_URL` | Backend API base URL (no trailing slash) |
| `VITE_CDN_DOMAIN` | Video CDN hostname (no protocol) |
| `VITE_SITE_URL` | Main website URL (no trailing slash) |
| `VITE_DISCORD_CLIENT_ID` | Discord application Client ID for Rich Presence |

### Common Commands

```bash
npm start              # Start in development mode
npm test               # Run test suite
npm run lint           # Run ESLint
npm run build:player   # Build player React app to assets/player/
npm run build:library  # Build library React app to assets/library/
npm run package        # Package for current platform
npm run make           # Make distributable (DMG/Setup.exe)
```

## Project Structure

```
src/
├── main.ts              # Electron main process entry point
├── preload.ts           # contextBridge API (AnimecixAPI contract)
├── renderer.ts          # Renderer process entry
├── auth/                # Deep link protocol (Google login callback)
├── cache/               # StreamCache, HlsMuxer, CacheEvictor
├── download/            # Multi-threaded downloader, queue, tray, IPC
├── integrations/        # Discord Rich Presence
├── library/             # Offline library manager (BrowserView overlay)
├── library-page/        # React app for offline library UI
├── network/             # Ad blocker, request interception, CDN headers
├── offline/             # animecix-offline:// protocol handler
├── player/              # tau-player:// protocol handler
├── player-page/         # React app for video player (Vidstack + JASSUB)
├── storage/             # SQLite StorageService + schema
├── types/               # TypeScript type definitions
├── updater/             # Auto-update service + in-app banner
└── window/              # BrowserWindow creation, lifecycle, IPC
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines, commit conventions, and code review process.

## License

[MIT](LICENSE) — see [NOTICE](NOTICE) for third-party license attributions.

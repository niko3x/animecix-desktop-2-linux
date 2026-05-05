# Contributing to AnimeciX Desktop

Thank you for your interest in contributing! This guide will help you get started.

## Development Setup

### Prerequisites

- Node.js >= 22
- npm >= 10
- Python 3 + C++ build tools (for `better-sqlite3` native compilation)
  - macOS: `xcode-select --install`
  - Windows: Visual Studio Build Tools with "Desktop development with C++"
- Git

### Getting Started

```bash
git clone https://github.com/CaptainSP/animecix-desktop-2.git
cd animecix-desktop-2
npm install
cp .env.example .env
# Fill in .env with your values (see README.md for details)
npm start
```

### Running Tests

```bash
npm test          # Run all tests
npm run lint      # Run ESLint
```

## Code Style

- **Language:** All code, comments, and commit messages must be in **English**. Turkish is only allowed in user-facing UI strings.
- **Naming:** `camelCase` for variables, `PascalCase` for classes, `UPPER_SNAKE_CASE` for constants.
- **TypeScript:** Strict mode with `noImplicitAny`. No `any` types — use `unknown` with type narrowing.
- **Comments:** Explain **why**, not what. No commented-out code.
- **Constants:** Name all magic numbers. Use descriptive expressions (e.g., `4 * 60 * 60 * 1000` not `14400000`).

## Architecture Rules

- **IPC:** Never expose `ipcRenderer` directly. All IPC goes through `preload.ts` + `contextBridge`.
- **IPC handlers** go in `<domain>.ipc.ts` files (e.g., `download.ipc.ts`).
- **Protocol handlers** use two-phase registration: scheme at module top-level, handler after `app.ready`.
- **Player iframe** (tau-player://) has no Electron IPC access. Communication goes through `postMessage` to the website, which bridges to main process.

See [CLAUDE.md](CLAUDE.md) for the full architecture reference and code rules.

## Commit Conventions

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new feature
fix: fix a bug
refactor: code change that neither fixes a bug nor adds a feature
docs: documentation only
test: adding or updating tests
chore: build, tooling, or dependency changes
```

One logical change per commit. Keep messages concise and in English.

## Pull Request Process

1. Fork the repository and create a feature branch from `main`.
2. Make your changes following the code style above.
3. Run `npm test` and `npm run lint` — both must pass.
4. Commit with a conventional commit message.
5. Open a PR with a clear description of **what** and **why**.

## Important: Intentional Bypasses

Some patterns in the codebase look like bugs but are intentional architectural decisions. These are marked with `INTENTIONAL — DO NOT CHANGE` comments and documented in [OPEN-SOURCE-AUDIT.md](OPEN-SOURCE-AUDIT.md). Please read that section before submitting PRs that modify:

- `webSecurity: false` in WindowService
- `TARGET_ORIGIN = '*'` in useParentMessages
- `sandbox: false` in UpdaterBanner
- CDN header rewriting in header-rewriter.ts
- `(window as any).animecix` casts in the player page (offline mode)

## Scope of This Repository

This repo contains **only the Electron desktop shell**. The main website (animecix.tv) is a separate Angular application loaded inside the Electron BrowserWindow at runtime.

If your change requires modifications to the website (e.g., new postMessage channels, changes to the `window.animecix` API contract, UI changes in the Angular app), please **open an issue first** describing the cross-repo dependency. Website changes are coordinated separately and must be deployed before or alongside the desktop release.

Things that live in this repo:
- Main process services (download, cache, storage, updater, etc.)
- Preload bridge (`preload.ts` + `AnimecixAPI` contract)
- Player page (React — `src/player-page/`)
- Library page (React — `src/library-page/`)
- Protocol handlers, network layer, IPC handlers

Things that live in the website repo (NOT here):
- Angular components, routes, and pages
- `window.animecix` call sites in the website
- postMessage sender/receiver logic on the website side
- Website-side UI (navbar, episode pages, etc.)

## Questions?

Open an issue if you have questions about the codebase or need guidance on where to start.

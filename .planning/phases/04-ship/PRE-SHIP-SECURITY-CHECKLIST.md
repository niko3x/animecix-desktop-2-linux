# Pre-Ship Security Checklist — Phase 4

This checklist MUST be fully checked before the first public release (the first non-draft GitHub Release). Each item references the threat it mitigates.

## Blocking Items

- [ ] **Revoke legacy GitHub PAT (T-4-02)** — `animecix-desktop/electron-builder.yml:9` contains a hardcoded GitHub Personal Access Token used by the legacy app's publish pipeline. Before any public release:
      1. Visit https://github.com/settings/tokens — identify the token matching the prefix in line 9.
      2. Click "Delete" on that token.
      3. Edit `animecix-desktop/electron-builder.yml` to remove or replace the `token:` line (use `${GH_TOKEN}` env var reference).
      4. Confirm via `gh auth status` that the old token no longer authenticates.

- [ ] **Apple Developer ID cert (.p12) stored only as a GitHub Secret (T-4-01)** — never checked into the repo, never logged. Verify via:
      - `git log --all -S "BEGIN CERTIFICATE"` returns no results.
      - GitHub repo → Settings → Secrets → Actions → `APPLE_DEVELOPER_ID_APPLICATION_CERT` is present.

- [ ] **ASC API key (.p8) stored only as a GitHub Secret (T-4-01)** — verify:
      - `git log --all -S "BEGIN PRIVATE KEY"` returns no results.
      - Secret `APPLE_API_KEY` present in repo settings.

- [ ] **All six Apple secrets present** — `APPLE_API_KEY`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`, `APPLE_TEAM_ID`, `APPLE_DEVELOPER_ID_APPLICATION_CERT`, `APPLE_DEVELOPER_ID_APPLICATION_CERT_PASSWORD`. Listed in CI workflow at `.github/workflows/release.yml`.

- [ ] **Draft-release gate verified (T-4-06)** — publisher-github config in `forge.config.ts` has `draft: true`. A dry-run tag must produce a DRAFT release (not public) — confirmed visually in the GitHub Releases UI.

- [ ] **publisherName match (T-4-03)** — the notarized macOS .app's `Team Identifier` matches `APPLE_TEAM_ID`. Verify on a built artifact: `codesign -dvvv AnimeciX.app 2>&1 | grep TeamIdentifier`.

- [ ] **No unmasked secrets in CI logs (T-4-01)** — after the dry-run workflow finishes, download the job log and grep for known secret prefixes (cert password, p8 content prefix). Must return no matches.

- [ ] **Windows SmartScreen expectation documented (D-07)** — users are told in release notes and README that first-launch shows a "Windows protected your PC" dialog; they click "More info → Run anyway". This is intentional until a Windows cert is acquired (deferred).

- [ ] **entitlements.mac.plist audited (T-4-08)** — `build/entitlements.mac.plist` contains only the minimum required entitlements for Electron + hardened runtime. Verify the file includes:
      - `com.apple.security.cs.allow-jit` (Electron JIT)
      - `com.apple.security.cs.allow-unsigned-executable-memory` (Electron V8)
      - `com.apple.security.network.client` (animecix.tv access)
      - `com.apple.security.files.downloads.read-write` (download management from Phase 3)
      And does NOT include:
      - `com.apple.security.cs.disable-library-validation`
      - `com.apple.security.cs.disable-executable-page-protection`
      - `com.apple.security.get-task-allow` (dangerous — allows debugger attach)

- [ ] **Update channel integrity (T-4-13)** — `resources/app-update.yml` points to owner: `CaptainSP`, repo: `animecix-desktop-2`. Verify this matches the actual repository where releases will be published. Do NOT point at a fork or test repo by mistake.

- [ ] **Tag/version alignment (T-4-05)** — before the real release, confirm `package.json` version field matches the intended tag. `node scripts/verify-tag.mjs` must exit 0 locally:
      ```bash
      GITHUB_REF_NAME=v$(node -p "require('./package.json').version") node scripts/verify-tag.mjs
      ```

- [ ] **Release approver sign-off (T-4-15)** — complete the Sign-Off section below and commit this file with the release commit. Creates an audit trail of who approved the release.

## Non-Blocking Follow-ups (track as issues)

- Acquire Windows EV/OV code-signing certificate (deferred from v1 per D-07).
- Add code-signing cert rotation runbook.
- Configure branch protection on `main` requiring PR + 1 approval.
- Verify Squirrel delta `.nupkg` files are produced and served correctly (Windows delta updates).

## Sign-Off

- Name: ___________________
- Date: ___________________
- Release tag about to be published: v____.____.____

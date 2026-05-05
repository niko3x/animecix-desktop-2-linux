# Release Runbook — AnimeciX Desktop v2

Follow these steps for every release. A release takes ~20–30 minutes of active time + ~15 minutes of CI wait.

**Repository:** https://github.com/CaptainSP/animecix-desktop-2
**CI Workflow:** `.github/workflows/release.yml` — triggered automatically on `v*.*.*` tag push

---

## 0. Prerequisites (once per release)

- [ ] Complete `PRE-SHIP-SECURITY-CHECKLIST.md` (first release only — re-read every time).
- [ ] Confirm `main` branch is green (CI passing on latest commit).
- [ ] Confirm no in-flight downloads or caches in your local dev app — avoid accidental lock files.
- [ ] Confirm your local `main` is up to date: `git pull origin main`.

---

## 1. Bump version

```bash
# Choose one: patch / minor / major
npm version patch --no-git-tag-version
# Or for a specific version:
npm version 1.2.3 --no-git-tag-version

git add package.json package-lock.json
git commit -m "chore: bump version to v$(node -p "require('./package.json').version")"
git push origin main
```

> The `--no-git-tag-version` flag prevents `npm version` from creating a tag automatically — tagging is done manually in step 2 so you can verify CI is clean first.

---

## 2. Tag the release

```bash
VERSION=$(node -p "require('./package.json').version")
git tag -a "v${VERSION}" -m "Release v${VERSION}"
git push origin "v${VERSION}"
```

The tag push triggers `.github/workflows/release.yml` automatically.

**Pre-push sanity check** (optional but recommended):

```bash
# Verify locally that the tag will pass the CI guard
GITHUB_REF_NAME="v${VERSION}" node scripts/verify-tag.mjs
```

---

## 3. Watch CI

- Visit the **Actions** tab at https://github.com/CaptainSP/animecix-desktop-2/actions — find the "Release" workflow run.
- Expect both `macos-14` and `windows-latest` matrix legs to complete in 10–15 min each.
- The legs run independently (`fail-fast: false`) — one failing does not cancel the other.

**Troubleshooting:**

| Symptom | Cause | Fix |
|---------|-------|-----|
| `verify-tag` step fails | Tag doesn't match `package.json` version | Delete tag: `git tag -d v${VERSION} && git push origin :refs/tags/v${VERSION}`, fix version, re-tag |
| Signing hangs on macOS | Keychain ACL issue | Confirm `-T /usr/bin/codesign -T /usr/bin/productbuild` flags still present in workflow |
| Notarization fails "Invalid credentials" | ASC API key rotated or expired | Regenerate `.p8` key in App Store Connect, re-encode as base64, update `APPLE_API_KEY` secret |
| `npm ci` fails | `package-lock.json` out of sync | Run `npm ci` locally, commit the updated lock file |
| Windows build fails on native rebuild | `electron-rebuild` issue | Check that `better-sqlite3` version matches the Electron version |

---

## 4. Verify draft release artifacts

Visit https://github.com/CaptainSP/animecix-desktop-2/releases — open the new **draft** release. Confirm these **7 assets** are attached:

| Asset | Platform | Purpose |
|-------|----------|---------|
| `AnimeciX-<ver>-universal-mac.zip` | macOS | Auto-update channel artifact |
| `AnimeciX-<ver>.dmg` | macOS | First-install experience (drag-to-Applications) |
| `latest-mac.yml` | macOS | electron-updater manifest (SHA512 of .zip) |
| `AnimeciX-<ver> Setup.exe` | Windows | Squirrel installer |
| `AnimeciX-<ver>-full.nupkg` | Windows | Squirrel delta source package |
| `RELEASES` | Windows | Squirrel index file |
| `latest.yml` | Windows | electron-updater manifest (SHA512 of Setup.exe) |

If any asset is missing: use the "Re-run failed jobs" button in GitHub Actions to rerun only the failing matrix leg.

---

## 5. Smoke test on clean machines

Perform these on a machine with no Xcode developer tools or local dev environment installed.

- [ ] **macOS** — Download `AnimeciX-<ver>.dmg` on a clean macOS 14+ VM or second machine:
      1. Mount the DMG, drag `AnimeciX.app` to `/Applications`.
      2. Open `/Applications/AnimeciX.app`.
      3. Confirm the first launch shows only "Are you sure you want to open this application downloaded from the internet?" — not "cannot be opened because developer cannot be verified".
      4. Run: `spctl --assess --type execute --verbose "/Applications/AnimeciX.app"` — expected output: `accepted; source=Notarized Developer ID`
      5. Confirm the app loads animecix.tv successfully.

- [ ] **Windows** — Download `AnimeciX-<ver> Setup.exe` on a clean Windows 10/11 VM:
      1. Double-click the installer.
      2. Confirm "Windows protected your PC" SmartScreen dialog appears.
      3. Click "More info" → "Run anyway".
      4. Confirm the app appears in the Start menu.
      5. Launch. Confirm the app loads animecix.tv.

> **Note on SmartScreen:** The unsigned Windows binary will always show this warning until a Windows EV/OV code-signing certificate is acquired (deferred per D-07). This is expected behavior — document it in the release notes.

---

## 6. Edit release notes

In the draft release on GitHub:

1. Review the auto-generated changelog (enabled via `generateReleaseNotes: true` in `forge.config.ts`).
2. Trim or rewrite as needed. Add migration notes if any breaking changes.
3. Confirm the version in the release title matches the tag (`v${VERSION}`).
4. Add a note about Windows SmartScreen bypass instructions for first-time installers.
5. Sign off on `PRE-SHIP-SECURITY-CHECKLIST.md` (name, date, tag) and commit the signed checklist.

---

## 7. Publish

Click **Publish release** in the GitHub UI (the green button in the draft release editor). This:

- Flips `draft: false` → the release becomes public.
- Within 30 seconds to 4 hours, running instances of the previous version will call `checkForUpdates` and start downloading in the background.
- Users will see the in-app banner **"Yeni sürüm hazır"** with **"Şimdi yeniden başlat"** / **"Sonra"** buttons when the download finishes.

> **Manual check trigger:** Users can also right-click the tray icon → **"Güncellemeleri kontrol et"** to force an immediate check.

---

## 8. Post-publish verification

- [ ] On a machine with the **previous version** installed, wait up to 4 hours or trigger a manual check via the tray menu's **"Güncellemeleri kontrol et"** item.
- [ ] Confirm the **"Yeni sürüm hazır"** banner appears in the main window.
- [ ] Click **"Şimdi yeniden başlat"**. Confirm the app quits and relaunches as the new version.
- [ ] On macOS: `spctl --assess` should still pass on the updated `.app`.

---

## 9. Monitor for 24 hours

- Check GitHub Issues for update-related bug reports (crash on launch, updater loop, etc.).
- If a critical regression is discovered post-publish:
  1. "Unpublish" the release immediately (removes it from the electron-updater feed without deleting artifacts).
  2. Tag a patch version that reverts the bad commit.
  3. Let the CI pipeline produce a new draft; review and publish the patch.

---

## Rollback

There is **no true rollback** — once published, electron-updater begins delivering the update to installed apps. To mitigate a bad release:

1. **Immediately unpublish** the GitHub Release (keeps artifacts, removes from updater feed). Users mid-download will fail gracefully; users already updated are on the bad version.
2. **Tag a revert commit** (`git revert HEAD && git push origin main`).
3. **Bump version** to the next patch level.
4. **Let CI produce a new draft**, review it, publish. electron-updater will deliver the patch on the next check cycle (up to 4 hours).

> There is no mechanism to force users back to an older version. Patch forward immediately.

---

## Quick Reference — Tag Commands

```bash
# Create and push a release tag
VERSION=$(node -p "require('./package.json').version")
git tag -a "v${VERSION}" -m "Release v${VERSION}"
git push origin "v${VERSION}"

# Delete a tag (before it's publicly released)
git tag -d "v${VERSION}"
git push origin ":refs/tags/v${VERSION}"

# Dry-run tag (for pipeline testing without affecting main)
git checkout -b release-dry-run
npm version 0.0.0-rc1 --no-git-tag-version
git commit -am "chore: dry-run bump"
git tag v0.0.0-rc1
git push origin v0.0.0-rc1
# Cleanup after dry-run:
git push origin :refs/tags/v0.0.0-rc1
git checkout main
git branch -D release-dry-run
```

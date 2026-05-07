# Shipping uso.ai as an "official" macOS menu bar app

**Linear:** [TOK-57](https://linear.app/mijeong-irene-ban/issue/TOK-57/research-path-to-making-usoai-an-official-menu-bar-app-auto-launch-on)
**Date:** 2026-05-07
**Author:** mijeong + Claude

## TL;DR

- **Recommended path:** Apple Developer Program (Individual, $99/yr) → Developer ID Application cert → notarized DMG on the website → Homebrew cask. Skip the Mac App Store.
- **Total upfront cost:** $99. **Total recurring:** $99/yr.
- **Engineering effort:** ~15–25h active work, 1–2 weeks calendar (gated on Apple enrollment + Homebrew review).
- **Auto-launch:** drop `tauri-plugin-autostart` and call `SMAppService.loginItem` directly — the plugin still uses LaunchAgent plists, which produce an awkward "Allow in the Background" notification instead of a proper Login Items entry.

## Why not the Mac App Store

App Review §5.2.2 requires explicit authorization from any third-party service whose API you call. uso.ai scrapes internal/unofficial endpoints of Claude, ChatGPT, Cursor, Copilot, and Gemini — none of which we have permission to use that way. MAS submission is a near-certain rejection. Don't spend time here.

(Sandboxed apps *can* make outbound HTTP to arbitrary domains via `com.apple.security.network.client`, so the technical path exists — the blocker is policy, not capability.)

## 1. Apple Developer Program

| | Individual | Organization |
|---|---|---|
| Cost | $99/yr | $99/yr |
| Verification | ID (passport/license) | D-U-N-S Number + verification call |
| Timeline | Same-day to 48h | 1–3 weeks (D-U-N-S lookup + Apple call) |
| App publisher name | Personal/legal name | Legal entity name |

**For uso.ai:** enroll **Individual**. Only the account holder can mint Developer ID certs; that's fine for a solo project and avoids the D-U-N-S delay.

Source: [developer.apple.com/support/compare-memberships](https://developer.apple.com/support/compare-memberships/)

## 2. Code signing

- **Cert type:** **Developer ID Application** (for direct distribution / Homebrew). Free with the Dev Program — no HSM or Yubikey required, unlike Windows EV certs.
- **Tauri v2 config** ([`src-tauri/tauri.conf.json`](../../src-tauri/tauri.conf.json)):
  ```json
  "bundle": {
    "macOS": {
      "signingIdentity": "Developer ID Application: <Name> (<TEAMID>)",
      "hardenedRuntime": true,
      "entitlements": "macos/entitlements.plist",
      "minimumSystemVersion": "13.0"
    }
  }
  ```
  Or use `APPLE_SIGNING_IDENTITY` env var in CI.
- **Required entitlements** for Tauri's WebView (JIT):
  - `com.apple.security.cs.allow-jit`
  - `com.apple.security.cs.allow-unsigned-executable-memory` (some WebKit code paths)
- **`LSUIElement` apps** need no special signing entitlements. It's a plain `Info.plist` boolean and is transparent to the signing toolchain.

Source: [v2.tauri.app/distribute/sign/macos](https://v2.tauri.app/distribute/sign/macos/)

## 3. Notarization

- **Tool:** `xcrun notarytool` (Xcode 13+). `altool` was retired November 2023.
- **Auth (pick one):**
  - **App Store Connect API key** (recommended for CI): `.p8` private key + Key ID + Issuer ID. No 2FA, scoped, easy to rotate.
  - **App-specific password**: `APPLE_ID` + `APPLE_PASSWORD` + `APPLE_TEAM_ID`. Simplest for a first manual run.
- **Turnaround:** typically 2–15 minutes for a Tauri-sized bundle. Apple's stated SLA is "minutes to a few hours" but episodic stalls happen — set CI timeouts at ≥60 min.
- **Stapling:** `xcrun stapler staple Uso.app` and the `.dmg`. Without stapling, first launch needs network access to verify with Apple.
- **Tauri integration:** `tauri build` runs sign + notarize + staple automatically when these env vars are present. CI secrets needed:
  - `APPLE_CERTIFICATE` (base64 `.p12`) + `APPLE_CERTIFICATE_PASSWORD`
  - `APPLE_API_ISSUER` + `APPLE_API_KEY` + `APPLE_API_KEY_PATH` (or the app-specific-password trio)
  - `APPLE_SIGNING_IDENTITY`

## 4. Auto-launch at login

**Modern API:** `SMAppService.loginItem` — macOS 13+. User sees a single "Uso was added to login items" notification and can toggle in **System Settings → General → Login Items & Extensions**. This is the path that feels native.

**The wart:** `tauri-plugin-autostart` does **not** use `SMAppService`. It wraps the `auto-launch` crate which writes `~/Library/LaunchAgents/<bundle-id>.plist`. macOS surfaces these under "Allow in the Background" instead of the friendly Login Items list, and uninstalling the app leaves an orphan plist. Open issue tracking the migration: [tauri-apps/plugins-workspace#634](https://github.com/tauri-apps/plugins-workspace/issues/634) — no merged PR yet.

**Recommended fix:** call `SMAppService.mainApp.register()` directly from a Tauri command (binding via `objc2` or the [`smappservice-rs`](https://crates.io/crates/smappservice-rs) crate). ~4–8h to swap, including a Settings UI toggle. Worth it for the polish.

Sources: [SMAppService docs](https://developer.apple.com/documentation/servicemanagement/smappservice), [tauri-plugin-autostart source](https://github.com/tauri-apps/plugins-workspace/blob/v2/plugins/autostart/src/lib.rs)

## 5. Distribution paths — verdicts

| Path | Verdict | Notes |
|---|---|---|
| **Direct DMG download** | ✅ primary | Signed + notarized + stapled = zero Gatekeeper warnings. Standard "from the internet" quarantine prompt only. |
| **Homebrew cask** | ✅ secondary | One PR to [`homebrew/homebrew-cask`](https://github.com/Homebrew/homebrew-cask), then `livecheck` auto-bumps from GitHub Releases. Homebrew now **requires** signed+notarized artifacts (deadline Sept 1 2026). |
| **Mac App Store** | ❌ blocked | Guideline §5.2.2 — we don't have authorization from Anthropic / OpenAI / Cursor / GitHub / Google to call their internal APIs. |
| **`tauri-plugin-updater`** | ✅ for in-place updates | Tauri's own updater (Ed25519-signed bundles, separate from Apple Developer ID). Update artifact is `.app.tar.gz`, not the DMG. Bundle still has to be Apple-signed+notarized to pass Gatekeeper after replacement. |
| **Sparkle** | ⚠️ not needed | Tauri ships its own updater; don't introduce a second one. |

## 6. Cost summary

| Item | Cost |
|---|---|
| Apple Developer Program | $99/yr (recurring) |
| Developer ID Application cert | $0 (included) |
| Notarization (unlimited) | $0 (included) |
| Homebrew cask hosting | $0 |
| **Total upfront** | **$99** |
| **Total recurring** | **$99/yr** |

## 7. Timeline (solo dev)

| Phase | Hours | Wall time |
|---|---|---|
| Apple Dev enrollment (Individual) | 0.5h work | 1–3 days wait |
| Generate Developer ID cert | 0.5h | — |
| Wire Tauri signing config + entitlements | 1–2h | — |
| First successful local signed+notarized build | 2–4h | — |
| GH Actions release workflow (sign + notarize + upload DMG) | 3–6h | — |
| Tauri updater keypair + `latest.json` flow | 2–4h | — |
| Replace `tauri-plugin-autostart` with `SMAppService` | 4–8h | — |
| Homebrew cask PR | 1–2h | 1–5 days review |
| **Total active engineering** | **~15–25h** | **~1–2 weeks** |

## 8. Recommended sequencing

1. Enroll in Apple Developer Program (Individual). Block on this; ~1–3 days.
2. Land a signed + notarized DMG via GH Actions on tag push. The marketing site at `web/` already pulls the latest release URL from GitHub — it'll Just Work once the DMG is signed.
3. Ship `tauri-plugin-updater` so existing users get future builds without redownloading.
4. Replace `tauri-plugin-autostart` with `SMAppService`. Add a Settings toggle: "Launch at login."
5. Submit Homebrew cask PR.

## Confidence flags

- **High:** Apple Dev Program structure, notarytool workflow, Tauri config, Homebrew Sept 2026 signing deadline, MAS network-entitlement behavior.
- **Medium:** notarization turnaround in 2026 (advertised "minutes" SLA, real-world stalls reported).
- **Lower:** whether `tauri-plugin-autostart` will migrate to `SMAppService` upstream — track [#634](https://github.com/tauri-apps/plugins-workspace/issues/634). MAS rejection on §5.2.2 grounds is inferred, not a public Apple precedent — though the policy text is unambiguous.

## Sources

- [Apple — Choosing a Membership](https://developer.apple.com/support/compare-memberships/)
- [Apple — Enrollment Help](https://developer.apple.com/help/account/membership/program-enrollment)
- [Apple — App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Apple — `notarytool` man page](https://keith.github.io/xcode-man-pages/notarytool.1.html)
- [Apple — Customizing the notarization workflow](https://developer.apple.com/documentation/security/customizing-the-notarization-workflow)
- [Apple — `SMAppService`](https://developer.apple.com/documentation/servicemanagement/smappservice)
- [Tauri v2 — macOS Code Signing](https://v2.tauri.app/distribute/sign/macos/)
- [Tauri v2 — Updater plugin](https://v2.tauri.app/plugin/updater/)
- [Tauri v2 — Autostart plugin](https://v2.tauri.app/plugin/autostart/)
- [Homebrew — Notarisation discussion / Sept 2026 deadline](https://github.com/orgs/Homebrew/discussions/4582)
- [Homebrew — Cask Cookbook](https://docs.brew.sh/Cask-Cookbook)
- [`smappservice-rs` crate](https://crates.io/crates/smappservice-rs)

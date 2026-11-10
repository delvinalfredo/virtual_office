# Hallmark in claude-agent-kit

Upstream: https://github.com/Nutlope/hallmark, v2.0.0, commit 7ec868225c6caa040558c321ee0fefa0e73f83a8 (2026-10-22), MIT licence (`LICENSE`, unchanged).

## Changes from upstream

| File | Change | Why |
| --- | --- | --- |
| `SKILL.md` | New description; "claude-agent-kit adaptation" section; Floor 16 also runs `kitlint.mjs` | Entered through ui-ux-pro-max; offline-safe; kit house rules |
| `scripts/theme.mjs` | `photos` returns a slot instruction unless `HALLMARK_ALLOW_NETWORK=1` | Library photos hotlink/download from Wikimedia Commons |
| `scripts/kitlint.mjs` | New | Font CDN, remote assets, favicon, indigo/violet default |
| `scripts/imagegen.mjs` | Removed | Calls the Together AI image API |
| `scripts/install.mjs` | Removed | Installs into the global `~/.claude`; the kit is project-local |
| `agents/openai.yaml` | Removed | Codex only |
| every theme file in `references/themes/` | Each Build hint's Google Fonts/Fontshare `<link>` replaced by a `<!-- Self-host, no CDN: ... -->` list of families and `@fontsource` packages | Kit bans font CDNs (smoke-test.cjs); `kitlint` K1 fails any that ship |
| `references/fonts.md` | Sources section rewritten for self-hosting | Same |

## Updating

Re-copy `skills/hallmark/` from upstream, then reapply the table above. `node scripts/kitlint.mjs` and `node scripts/sloplint.mjs scripts/fixtures/slopped.html` should both run.

## Dependencies

- Node 18+ for `theme.mjs`, `sloplint.mjs`, `kitlint.mjs`.
- `sloplint --render` and `capture.mjs` need `puppeteer-core` (or `puppeteer`) plus a local Chrome/Chromium: `npm i -g puppeteer-core`, and `CHROME_PATH` if Chrome is not in a standard location (on Windows, e.g. `C:\Program Files\Google\Chrome\Application\chrome.exe`). Without them, sloplint runs its static tier and says the render tier did not run.

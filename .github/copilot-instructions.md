# Copilot instructions for this portfolio codebase

## Big picture
- This is a static, browser-only portfolio (no build step, no package manager, no backend).
- Main entry is `index.html`; styles are centralized in `css/style.css`; behavior is split across plain JS files in `js/`.
- Project detail pages in `projects/` reuse the same CSS + scripts and follow a shared block structure (`.project-block`, `.script-box`, `.media-placeholder`).

## Runtime architecture and data flow
- `js/theme.js` is global UI state: creates floating theme toggle, writes `portfolio_theme` in `localStorage`, and sets `data-theme` on `<html>`.
- `js/main.js` handles home-page UX: smooth-scroll nav, section active state (IntersectionObserver), and project tile click routing.
- `js/admin.js` is a full in-browser CMS layer:
  - unlock via profile image 5-click or `Ctrl+Alt+A`
  - toggles `contenteditable`, adds admin panel, edits media/links/text, and persists page snapshots
  - restores snapshots on load before runtime init (`restoreSnapshot()` then `initAdminRuntime()`)
- `js/project.js` and `js/script-viewer.js` provide copy-to-clipboard flows for scripts.
- `js/dynamic-project.js` renders `projects/dynamic-project.html?id=<projectId>` from `portfolio_dynamic_projects` in `localStorage`.

## Persistence model (important)
- Admin persistence is browser storage, not files:
  - `portfolio_page_snapshot_*` = serialized `header/main/footer/.resume` HTML
  - `portfolio_remove_history_*` = undo stack for removed tiles
  - `portfolio_dynamic_projects` = dynamic project records
  - `portfolio_hero_settings` = hero gradient/design settings
- Backup/import in admin panel exports/imports all `portfolio_*` keys as JSON.
- If UI changes seem ignored, stale snapshots in `localStorage` may be overriding your HTML edits.

## Developer workflow
- Recommended local run: `python -m http.server 8000` from repo root, then open `http://localhost:8000`.
- No automated tests/lint tasks are defined in this repo.
- Validate changes manually in browser on:
  - `index.html`
  - one static project page (for shared project layout)
  - `projects/dynamic-project.html?id=<known-id>` (if dynamic project logic changed)
  - `resume.html` (has page-specific style overrides)

## Project-specific coding conventions
- Keep script include order stable on pages: theme first, page logic next, admin last.
- Reuse existing CSS variables/tokens in `:root` and `:root[data-theme="dark"]`; avoid introducing unrelated color systems.
- For new project cards, preserve `.project-link > .card` structure and update both routing heuristics if needed:
  - `resolveProjectHref` in `js/main.js`
  - `resolveStaticProjectHrefFromTitle` in `js/admin.js`
- Project script viewer only accepts `?file=projects/*.txt` (sanitized in `js/script-viewer.js`); keep this guard intact.
- Admin edits intentionally use prompts/alerts and direct DOM mutation; match this style rather than adding framework-style state layers.

## High-value files to inspect before major edits
- `index.html`
- `css/style.css`
- `js/admin.js`
- `js/main.js`
- `projects/dynamic-project.html`
- `resume.html`

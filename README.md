Neeraj Verma — Portfolio

Static, browser-only portfolio (no build step, no package manager, no backend).

## Key files
- `index.html` — homepage and primary sections
- `resume.html` — dynamic printable resume subpage
- `css/style.css` — shared styles and theme tokens
- `js/theme.js` — light/dark theme toggle + persistence
- `js/main.js` — homepage interactions and navigation
- `js/admin.js` — admin unlock/edit runtime + snapshot persistence

## Run locally
Use a local server from project root:

```powershell
cd "C:\Users\Neeraj\Desktop\portfolio-index -1 (2)"
python -m http.server 8000
```

Open:
- `http://localhost:8000/index.html`
- `http://localhost:8000/resume.html`

## Current behavior
- Home buttons use `Resume` label (not `Download Resume`).
- Resume page includes `Print Resume` and `Compact Print` controls.
- Resume content loads from portfolio data first when no saved resume snapshot exists.
- If resume was edited in admin mode and saved, the edited snapshot is shown.
- Resume editing is only available in admin mode (unlock via profile 5-click or `Ctrl+Alt+A`, then key).

## Persistence model
Data is saved in browser `localStorage` under `portfolio_*` keys, including page snapshots:
- `portfolio_page_snapshot_*`
- `portfolio_remove_history_*`
- `portfolio_dynamic_projects`
- `portfolio_hero_settings`

If UI changes seem missing, clear or update stale `portfolio_*` entries.


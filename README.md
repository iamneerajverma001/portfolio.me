Neeraj Verma — Portfolio

Files created:
- index.html — main site
- css/style.css — styling
- js/main.js — small interactions (smooth scroll, mobile nav)
 - resume.html — printable resume (auto-opens print dialog)

How to run locally
1. Open `index.html` in your browser. For full functionality, serve from a local server:

   Python 3:

```powershell
cd "C:\Users\Neeraj\Desktop\portfolio-index"; python -m http.server 8000
```

Then open http://localhost:8000 in your browser.

What I included
- Responsive layout (desktop → mobile)
- Navigation with active underline and neon-teal hover glow
- Hero banner with gradient and circuit overlay
- About section (two-column)
- Projects grid with hover zoom and color-coded labels
- Research timeline styled with orange dates
- Skills icon grid with teal hover glow
- Footer with contact email + social icons
- Fonts: Montserrat, Poppins, Lato via Google Fonts

- Printable resume: open `resume.html` and use the print dialog to save as PDF or print directly.

Next steps you might want
- Replace the placeholder SVG portrait with a real photo in `about-photo`.
- Add project detail pages or modal popups.
- Add PDF resume download and contact form handling (SMTP or Form backend).
- Improve accessibility labels and add `rel="noopener"` to external links.

If you want, I can now:
- Add a printable resume / "Export to PDF" button
- Wire an Excel export for enrollment data (separate task)
- Convert the design into a React app or a deployable static site

Project media (image/video) behavior
- Static and dynamic project pages now auto-load media in the Project Image / Project Video sections.
- Loader source priority:
   1) path found in each `.media-note`
   2) dynamic id from URL (`projects/dynamic-project.html?id=<id>`)
   3) slug derived from project title (`<h1>`)
- Supported image formats: `.jpg`, `.jpeg`, `.png`, `.webp`, `.avif`
- Supported video formats: `.mp4`, `.webm`, `.mov`, `.m4v`

Where to store files
- Images: `images/projects/`
- Videos: `videos/projects/`

Recommended naming
- Dynamic project: `images/projects/<project-id>.<ext>` and `videos/projects/<project-id>.<ext>`
- Static project: `images/projects/<project-slug>.<ext>` and `videos/projects/<project-slug>.<ext>`

Admin mode storage note
- If media is uploaded using Admin tools, it is stored in browser `localStorage` snapshots (Data URL), not as physical files.
- Auto-loader does not override already inserted admin media.

Admin mode + cross-device sync (new)
- Admin unlock is available on `file:`, `http:`, and `https:` pages.
- Admin changes still save locally first, but you can now sync them across devices using GitHub Gist cloud sync.
- Cloud sync is now predefined and starts automatically on page load (default auto-pull: 5s).
- In Admin panel:
   - `Drive Upload` → set Google Drive upload endpoint/secret once (stored in synced portfolio data)
   - `Push Now` → publish current site state to cloud
   - `Pull Now` → update this device from cloud
   - `Reset Sync` → restore predefined sync defaults on this device
   - Inline text edits in Admin mode auto-save automatically and get included in auto-push (no manual Save required)
   - `Set Image/Video/Audio` supports hosted URL or direct upload to Google Drive (when configured)
- Recommended for best results:
   - Use a **private gist** for sync data.
   - Enable auto-pull on all viewing devices.
   - Enable Drive Upload endpoint once so tokenless auto-push can use Apps Script relay.
   - With predefined sync enabled, edits (text, styles, media, tiles, timeline, hero settings) sync across devices automatically.
- Upload safety limits are enforced to reduce browser storage failures:
   - Image: 2MB
   - Video: 3MB
   - Audio: 2MB
   - Other: 2MB

Google Drive upload during edit (image/video/audio)
- Goal: when you attach media in Admin edit mode, file uploads to your Google Drive and all devices receive the shared URL via sync.
- Step 1: Deploy Google Apps Script backend
   - Open [google-drive/AppsScript.gs](google-drive/AppsScript.gs)
   - Create a new Google Apps Script project and paste this code
   - Fill constants in that file: `UPLOAD_SECRET`, `IMAGE_FOLDER_ID`, `VIDEO_FOLDER_ID`, `AUDIO_FOLDER_ID`, `OTHER_FOLDER_ID`
   - Deploy as Web App:
     - Execute as: **Me**
     - Who has access: **Anyone** (or Anyone with Google account)
   - Copy the Web App URL
- Step 2: Configure this portfolio frontend
   - In Admin mode, click `Drive Upload`
   - Paste your deployed Web App URL and `UPLOAD_SECRET`
   - Save once; this config is synced and can be pulled on other devices
- Runtime behavior
   - During `Set Image/Video/Audio` file upload, media is uploaded to Drive first, then stored as remote URL in page snapshot.
   - Cloud sync push/pull can run through Apps Script relay, so no GitHub PAT is required in frontend code.
   - For Google Drive links, playback URL is normalized to Drive `uc?export=download&id=...` format.
   - Videos load via URL and the browser requests data progressively using HTTP range requests when supported.

Go live (GitHub Pages)
- This repo now includes automated deploy workflow: [.github/workflows/deploy-pages.yml](.github/workflows/deploy-pages.yml)
- Push changes to `main`; GitHub Actions deploys the static site to Pages automatically.
- In GitHub repo settings:
   - `Settings → Pages → Source`: set to **GitHub Actions**
   - Ensure Actions are enabled for the repository
- Optional custom domain:
   - Add your domain in `Settings → Pages`
   - Add DNS records as instructed by GitHub

Repo update checklist
- Commit and push all local changes.
- Open `Actions` tab and confirm `Deploy static site to Pages` succeeds.
- Open the generated Pages URL and verify: home page, one project page, and media upload from Admin mode.

Security note
- If any token/secret was ever committed, rotate it after going live and replace it in your local config.


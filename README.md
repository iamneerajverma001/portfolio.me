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


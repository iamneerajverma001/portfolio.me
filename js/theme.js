(function () {
  const THEME_KEY = 'portfolio_theme';

  function getThemeIconSvg(theme) {
    if (theme === 'dark') {
      return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 4.5a1 1 0 0 1 1 1V7a1 1 0 1 1-2 0V5.5a1 1 0 0 1 1-1Zm0 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7.5-3.5a1 1 0 0 1 1 1 1 1 0 0 1-1 1H18a1 1 0 1 1 0-2h1.5ZM6 12a1 1 0 1 1 0 2H4.5a1 1 0 1 1 0-2H6Zm10.243-5.657a1 1 0 0 1 1.414 0l1.06 1.06a1 1 0 1 1-1.414 1.414l-1.06-1.06a1 1 0 0 1 0-1.414ZM5.283 16.303a1 1 0 0 1 1.414 0l1.06 1.06a1 1 0 0 1-1.414 1.414l-1.06-1.06a1 1 0 0 1 0-1.414Zm12.374 2.474a1 1 0 0 1-1.414 0l-1.06-1.06a1 1 0 1 1 1.414-1.414l1.06 1.06a1 1 0 0 1 0 1.414ZM6.697 7.757a1 1 0 0 1-1.414 0l-1.06-1.06a1 1 0 1 1 1.414-1.414l1.06 1.06a1 1 0 0 1 0 1.414Z"/></svg>';
    }

    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20.742 14.045a1 1 0 0 0-1.155-.236 7.5 7.5 0 0 1-9.396-9.396 1 1 0 0 0-1.391-1.16A10 10 0 1 0 20.742 14.045Z"/></svg>';
  }

  function updateToggleVisual(toggle, theme) {
    toggle.innerHTML = getThemeIconSvg(theme);
    toggle.setAttribute('data-mode', theme);
  }

  function setTheme(theme) {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.classList.toggle('theme-dark', theme === 'dark');
    root.classList.toggle('theme-light', theme !== 'dark');
    localStorage.setItem(THEME_KEY, theme);

    const toggle = document.getElementById('theme-toggle');
    if (toggle) {
      updateToggleVisual(toggle, theme);
      toggle.setAttribute('title', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
      toggle.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
      toggle.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
    }
  }

  function currentTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
    return 'light';
  }

  function toggleTheme() {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    setTheme(next);
  }

  function ensureThemeToggle() {
    if (document.getElementById('theme-toggle')) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'theme-toggle';
    button.className = 'theme-toggle-btn theme-floating';
    button.setAttribute('contenteditable', 'false');
    button.setAttribute('aria-label', 'Switch theme');
    button.setAttribute('tabindex', '0');
    button.addEventListener('click', () => {
      toggleTheme();
    });

    button.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      toggleTheme();
    });

    document.body.appendChild(button);
    updateToggleVisual(button, currentTheme());
  }

  function initTheme() {
    ensureThemeToggle();
    const theme = currentTheme();
    setTheme(theme);

    document.addEventListener('click', (event) => {
      const toggle = event.target && event.target.closest ? event.target.closest('#theme-toggle') : null;
      if (!toggle) return;
      event.preventDefault();
      event.stopPropagation();
      toggleTheme();
    }, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTheme);
  } else {
    initTheme();
  }
})();

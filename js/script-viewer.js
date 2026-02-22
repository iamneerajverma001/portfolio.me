document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const file = params.get('file');

  const titleElement = document.getElementById('scriptTitle');
  const contentElement = document.getElementById('scriptContent');
  const copyButton = document.getElementById('copyViewerScript');
  const rawLink = document.getElementById('openRawScript');

  const isValidFile = typeof file === 'string'
    && file.startsWith('projects/')
    && file.endsWith('.txt')
    && !file.includes('..');

  if (!isValidFile) {
    contentElement.textContent = 'Invalid script file path.';
    copyButton.disabled = true;
    rawLink.removeAttribute('href');
    return;
  }

  const safeFile = file;
  rawLink.href = safeFile;

  const prettyName = safeFile
    .replace('projects/', '')
    .replace('-script.txt', '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

  titleElement.textContent = `${prettyName} Script`;

  fetch(safeFile)
    .then((response) => {
      if (!response.ok) {
        throw new Error('Failed to load script.');
      }
      return response.text();
    })
    .then((text) => {
      contentElement.textContent = text;
    })
    .catch(() => {
      contentElement.textContent = 'Unable to load script content.';
    });

  copyButton.addEventListener('click', async () => {
    const scriptText = contentElement.textContent || '';
    if (!scriptText || scriptText.includes('Unable to load')) return;

    const originalText = copyButton.textContent;
    try {
      await navigator.clipboard.writeText(scriptText);
      copyButton.textContent = 'Copied';
      copyButton.classList.add('copied');
    } catch (error) {
      copyButton.textContent = 'Copy Failed';
    }

    setTimeout(() => {
      copyButton.textContent = originalText;
      copyButton.classList.remove('copied');
    }, 1400);
  });
});

document.addEventListener('DOMContentLoaded', () => {
  const copyButtons = document.querySelectorAll('.copy-script-btn');

  copyButtons.forEach((button) => {
    button.addEventListener('click', async () => {
      const block = button.closest('.project-block');
      const scriptElement = block ? block.querySelector('.script-box pre') : null;
      if (!scriptElement) return;

      const originalText = button.textContent;
      try {
        await navigator.clipboard.writeText(scriptElement.textContent || '');
        button.textContent = 'Copied';
        button.classList.add('copied');
      } catch (error) {
        button.textContent = 'Copy Failed';
      }

      setTimeout(() => {
        button.textContent = originalText;
        button.classList.remove('copied');
      }, 1400);
    });
  });
});

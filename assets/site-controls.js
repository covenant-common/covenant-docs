// Shared controls used by pages that copy text or preview a sample deal.
(function (root) {
  async function copied(button, status, text) {
    try {
      if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') throw new Error('unavailable');
      await navigator.clipboard.writeText(text);
      if (button) button.textContent = 'Copied';
      if (status) status.textContent = 'Copied';
    } catch (error) {
      if (status) status.textContent = 'Automatic copy is unavailable. Select and copy the text shown.';
    }
  }
  root.CovenantControls = { copied: copied };
})(typeof globalThis !== 'undefined' ? globalThis : this);

(() => {
  'use strict';

  function escapeHtml(value = '') {
    return String(value).replace(/[&<>'"]/g, (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character],
    );
  }

  function createFeedback(document) {
    const q = (selector) => document.querySelector(selector);
    let toastTimer;

    const toast = q('#toast');
    const panelDialog = q('#panelDialog');
    const dialogKicker = q('#dialogKicker');
    const dialogTitle = q('#dialogTitle');
    const dialogBody = q('#dialogBody');

    function showToast(title, copy) {
      if (!toast) return;
      toast.innerHTML = `<b>${escapeHtml(title)}</b><small>${escapeHtml(copy)}</small>`;
      toast.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
    }

    function openPanel(kicker, title, html) {
      dialogKicker.textContent = kicker;
      dialogTitle.textContent = title;
      dialogBody.innerHTML = html;
      panelDialog.showModal();
    }

    document.querySelectorAll('[data-dialog-close]').forEach((button) =>
      button.addEventListener('click', () => button.closest('dialog')?.close()),
    );


    return Object.freeze({ escapeHtml, showToast, openPanel });
  }

  globalThis.AETHERGRID_LEGACY_UI = Object.freeze({ createFeedback });
})();

/**
 * Shared navbar behavior for authenticated pages.
 */
(function () {
  const pageMap = {
    '/analyze': 'AnalyzePage.html',
    '/history': 'HistoryPage.html',
    '/profile': 'ProfilePage.html',
  };

  function init(currentPath, options = {}) {
    const navButtons = document.querySelectorAll('.nav-button[data-path]');
    const logoutBtn = document.getElementById('logoutBtn');

    navButtons.forEach((button) => {
      const buttonPath = button.getAttribute('data-path');
      const isCurrent = buttonPath === currentPath;

      button.classList.toggle('active', isCurrent);
      if (isCurrent) {
        button.setAttribute('aria-current', 'page');
      } else {
        button.removeAttribute('aria-current');
      }

      button.addEventListener('click', () => {
        const targetPage = pageMap[buttonPath];
        if (targetPage && !isCurrent) {
          window.location.href = targetPage;
        }
      });
    });

    if (logoutBtn) {
      logoutBtn.addEventListener('click', options.onLogout || defaultLogout);
    }
  }

  function defaultLogout() {
    window.location.href = 'LandingPage.html';
  }

  window.CommentInsightNavbar = { init };
})();

/**
 * LandingPage - CommentInsight landing page
 */

function initializeLandingPage() {
  setupNavigation();
  setupScrollReveal();
  setupNavbarShadow();
}

function setupNavigation() {
  document.querySelectorAll('a[href="/login"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      window.location.href = '/login';
    });
  });

  document.querySelectorAll('a[href="/register"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      window.location.href = '/register';
    });
  });

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const targetId = link.getAttribute('href');
      const target = document.querySelector(targetId);

      if (!target) return;

      event.preventDefault();

      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  });
}

function setupScrollReveal() {
  const revealItems = document.querySelectorAll(
    '.feature-card, .workflow-card, .model-card, .model-performance-card, .about-layout, .about-shell'
  );

  revealItems.forEach((item) => {
    item.classList.add('reveal');
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.12,
      rootMargin: '0px 0px -40px 0px',
    }
  );

  revealItems.forEach((item) => {
    observer.observe(item);
  });
}

function setupNavbarShadow() {
  const navbar = document.querySelector('.navbar');

  if (!navbar) return;

  function updateNavbarShadow() {
    if (window.scrollY > 10) {
      navbar.classList.add('navbar-scrolled');
    } else {
      navbar.classList.remove('navbar-scrolled');
    }
  }

  updateNavbarShadow();
  window.addEventListener('scroll', updateNavbarShadow);
}

document.addEventListener('DOMContentLoaded', initializeLandingPage);
/* ============================================
   VitiTrack — Landing Page JavaScript
   Interactions, animations & micro-interactions
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {

  // ========== NAVBAR SCROLL EFFECT ==========
  const navbar = document.getElementById('navbar');
  let lastScroll = 0;

  const handleNavbarScroll = () => {
    const currentScroll = window.scrollY;
    if (currentScroll > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
    lastScroll = currentScroll;
  };

  window.addEventListener('scroll', handleNavbarScroll, { passive: true });

  // ========== MOBILE NAV TOGGLE ==========
  const navToggle = document.getElementById('nav-toggle');
  const navLinks = document.getElementById('nav-links');

  navToggle.addEventListener('click', () => {
    navToggle.classList.toggle('active');
    navLinks.classList.toggle('open');
    document.body.style.overflow = navLinks.classList.contains('open') ? 'hidden' : '';
  });

  // Close mobile nav when clicking a link
  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navToggle.classList.remove('active');
      navLinks.classList.remove('open');
      document.body.style.overflow = '';
    });
  });

  // ========== SMOOTH SCROLL FOR ANCHOR LINKS ==========
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const targetId = anchor.getAttribute('href');
      if (targetId === '#') return;

      e.preventDefault();
      const target = document.querySelector(targetId);
      if (target) {
        const navHeight = navbar.offsetHeight;
        const targetPosition = target.getBoundingClientRect().top + window.scrollY - navHeight;

        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        });
      }
    });
  });

  // ========== SCROLL REVEAL ANIMATIONS ==========
  const revealElements = document.querySelectorAll('.reveal');

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -60px 0px'
  });

  revealElements.forEach(el => revealObserver.observe(el));

  // ========== ANIMATED COUNTERS ==========
  const counterElements = document.querySelectorAll('[data-count]');

  const animateCounter = (element) => {
    const target = parseInt(element.getAttribute('data-count'));
    const duration = 2000;
    const startTime = performance.now();
    const suffix = element.closest('.hero-stat').querySelector('.hero-stat-label').textContent.includes('%') ? '%' : '+';

    const updateCounter = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(eased * target);

      element.textContent = current.toLocaleString('fr-FR') + (progress >= 1 ? suffix : '');

      if (progress < 1) {
        requestAnimationFrame(updateCounter);
      }
    };

    requestAnimationFrame(updateCounter);
  };

  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        counterObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  counterElements.forEach(el => counterObserver.observe(el));

  // ========== FAQ ACCORDION ==========
  const faqItems = document.querySelectorAll('.faq-item');

  faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');
    const answer = item.querySelector('.faq-answer');

    question.addEventListener('click', () => {
      const isActive = item.classList.contains('active');

      // Close all other items
      faqItems.forEach(otherItem => {
        if (otherItem !== item) {
          otherItem.classList.remove('active');
          otherItem.querySelector('.faq-answer').style.maxHeight = '0';
        }
      });

      // Toggle current item
      if (isActive) {
        item.classList.remove('active');
        answer.style.maxHeight = '0';
      } else {
        item.classList.add('active');
        answer.style.maxHeight = answer.scrollHeight + 'px';
      }
    });
  });

  // ========== FEATURE CARDS MOUSE GLOW ==========
  const featureCards = document.querySelectorAll('.feature-card');

  featureCards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      card.style.setProperty('--mouse-x', x + '%');
      card.style.setProperty('--mouse-y', y + '%');
    });
  });

  // ========== ACTIVE NAV LINK HIGHLIGHT ==========
  const sections = document.querySelectorAll('section[id]');
  const navAnchors = document.querySelectorAll('.nav-links a[href^="#"]');

  const highlightNav = () => {
    const scrollY = window.scrollY + 100;

    sections.forEach(section => {
      const sectionTop = section.offsetTop;
      const sectionHeight = section.offsetHeight;
      const sectionId = section.getAttribute('id');

      if (scrollY >= sectionTop && scrollY < sectionTop + sectionHeight) {
        navAnchors.forEach(a => {
          a.classList.remove('active');
          if (a.getAttribute('href') === '#' + sectionId) {
            a.classList.add('active');
          }
        });
      }
    });
  };

  window.addEventListener('scroll', highlightNav, { passive: true });

  // ========== PARALLAX HERO BACKGROUND ==========
  const heroBg = document.querySelector('.hero-bg img');

  const handleParallax = () => {
    if (window.scrollY < window.innerHeight) {
      const offset = window.scrollY * 0.3;
      heroBg.style.transform = `translateY(${offset}px) scale(1.05)`;
    }
  };

  window.addEventListener('scroll', handleParallax, { passive: true });

  // ========== TYPING EFFECT ON HERO BADGE ==========
  // Subtle pulse animation already handled by CSS

  // ========== ROUTING & AUTH HANDLERS ==========
  // Tous les accès applicatifs mènent au parcours officiel Supabase Auth sur login.html
  const directToAppOrLogin = (e) => {
    if (e) e.preventDefault();
    window.location.href = 'login.html';
  };

  const navLoginBtn = document.getElementById('nav-login-btn');
  const heroLoginBtn = document.getElementById('hero-login-btn');
  const navDashboardLink = document.querySelector('.nav-dashboard-link');
  const navCta = document.querySelector('.nav-cta');
  const heroPrimaryBtn = document.querySelector('.hero-actions .btn-primary');
  const previewLinks = document.querySelectorAll('.dashboard-cta-group a, .dashboard-visual-link');

  if (navLoginBtn) navLoginBtn.addEventListener('click', directToAppOrLogin);
  if (heroLoginBtn) heroLoginBtn.addEventListener('click', directToAppOrLogin);
  if (navDashboardLink) navDashboardLink.addEventListener('click', directToAppOrLogin);
  if (navCta) navCta.addEventListener('click', directToAppOrLogin);
  if (heroPrimaryBtn) heroPrimaryBtn.addEventListener('click', directToAppOrLogin);
  previewLinks.forEach(link => link.addEventListener('click', directToAppOrLogin));

  // ========== THEME TOGGLE (JOUR / NUIT) ==========
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const themeIcon = document.getElementById('theme-icon');

  const updateThemeUI = (theme) => {
    if (themeIcon) {
      themeIcon.textContent = theme === 'light' ? '🌙' : '☀️';
    }
    if (themeToggleBtn) {
      themeToggleBtn.setAttribute('title', theme === 'light' ? 'Basculer en Mode Nuit' : 'Basculer en Mode Jour');
      themeToggleBtn.setAttribute('aria-label', theme === 'light' ? 'Basculer en Mode Nuit' : 'Basculer en Mode Jour');
    }
  };

  const getSavedTheme = () => {
    try {
      const saved = localStorage.getItem('vititrack_theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch (e) {}
    return 'dark';
  };

  const setPageTheme = (theme, save = true) => {
    const activeTheme = theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', activeTheme);
    if (save) {
      try {
        localStorage.setItem('vititrack_theme', activeTheme);
      } catch (e) {}
    }
    updateThemeUI(activeTheme);
  };

  // Init theme UI
  const currentTheme = getSavedTheme();
  setPageTheme(currentTheme, false);

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      setPageTheme(current === 'light' ? 'dark' : 'light', true);
    });
  }

  // ========== PRELOAD INITIAL STATE ==========
  // Trigger initial checks
  handleNavbarScroll();
  highlightNav();

});

// ========== STRIPE SUBSCRIPTION HANDLER ==========
function handlePlanSelect(planId) {
  if (window.VitiTrackStripe && typeof window.VitiTrackStripe.startCheckout === "function") {
    window.VitiTrackStripe.startCheckout(planId);
  } else {
    try {
      localStorage.setItem("vititrack_pending_plan", planId);
    } catch (e) {}
    window.location.href = `login.html?plan=${encodeURIComponent(planId)}`;
  }
}
window.handlePlanSelect = handlePlanSelect;

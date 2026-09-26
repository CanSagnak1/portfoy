// ── LANG STATE (önce init edilmeli) ────────────────────────
let currentLang = localStorage.getItem('lang') || 'tr';

// ── TYPED TEXT ─────────────────────────────────────────────
const typedEl = document.getElementById('typed');
const phrases = {
  tr: [
    'iOS Developer (Swift / SwiftUI)',
    'Mobil Uygulama Geliştirici',
    'BLE & IoT Sistemleri',
    'Bilgisayar Mühendisliği Öğrencisi',
    'Clean Architecture Savunucusu',
  ],
  en: [
    'iOS Developer (Swift / SwiftUI)',
    'Mobile App Developer',
    'BLE & IoT Systems',
    'Computer Engineering Student',
    'Clean Architecture Advocate',
  ]
};
let phraseIdx = 0, charIdx = 0, deleting = false, typeTimer = null;

function typeLoop() {
  const pool = phrases[currentLang] || phrases.tr;
  if (phraseIdx >= pool.length) phraseIdx = 0;
  const current = pool[phraseIdx];
  if (deleting) {
    charIdx--;
    typedEl.textContent = current.slice(0, charIdx);
    if (charIdx === 0) {
      deleting = false;
      phraseIdx = (phraseIdx + 1) % pool.length;
      typeTimer = setTimeout(typeLoop, 400);
      return;
    }
    typeTimer = setTimeout(typeLoop, 40);
  } else {
    charIdx++;
    typedEl.textContent = current.slice(0, charIdx);
    if (charIdx === current.length) { deleting = true; typeTimer = setTimeout(typeLoop, 2200); return; }
    typeTimer = setTimeout(typeLoop, 70);
  }
}
typeTimer = setTimeout(typeLoop, 800);

// ── NAV SCROLL ─────────────────────────────────────────────
const nav = document.querySelector('nav');
const navLinks = document.querySelectorAll('.nav-links a');
const sections = document.querySelectorAll('section[id]');

window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 50);
  let current = '';
  sections.forEach(s => {
    if (window.scrollY >= s.offsetTop - 100) current = s.getAttribute('id');
  });
  navLinks.forEach(a => {
    a.classList.toggle('active', a.getAttribute('href') === '#' + current);
  });
});

// ── MOBILE MENU ────────────────────────────────────────────
const menuBtn = document.getElementById('menuBtn');
const mobileMenu = document.getElementById('mobileMenu');
const closeBtn = document.getElementById('closeMenu');

menuBtn.addEventListener('click', () => mobileMenu.classList.add('open'));
closeBtn.addEventListener('click', () => mobileMenu.classList.remove('open'));
mobileMenu.querySelectorAll('a').forEach(a => {
  a.addEventListener('click', () => mobileMenu.classList.remove('open'));
});

// ── SCROLL REVEAL ──────────────────────────────────────────
const reveals = document.querySelectorAll('.reveal, .reveal-left, .reveal-right');
const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
reveals.forEach(el => observer.observe(el));

// ── CONTACT FORM ───────────────────────────────────────────
document.getElementById('contactForm').addEventListener('submit', function(e) {
  e.preventDefault();
  const btn = this.querySelector('.form-submit');
  btn.textContent = currentLang === 'en' ? 'Sent ✓' : 'Gönderildi ✓';
  btn.style.background = '#238636';
  setTimeout(() => {
    btn.textContent = currentLang === 'en' ? 'Send Message →' : 'Mesaj Gönder →';
    btn.style.background = '';
    this.reset();
  }, 3000);
});

// ── LANG TOGGLE ────────────────────────────────────────────
const langBtns = document.querySelectorAll('.lang-btn');

function applyLang(lang) {
  currentLang = lang;
  localStorage.setItem('lang', lang);

  // body class → controls .tr-only / .en-only visibility
  document.body.classList.toggle('lang-en', lang === 'en');

  // simple text elements
  document.querySelectorAll('[data-tr]').forEach(el => {
    el.textContent = el.dataset[lang] || el.dataset.tr;
  });

  // input/textarea placeholders
  document.querySelectorAll('[data-placeholder-tr]').forEach(el => {
    el.placeholder = lang === 'en'
      ? (el.dataset.placeholderEn || el.dataset.placeholderTr)
      : el.dataset.placeholderTr;
  });

  // button active state
  langBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.lang === lang));
  document.documentElement.lang = lang;

  // typed text restart in new language
  clearTimeout(typeTimer);
  typedEl.textContent = '';
  phraseIdx = 0; charIdx = 0; deleting = false;
  typeTimer = setTimeout(typeLoop, 400);
}

langBtns.forEach(btn => {
  btn.addEventListener('click', () => applyLang(btn.dataset.lang));
});

// Sayfa açılışında kaydedilmiş dil
applyLang(currentLang);

// ── CODE COPY ───────────────────────────────────────────────
const copyBtn = document.getElementById('copyCode');
if (copyBtn) {
  copyBtn.addEventListener('click', () => {
    const code = document.querySelector('.code-body code').innerText;
    navigator.clipboard.writeText(code).then(() => {
      const copySpan = copyBtn.querySelector('span');
      copyBtn.classList.add('copied');
      copySpan.textContent = currentLang === 'en' ? 'Copied!' : 'Kopyalandı!';
      setTimeout(() => {
        copyBtn.classList.remove('copied');
        copySpan.textContent = currentLang === 'en' ? 'Copy' : 'Kopyala';
      }, 2000);
    });
  });
}

// ── EASTER EGG ─────────────────────────────────────────────
(function () {
  const avatar = document.querySelector('.about-avatar');
  if (!avatar) return;

  let clickCount = 0;
  let clickTimer = null;
  let eggActive = false;

  function buildOverlay() {
    if (document.getElementById('easter-egg-overlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'easter-egg-overlay';
    overlay.innerHTML = `
      <div class="egg-backdrop"></div>
      <div class="egg-card">
        <span class="egg-hearts">🧡 🤍 🧡</span>
        <div class="egg-text">Berfin, seni çok seviyorum 🧡</div>
        <div class="egg-sub">— Can 💛</div>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  function spawnFloatingHearts(overlay) {
    const emojis = ['🧡', '💛', '🤍', '🔥', '✨'];
    for (let i = 0; i < 8; i++) {
      setTimeout(() => {
        const h = document.createElement('span');
        h.className = 'egg-float-heart';
        h.textContent = emojis[Math.floor(Math.random() * emojis.length)];
        h.style.left = (Math.random() * 80 + 10) + '%';
        h.style.top  = (Math.random() * 40 + 30) + '%';
        h.style.animationDelay = '0s';
        h.style.animationDuration = (1.8 + Math.random() * 1.2) + 's';
        overlay.appendChild(h);
        h.addEventListener('animationend', () => h.remove());
      }, i * 160);
    }
  }

  function triggerEasterEgg() {
    if (eggActive) return;
    eggActive = true;
    buildOverlay();
    const overlay = document.getElementById('easter-egg-overlay');
    overlay.classList.remove('show');
    void overlay.offsetWidth;
    overlay.classList.add('show');
    spawnFloatingHearts(overlay);
    setTimeout(() => { overlay.classList.remove('show'); eggActive = false; }, 3800);
  }

  function handleTap(e) {
    if (e.type === 'touchstart') e.preventDefault();
    clickCount++;
    if (clickCount === 1) {
      clickTimer = setTimeout(() => { clickCount = 0; }, 600);
    }
    if (clickCount >= 3) {
      clearTimeout(clickTimer);
      clickCount = 0;
      triggerEasterEgg();
    }
  }

  avatar.addEventListener('click',      handleTap);
  avatar.addEventListener('touchstart', handleTap, { passive: false });
})();

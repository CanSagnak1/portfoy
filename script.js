// ── PARTICLES ──────────────────────────────────────────────
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let particles = [];
let mouse = { x: null, y: null };

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', () => { resize(); initParticles(); });
window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });

class Particle {
  constructor() { this.reset(); }
  reset() {
    this.x = Math.random() * canvas.width;
    this.y = Math.random() * canvas.height;
    this.size = Math.random() * 1.5 + 0.3;
    this.speedX = (Math.random() - 0.5) * 0.3;
    this.speedY = (Math.random() - 0.5) * 0.3;
    this.opacity = Math.random() * 0.5 + 0.1;
    this.color = Math.random() > 0.5 ? '#f97316' : '#fbbf24';
  }
  update() {
    this.x += this.speedX;
    this.y += this.speedY;
    if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) this.reset();
    if (mouse.x) {
      const dx = this.x - mouse.x, dy = this.y - mouse.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 100) {
        this.x += dx * 0.02;
        this.y += dy * 0.02;
      }
    }
  }
  draw() {
    ctx.save();
    ctx.globalAlpha = this.opacity;
    ctx.fillStyle = this.color;
    ctx.shadowBlur = 6;
    ctx.shadowColor = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function initParticles() {
  particles = [];
  const count = Math.min(Math.floor(canvas.width * canvas.height / 12000), 120);
  for (let i = 0; i < count; i++) particles.push(new Particle());
}

function drawConnections() {
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const dx = particles[i].x - particles[j].x;
      const dy = particles[i].y - particles[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 120) {
        ctx.save();
        ctx.globalAlpha = (1 - dist / 120) * 0.12;
        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(particles[i].x, particles[i].y);
        ctx.lineTo(particles[j].x, particles[j].y);
        ctx.stroke();
        ctx.restore();
      }
    }
  }
}

function animate() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawConnections();
  particles.forEach(p => { p.update(); p.draw(); });
  requestAnimationFrame(animate);
}

initParticles();
animate();

// ── TYPED TEXT ─────────────────────────────────────────────
const typedEl = document.getElementById('typed');
const phrases = [
  'iOS Developer (Swift / SwiftUI)',
  'Mobil Uygulama Geliştirici',
  'BLE & IoT Sistemleri',
  'Bilgisayar Mühendisliği Öğrencisi',
  'Clean Architecture Savunucusu',
];
let phraseIdx = 0, charIdx = 0, deleting = false;

function typeLoop() {
  const current = phrases[phraseIdx];
  if (deleting) {
    charIdx--;
    typedEl.textContent = current.slice(0, charIdx);
    if (charIdx === 0) { deleting = false; phraseIdx = (phraseIdx + 1) % phrases.length; setTimeout(typeLoop, 400); return; }
    setTimeout(typeLoop, 40);
  } else {
    charIdx++;
    typedEl.textContent = current.slice(0, charIdx);
    if (charIdx === current.length) { deleting = true; setTimeout(typeLoop, 2200); return; }
    setTimeout(typeLoop, 70);
  }
}
setTimeout(typeLoop, 800);

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
  btn.textContent = 'Gönderildi ✓';
  btn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
  setTimeout(() => {
    btn.textContent = 'Mesaj Gönder';
    btn.style.background = '';
    this.reset();
  }, 3000);
});

// ── EASTER EGG ─────────────────────────────────────────────
(function () {
  const avatar = document.querySelector('.about-avatar');
  if (!avatar) return;

  let clickCount = 0;
  let clickTimer = null;
  let eggActive = false;

  // Overlay'i oluştur (ilk seferinde)
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

    // Sıfırla ve yeniden başlat
    overlay.classList.remove('show');
    void overlay.offsetWidth; // reflow

    overlay.classList.add('show');
    spawnFloatingHearts(overlay);

    setTimeout(() => {
      overlay.classList.remove('show');
      eggActive = false;
    }, 3800);
  }

  function handleTap(e) {
    // touch olaylarında çift tetiklenmeyi önle
    if (e.type === 'touchstart') e.preventDefault();

    clickCount++;

    if (clickCount === 1) {
      clickTimer = setTimeout(() => {
        clickCount = 0; // zaman aşımında sıfırla
      }, 600);
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

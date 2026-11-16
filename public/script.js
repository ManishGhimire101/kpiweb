
async function loadComponent(targetId, url) {
  const root = document.getElementById(targetId);
  if (!root) return;

  try {
    const res = await fetch(url);
    if (!res.ok) return;
    root.innerHTML = await res.text();
  } catch (_) {

  }
}

window.siteBranding = fetch('/api/config')
  .then((r) => r.json())
  .then((c) => (c && c.institution ? c : null))
  .catch(() => null);

const PAGE_LABELS = {
  '/': '',
  '/notice': 'Notices',
  '/program': 'Programs',
  '/gallary': 'Gallery',
  '/staff': 'Staff',
  '/about': 'About us',
};

function initialsOf(name) {
  return String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

function applyTheme(inst) {
  if (!inst.themeColor) return;
  const root = document.documentElement.style;
  root.setProperty('--brand-primary', inst.themeColor);
  root.setProperty('--brand-secondary', `color-mix(in srgb, ${inst.themeColor} 82%, #ffffff)`);
}

function brandNav(inst) {
  const nav = document.getElementById('navbar-root');
  if (!nav) return;

  const title = nav.querySelector('.brand-text h1');
  const sub = nav.querySelector('.brand-text p');
  if (title) title.textContent = inst.name;
  if (sub) sub.textContent = inst.address || inst.type || '';

  const logoBox = nav.querySelector('.logo-box');
  if (logoBox) {
    logoBox.innerHTML = inst.logo
      ? `<img src="${escapeHtml(inst.logo)}" alt="${escapeHtml(inst.name)} logo" class="logo-image" />`
      : `<div class="logo-initials">${escapeHtml(initialsOf(inst.name))}</div>`;
  }

  const phone = nav.querySelector('a[aria-label="Contact"]');
  if (phone) {
    if (inst.phone) phone.href = `tel:${inst.phone.replace(/[^0-9+]/g, '')}`;
    else phone.remove();
  }

  const mail = nav.querySelector('a[aria-label="Email"]');
  if (mail) {
    if (inst.email) mail.href = `mailto:${inst.email}`;
    else mail.remove();
  }

  ['Facebook', 'Instagram', 'X', 'Share'].forEach((label) => {
    const el = nav.querySelector(`[aria-label="${label}"]`);
    if (el) el.remove();
  });

  const menu = nav.querySelector('.menu');
  if (menu && !menu.querySelector('.login-link')) {
    const li = document.createElement('li');
    li.innerHTML = '<a href="/login" class="login-link">Login</a>';
    menu.appendChild(li);
  }

  const label = PAGE_LABELS[location.pathname];
  document.title = label ? `${label} - ${inst.name}` : inst.name;
}

function brandFooter(inst) {
  const footer = document.getElementById('footer-root');
  if (!footer) return;

  const rows = [
    inst.address ? `<li><i class="fa-solid fa-location-dot"></i> ${escapeHtml(inst.address)}</li>` : '',
    inst.phone ? `<li><i class="fa-solid fa-mobile-screen-button"></i> ${escapeHtml(inst.phone)}</li>` : '',
    inst.email ? `<li><i class="fa-regular fa-envelope"></i> ${escapeHtml(inst.email)}</li>` : '',
    inst.website ? `<li><i class="fa-solid fa-globe"></i> <a href="${escapeHtml(inst.website)}" target="_blank" rel="noopener">${escapeHtml(inst.website)}</a></li>` : '',
  ].join('');

  footer.innerHTML = `
    <footer class="site-footer">
      <div class="footer-container">
        <section class="footer-col profile-col">
          ${
            inst.logo
              ? `<div class="profile-avatar has-logo"><img src="${escapeHtml(inst.logo)}" alt="${escapeHtml(inst.name)} logo" /></div>`
              : `<div class="profile-avatar" aria-hidden="true">${escapeHtml(initialsOf(inst.name))}</div>`
          }
          <h3 class="profile-name">${escapeHtml(inst.name)}</h3>
          <p class="profile-role">${escapeHtml(inst.type || '')}</p>
        </section>
        <section class="footer-col">
          <h4>Menus</h4>
          <ul>
            <li><a href="/notice"><span>→</span> Notices</a></li>
            <li><a href="/program"><span>→</span> Programs</a></li>
            <li><a href="/gallary"><span>→</span> Gallery</a></li>
            <li><a href="/staff"><span>→</span> Staff</a></li>
            <li><a href="/about"><span>→</span> About us</a></li>
          </ul>
        </section>
        <section class="footer-col">
          <h4>Portal</h4>
          <ul>
            <li><a href="/login"><span>→</span> Student / Teacher / Parent login</a></li>
          </ul>
        </section>
        <section class="footer-col">
          <h4>Contact</h4>
          <ul class="contact-list">${rows || '<li>Contact details coming soon</li>'}</ul>
        </section>
      </div>
    </footer>`;
}

loadComponent('navbar-root', '/component/nav.html').then(async () => {
  const b = await window.siteBranding;
  if (b) {
    applyTheme(b.institution);
    brandNav(b.institution);
  }
});

loadComponent('footer-root', '/component/footer.html').then(async () => {
  const b = await window.siteBranding;
  if (b) brandFooter(b.institution);
});

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(value) {
  try {
    return new Date(value).toLocaleString();
  } catch (_) {
    return '';
  }
}

async function fetchUploads(category) {
  const res = await fetch(`/api/admin/upload/${category}`);
  if (!res.ok) {
    throw new Error(`Failed to load ${category}`);
  }
  return res.json();
}

function buildExpandableText(text, id, limit = 160) {
  const safeText = escapeHtml(text || '');
  if (!safeText) {
    return '<p class="card-text">No details available.</p>';
  }

  if (safeText.length <= limit) {
    return `<p class="card-text">${safeText}</p>`;
  }

  const shortText = safeText.slice(0, limit);
  const hiddenText = safeText.slice(limit);

  return `
    <p class="card-text" id="${id}">
      <span>${shortText}</span><span class="more-text" hidden>${hiddenText}</span>
    </p>
    <button class="see-more-btn" type="button" data-target="${id}" data-expanded="false">See more</button>
  `;
}

async function loadNotices() {
  const list = document.getElementById('noticeList');
  if (!list) return;

  try {
    const data = await fetchUploads('notices');

    if (!Array.isArray(data) || data.length === 0) {
      list.innerHTML = '<p>No notices available.</p>';
      return;
    }

    list.innerHTML = data
      .map(
        (n) => `
          <article class="notice-card">
            ${n.imageUrl ? `<img src="${escapeHtml(n.imageUrl)}" alt="${escapeHtml(n.title || 'Notice image')}" class="notice-image" />` : ''}
            <h3 class="notice-title">${escapeHtml(n.title || 'Notice')}</h3>
            <div class="notice-date">${formatDate(n.createdAt)}</div>
            ${buildExpandableText(n.details, `notice-${n.id}`)}
          </article>
        `
      )
      .join('');
  } catch (_) {
    list.innerHTML = '<p>Failed to load notices.</p>';
  }
}

async function loadAbout() {
  const grid = document.getElementById('aboutGrid');
  if (!grid) return;

  try {
    const items = await fetchUploads('about');

    if (!Array.isArray(items) || items.length === 0) {
      grid.innerHTML = '<p class="empty-message">No about content found.</p>';
      return;
    }

    grid.innerHTML = items
      .map(
        (item) => `
          <article class="about-card">
            ${item.imageUrl ? `<img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.title || 'About image')}" class="about-image" />` : ''}
            <div class="about-content">
              <h3>${escapeHtml(item.title || 'About Item')}</h3>
              ${buildExpandableText(item.details, `about-${item.id}`, 180)}
            </div>
          </article>
        `
      )
      .join('');
  } catch (_) {
    grid.innerHTML = '<p class="error-message">Failed to load about content.</p>';
  }
}

async function loadGallery() {
  const grid = document.getElementById('galleryGrid');
  if (!grid) return;

  try {
    const items = await fetchUploads('gallary');

    if (!Array.isArray(items) || items.length === 0) {
      grid.innerHTML = '<p class="empty-message">No gallery items found.</p>';
      return;
    }

    grid.innerHTML = items
      .map(
        (item) => `
          <article class="gallery-card">
            <img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.title || 'Gallery image')}" class="gallery-image" />
            <div class="gallery-content">
              <h3>${escapeHtml(item.title || 'Gallery Item')}</h3>
              ${buildExpandableText(item.details, `gallery-${item.id}`)}
            </div>
          </article>
        `
      )
      .join('');
  } catch (_) {
    grid.innerHTML = '<p class="error-message">Failed to load gallery items.</p>';
  }
}

async function loadStaff() {
  const grid = document.getElementById('staffGrid');
  if (!grid) return;

  try {
    const items = await fetchUploads('staff');

    if (!Array.isArray(items) || items.length === 0) {
      grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #7c8ba6;">No staff records found.</p>';
      return;
    }

    grid.innerHTML = items
      .map(
        (item) => `
          <article class="staff-card">
            <img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.title || 'Staff image')}" class="staff-image" />
            <div class="staff-content">
              <h3>${escapeHtml(item.title || 'Staff')}</h3>
              ${buildExpandableText(item.details, `staff-${item.id}`, 130)}
            </div>
          </article>
        `
      )
      .join('');
  } catch (_) {
    grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #dc2626;">Failed to load staff records.</p>';
  }
}

async function loadHomeSlider() {
  const slidesRoot = document.querySelector('.hero-slider .slides');
  const dotsRoot = document.querySelector('.hero-slider .slider-dots');
  if (!slidesRoot || !dotsRoot) return;

  const fallbackSlides = [
    {
      imageUrl: 'https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=1600&q=80',
      title: 'Kankai Polytechnic College',
      details: 'A modern technical learning environment focused on practical education, innovation, and student success.'
    },
    {
      imageUrl: 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?auto=format&fit=crop&w=1600&q=80',
      title: 'Classrooms & Learning Spaces',
      details: 'Smart classrooms, collaborative study areas, and hands-on labs to support academic and technical excellence.'
    },
    {
      imageUrl: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1600&q=80',
      title: 'Campus Life & Opportunities',
      details: 'A vibrant campus with skill-building programs, events, and activities that prepare students for professional growth.'
    }
  ];

  const branding = await window.siteBranding;
  if (branding) {
    applyTheme(branding.institution);
    fallbackSlides[0].title = branding.institution.name;
  }

  let items = fallbackSlides;

  try {
    const homeItems = await fetchUploads('home');
    if (Array.isArray(homeItems) && homeItems.length) {
      items = homeItems;
    }
  } catch (err) {
    console.log('Home API call failed, using fallback slides:', err.message);
  }

  slidesRoot.innerHTML = items
    .map(
      (slide, index) => `
      <div class="slide ${index === 0 ? 'active' : ''}">
        <img src="${escapeHtml(slide.imageUrl)}" alt="${escapeHtml(slide.title || 'Home slide image')}" />
        <div class="slide-content">
          <h2>${escapeHtml(slide.title || 'College Update')}</h2>
          <p>${escapeHtml(slide.details || 'Latest highlights from campus and academic activities.')}</p>
        </div>
      </div>
    `
    )
    .join('');

  dotsRoot.innerHTML = items
    .map(
      (_, index) =>
        `<button class="dot ${index === 0 ? 'active' : ''}" type="button" data-index="${index}" aria-label="Go to slide ${index + 1}"></button>`
    )
    .join('');

  initSlider();
}

function initSlider() {
  const slides = document.querySelectorAll('.slide');
  const dots = document.querySelectorAll('.dot');
  const prevBtn = document.querySelector('.slider-btn.prev');
  const nextBtn = document.querySelector('.slider-btn.next');

  if (!slides.length || !dots.length || !prevBtn || !nextBtn) return;

  let currentIndex = 0;
  let autoSlide;

  function showSlide(index) {
    slides[currentIndex].classList.remove('active');
    dots[currentIndex].classList.remove('active');

    currentIndex = (index + slides.length) % slides.length;

    slides[currentIndex].classList.add('active');
    dots[currentIndex].classList.add('active');
  }

  function nextSlide() {
    showSlide(currentIndex + 1);
  }

  function startAutoSlide() {
    autoSlide = setInterval(nextSlide, 5000);
  }

  function resetAutoSlide() {
    clearInterval(autoSlide);
    startAutoSlide();
  }

  prevBtn.addEventListener('click', () => {
    showSlide(currentIndex - 1);
    resetAutoSlide();
  });

  nextBtn.addEventListener('click', () => {
    showSlide(currentIndex + 1);
    resetAutoSlide();
  });

  dots.forEach((dot) => {
    dot.addEventListener('click', () => {
      showSlide(Number(dot.dataset.index));
      resetAutoSlide();
    });
  });

  startAutoSlide();
}

document.addEventListener('click', (event) => {
  const btn = event.target.closest('.see-more-btn');
  if (!btn) return;

  const targetId = btn.dataset.target;
  const paragraph = document.getElementById(targetId);
  if (!paragraph) return;

  const extra = paragraph.querySelector('.more-text');
  if (!extra) return;

  const expanded = btn.dataset.expanded === 'true';
  extra.hidden = expanded;
  btn.dataset.expanded = String(!expanded);
  btn.textContent = expanded ? 'See more' : 'See less';
});

const NOTICE_POPUP_WINDOW_MS = 24 * 60 * 60 * 1000;
const NOTICE_POPUP_KEY = 'seenNoticePopups';

function readSeenNotices() {
  try {
    return JSON.parse(localStorage.getItem(NOTICE_POPUP_KEY)) || {};
  } catch (_) {
    return {};
  }
}

function markNoticesSeen(ids) {
  const now = Date.now();
  const seen = readSeenNotices();
  ids.forEach((id) => {
    seen[id] = now;
  });
  Object.keys(seen).forEach((id) => {
    if (now - seen[id] > NOTICE_POPUP_WINDOW_MS * 2) delete seen[id];
  });
  try {
    localStorage.setItem(NOTICE_POPUP_KEY, JSON.stringify(seen));
  } catch (_) {

  }
}

async function showNoticePopup() {
  let notices;
  try {
    notices = await fetchUploads('notices');
  } catch (_) {
    return;
  }

  const now = Date.now();
  const seen = readSeenNotices();
  const fresh = (Array.isArray(notices) ? notices : []).filter((n) => {
    const age = now - new Date(n.createdAt).getTime();
    return age >= 0 && age < NOTICE_POPUP_WINDOW_MS;
  });
  const unseen = fresh.filter((n) => !seen[n.id]);
  if (!unseen.length) return;

  const notice = unseen[0];
  const others = unseen.length - 1;
  const lastFocus = document.activeElement;

  const overlay = document.createElement('div');
  overlay.className = 'notice-popup-overlay';
  overlay.innerHTML = `
    <div class="notice-popup" role="dialog" aria-modal="true" aria-labelledby="noticePopupTitle">
      <button type="button" class="notice-popup-close" aria-label="Close notice">&times;</button>
      <div class="notice-popup-tag">New notice</div>
      ${notice.imageUrl ? `<img src="${escapeHtml(notice.imageUrl)}" alt="${escapeHtml(notice.title || 'Notice image')}" class="notice-popup-image" />` : ''}
      <h2 id="noticePopupTitle" class="notice-popup-title">${escapeHtml(notice.title || 'Notice')}</h2>
      <div class="notice-popup-date">${formatDate(notice.createdAt)}</div>
      ${notice.details ? `<p class="notice-popup-text">${escapeHtml(notice.details)}</p>` : ''}
      <div class="notice-popup-actions">
        ${location.pathname === '/notice' ? '' : `<a href="/notice" class="notice-popup-link">${others ? `See all notices (${others} more new)` : 'See all notices'}</a>`}
        <button type="button" class="notice-popup-ok">Close</button>
      </div>
    </div>`;

  const close = () => {
    markNoticesSeen(unseen.map((n) => n.id));
    document.removeEventListener('keydown', onKey);
    document.body.classList.remove('notice-popup-open');
    overlay.remove();
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  };

  const onKey = (event) => {
    if (event.key === 'Escape') close();
  };

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay || event.target.closest('.notice-popup-close, .notice-popup-ok')) close();
  });
  overlay.querySelector('.notice-popup-link')?.addEventListener('click', () => markNoticesSeen(unseen.map((n) => n.id)));
  document.addEventListener('keydown', onKey);

  document.body.appendChild(overlay);
  document.body.classList.add('notice-popup-open');
  overlay.querySelector('.notice-popup-ok').focus();
}

document.addEventListener('DOMContentLoaded', () => {
  showNoticePopup();
  loadHomeSlider();
  loadStaff();
  loadNotices();
  loadGallery();
  loadAbout();
});

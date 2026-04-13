// load navbar 
async function loadComponent(targetId, url) {
  const root = document.getElementById(targetId);
  if (!root) return;

  try {
    const res = await fetch(url);
    if (!res.ok) return;
    root.innerHTML = await res.text();
  } catch (_) {
    // ignore and keep page usable
  }
}

loadComponent('navbar-root', '/component/nav.html');
loadComponent('footer-root', '/component/footer.html');

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

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  loadHomeSlider();
  loadStaff();
  loadNotices();
  loadGallery();
  loadAbout();
});

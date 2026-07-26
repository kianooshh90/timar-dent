/* =================================================================
   TIMAR DENTAL CENTER (TDC) — script.js
   Modules:
     1. Three.js 3D viewer (OrbitControls) for dental samples
     2. Gallery rendering + modal control
     3. Form validation (lead + upload) with toasts
     4. Dropzone (drag/drop + file validation)
     5. Ripple effect on buttons
     6. Mobile menu + navbar scroll state + active link
     7. Scroll reveal (IntersectionObserver)
   ================================================================= */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/* -----------------------------------------------------------------
   0. Tiny helpers
   ----------------------------------------------------------------- */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const isFaDigit = (s) => /[۰-۹]/.test(s);
const faToEn = (s) => s.replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));

/* -----------------------------------------------------------------
   1. Gallery data
   ----------------------------------------------------------------- */
const WORKS = [
  { id: 'crown',   tag: 'ZIRCONIA',    title: 'کرن تک‌دندانی',       sub: 'Single Crown',         img: 'assets/work-crown.png' },
  { id: 'bridge',  tag: 'ZIRCONIA',    title: 'بریج سه‌واحدی',        sub: '3-Unit Bridge',        img: 'assets/work-bridge.png' },
  { id: 'implant', tag: 'TI + CERAMIC', title: 'ایمپلنت و اباتمنت',  sub: 'Implant & Abutment',   img: 'assets/work-implant.png' },
  { id: 'veneer',  tag: 'E.MAX',       title: 'ونیر سرامیکی',         sub: 'Ceramic Veneer',       img: 'assets/work-veneer.png' },
];

/* -----------------------------------------------------------------
   2. Render gallery thumbnails
   ----------------------------------------------------------------- */
function renderGallery() {
  const grid = $('#galleryGrid');
  if (!grid) return;
  grid.innerHTML = WORKS.map((w, i) => `
    <button class="work-card reveal" data-work="${w.id}" style="--d:${0.05 * i}s" aria-label="مشاهده ${w.title} به صورت سه‌بعدی">
      <img class="work-card__img" src="${w.img}" alt="${w.title}" loading="lazy" />
      <span class="work-card__view" aria-hidden="true">↻</span>
      <span class="work-card__overlay">
        <span class="work-card__tag">${w.tag}</span>
        <span class="work-card__title">${w.title}</span>
        <span class="work-card__sub">${w.sub}</span>
      </span>
    </button>
  `).join('');

  // bind clicks
  $$('.work-card', grid).forEach((card) => {
    card.addEventListener('click', () => {
      const id = card.dataset.work;
      const work = WORKS.find((w) => w.id === id);
      openViewer(work);
    });
  });
  observeReveals();
}

/* -----------------------------------------------------------------
   3. Three.js Viewer
   ----------------------------------------------------------------- */
const Viewer = {
  renderer: null,
  scene: null,
  camera: null,
  controls: null,
  model: null,
  raf: null,
  lights: [],
  inited: false,
  current: null,

  init() {
    const canvas = $('#viewerCanvas');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    this.camera.position.set(3.4, 2.2, 4.2);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 1.4;
    this.controls.minDistance = 2.2;
    this.controls.maxDistance = 9;
    this.controls.target.set(0, 0.4, 0);
    // stop auto-rotate once the user grabs the model
    this.controls.addEventListener('start', () => { this.controls.autoRotate = false; });

    // Lights: key + fill + warm orange rim
    const ambient = new THREE.AmbientLight(0xffffff, 0.55);
    const key = new THREE.DirectionalLight(0xffffff, 1.15);
    key.position.set(4, 6, 5);
    const fill = new THREE.DirectionalLight(0xbfc8ff, 0.4);
    fill.position.set(-5, 2, -3);
    const rim = new THREE.PointLight(0xf48c06, 1.6, 30, 1.5);
    rim.position.set(-3, 2.5, -4);
    this.scene.add(ambient, key, fill, rim);
    this.lights = [ambient, key, fill, rim];

    // subtle floor reflection plate
    const floorGeo = new THREE.CircleGeometry(6, 64);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x1c1c1c, roughness: 0.6, metalness: 0.2, transparent: true, opacity: 0.55
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.9;
    this.scene.add(floor);

    this.inited = true;
    window.addEventListener('resize', () => this.resize());
    this.animate();
  },

  resize() {
    if (!this.renderer) return;
    const stage = $('#viewerStage');
    const w = stage ? stage.clientWidth : window.innerWidth;
    const h = stage ? stage.clientHeight : window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  },

  animate() {
    this.raf = requestAnimationFrame(() => this.animate());
    if (this.controls) this.controls.update();
    if (this.renderer) this.renderer.render(this.scene, this.camera);
  },

  // ---- procedural model builders ----
  clearModel() {
    if (!this.model) return;
    this.scene.remove(this.model);
    this.model.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
        else o.material.dispose();
      }
    });
    this.model = null;
  },

  buildCrown() {
    // Lathe a smooth molar-crown silhouette (white zirconia)
    const pts = [
      [0.46, 0.0],
      [0.52, 0.06],
      [0.62, 0.18],
      [0.70, 0.34],
      [0.66, 0.52],
      [0.50, 0.66],
      [0.30, 0.78],
      [0.10, 0.86],
      [0.0, 0.92],
    ].map(([x, y]) => new THREE.Vector2(Math.max(0.001, x), y));
    const geo = new THREE.LatheGeometry(pts, 64);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xf4f1ec, roughness: 0.28, metalness: 0.05,
    });
    const crown = new THREE.Mesh(geo, mat);
    crown.castShadow = true;
    const g = new THREE.Group();
    g.add(crown);
    return g;
  },

  buildBridge() {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0xf4f1ec, roughness: 0.28, metalness: 0.05 });
    const pts = [
      [0.40, 0.0], [0.50, 0.10], [0.58, 0.26], [0.54, 0.44],
      [0.38, 0.58], [0.20, 0.68], [0.06, 0.74], [0.0, 0.78],
    ].map(([x, y]) => new THREE.Vector2(Math.max(0.001, x), y));
    const geo = new THREE.LatheGeometry(pts, 48);
    [-1.05, 0, 1.05].forEach((x) => {
      const c = new THREE.Mesh(geo, mat);
      c.position.set(x, 0, 0);
      g.add(c);
    });
    // connecting base bar
    const barGeo = new THREE.CylinderGeometry(0.16, 0.16, 2.4, 24);
    const bar = new THREE.Mesh(barGeo, mat);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, 0.02, 0);
    g.add(bar);
    return g;
  },

  buildImplant() {
    const g = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({ color: 0xcfd2d6, roughness: 0.32, metalness: 0.92 });
    const ceramic = new THREE.MeshStandardMaterial({ color: 0xf4f1ec, roughness: 0.28, metalness: 0.05 });

    // screw body
    const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 1.25, 32), metal);
    screw.position.y = -0.5;
    g.add(screw);
    // threads (stacked tori)
    for (let i = 0; i < 7; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.30, 0.035, 12, 40), metal);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = -1.05 + i * 0.17;
      g.add(ring);
    }
    // abutment (tapered cone)
    const abut = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.28, 0.5, 32), metal);
    abut.position.y = 0.32;
    g.add(abut);
    // crown on top
    const crownPts = [
      [0.30, 0.0], [0.40, 0.08], [0.46, 0.22], [0.42, 0.40],
      [0.30, 0.54], [0.16, 0.62], [0.05, 0.66], [0.0, 0.70],
    ].map(([x, y]) => new THREE.Vector2(Math.max(0.001, x), y));
    const crown = new THREE.Mesh(new THREE.LatheGeometry(crownPts, 48), ceramic);
    crown.position.y = 0.58;
    g.add(crown);
    return g;
  },

  buildVeneer() {
    // three thin curved shells in a fan (e.max ceramic)
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: 0xfff7ef, roughness: 0.22, metalness: 0.0,
      transparent: true, opacity: 0.92, side: THREE.DoubleSide,
    });
    const shellGeo = new THREE.SphereGeometry(0.7, 40, 40, 0, Math.PI * 0.7, 0, Math.PI * 0.7);
    for (let i = 0; i < 4; i++) {
      const s = new THREE.Mesh(shellGeo, mat);
      s.scale.set(0.55, 1, 0.16);
      s.position.set((i - 1.5) * 0.42, 0.1, 0);
      s.rotation.y = (i - 1.5) * 0.22;
      s.rotation.z = (i - 1.5) * 0.08;
      g.add(s);
    }
    return g;
  },

  buildModel(id) {
    switch (id) {
      case 'crown':   return this.buildCrown();
      case 'bridge':  return this.buildBridge();
      case 'implant': return this.buildImplant();
      case 'veneer':  return this.buildVeneer();
      default:        return this.buildCrown();
    }
  },

  open(work) {
    this.current = work;
    if (!this.inited) this.init();
    this.clearModel();
    this.model = this.buildModel(work.id);
    this.scene.add(this.model);

    // reset camera + auto-rotate for fresh entry
    this.camera.position.set(3.4, 2.2, 4.2);
    this.controls.target.set(0, 0.4, 0);
    this.controls.autoRotate = true;
    this.controls.update();

    // wait a tick so stage has real size, then size renderer
    requestAnimationFrame(() => this.resize());
  },

  reset() {
    if (!this.inited) return;
    this.camera.position.set(3.4, 2.2, 4.2);
    this.controls.target.set(0, 0.4, 0);
    this.controls.autoRotate = true;
    this.controls.update();
  },
};

/* -----------------------------------------------------------------
   4. Modal control
   ----------------------------------------------------------------- */
function openViewer(work) {
  const modal = $('#viewerModal');
  $('#viewerTitle').textContent = work.title;
  $('#viewerEyebrow').textContent = work.sub;
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  const loader = $('#viewerLoader');
  loader.classList.remove('is-hidden');

  try {
    Viewer.open(work);
    // brief loader for premium feel
    setTimeout(() => loader.classList.add('is-hidden'), 500);
  } catch (e) {
    console.error(e);
    loader.querySelector('span:last-child').textContent = 'خطا در بارگذاری مدل سه‌بعدی';
  }
}

function closeViewer() {
  const modal = $('#viewerModal');
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function bindModal() {
  $$('[data-close]').forEach((el) => el.addEventListener('click', closeViewer));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $('#viewerModal').classList.contains('is-open')) closeViewer();
  });
  $('#viewerReset')?.addEventListener('click', () => Viewer.reset());
}

/* -----------------------------------------------------------------
   5. Toast notifications
   ----------------------------------------------------------------- */
function toast(message, type = 'info') {
  const container = $('#toastContainer');
  if (!container) return;
  const icons = { success: '✓', error: '!', info: 'ℹ' };
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.innerHTML = `
    <span class="toast__icon" aria-hidden="true">${icons[type] || icons.info}</span>
    <span class="toast__msg">${message}</span>
  `;
  container.appendChild(el);
  requestAnimationFrame(() => el.classList.add('is-shown'));
  setTimeout(() => {
    el.classList.remove('is-shown');
    setTimeout(() => el.remove(), 400);
  }, 4200);
}

/* -----------------------------------------------------------------
   6. Form validation
   ----------------------------------------------------------------- */
const validators = {
  required: (v) => (v && v.trim().length > 0 ? '' : 'این فیلد الزامی است.'),
  minLen: (n) => (v) => (v && v.trim().length >= n ? '' : `حداقل ${n} کاراکتر لازم است.`),
  mobile: (v) => {
    const en = faToEn(v.trim());
    return /^09\d{9}$/.test(en) ? '' : 'شماره موبایل معتبر وارد کنید (مثال: 09121234567).';
  },
  postal: (v) => {
    const en = faToEn(v.trim());
    return /^\d{10}$/.test(en) ? '' : 'کد پستی باید دقیقاً ۱۰ رقم باشد.';
  },
  age: (v) => {
    const n = Number(faToEn(String(v).trim()));
    if (!n && n !== 0) return 'سن را به عدد وارد کنید.';
    return n >= 1 && n <= 120 ? '' : 'سن باید بین ۱ تا ۱۲۰ باشد.';
  },
  radio: (form, name) => (form.querySelector(`input[name="${name}"]:checked`) ? '' : 'یک گزینه را انتخاب کنید.'),
  select: (v) => (v ? '' : 'یک گزینه را انتخاب کنید.'),
  file: (file) => {
    if (!file) return 'فایل پروژه را آپلود کنید.';
    const ok = /\.(stl|ply|obj|3mf)$/i.test(file.name);
    return ok ? '' : 'فرمت فایل مجاز نیست (STL، PLY، OBJ، 3MF).';
  },
};

function setError(input, msg) {
  const field = input.closest('.field') || input.closest('.dropzone')?.parentElement;
  const errEl = field?.querySelector('.field__error');
  if (errEl) errEl.textContent = msg || '';
  if (input.classList) input.classList.toggle('is-invalid', !!msg);
  if (input.id === 'uf-file') {
    $('#dropzone')?.classList.toggle('is-invalid', !!msg);
  }
}

function validateLeadForm() {
  const form = $('#leadForm');
  let ok = true;
  const checks = [
    ['lf-name', (v) => validators.required(v) || validators.minLen(3)(v)],
    ['lf-lab', (v) => validators.required(v) || validators.minLen(2)(v)],
    ['lf-mobile', (v) => validators.mobile(v)],
    ['lf-city', (v) => validators.required(v) || validators.minLen(2)(v)],
  ];
  checks.forEach(([id, fn]) => {
    const input = $(`#${id}`);
    const msg = fn(input.value);
    setError(input, msg);
    if (msg) ok = false;
  });
  // subject radio
  const subjectErr = validators.radio(form, 'subject');
  const subjectErrEl = form.querySelector('[data-error-for="subject"]');
  if (subjectErrEl) subjectErrEl.textContent = subjectErr;
  if (subjectErr) ok = false;
  return ok;
}

function validateUploadForm() {
  const form = $('#uploadForm');
  let ok = true;
  const checks = [
    ['uf-lab', (v) => validators.required(v) || validators.minLen(2)(v)],
    ['uf-postal', (v) => validators.postal(v)],
    ['uf-pname', (v) => validators.required(v) || validators.minLen(2)(v)],
    ['uf-age', (v) => validators.age(v)],
  ];
  checks.forEach(([id, fn]) => {
    const input = $(`#${id}`);
    const msg = fn(input.value);
    setError(input, msg);
    if (msg) ok = false;
  });
  // color select
  const color = $('#uf-color');
  const colorErr = validators.select(color.value);
  setError(color, colorErr);
  if (colorErr) ok = false;
  // scan type radio
  const scanErr = validators.radio(form, 'scanType');
  const scanErrEl = form.querySelector('[data-error-for="scanType"]');
  if (scanErrEl) scanErrEl.textContent = scanErr;
  if (scanErr) ok = false;
  // file
  const fileInput = $('#uf-file');
  const fileErr = validators.file(fileInput.files[0]);
  const fileErrEl = form.querySelector('[data-error-for="uf-file"]');
  if (fileErrEl) fileErrEl.textContent = fileErr;
  $('#dropzone')?.classList.toggle('is-invalid', !!fileErr);
  if (fileErr) ok = false;
  return ok;
}

function bindForms() {
  const lead = $('#leadForm');
  lead?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (validateLeadForm()) {
      toast('درخواست همکاری شما با موفقیت ثبت شد. کارشناسان ما به‌زودی تماس می‌گیرند.', 'success');
      lead.reset();
      $$('input, select', lead).forEach((i) => i.classList.remove('is-invalid'));
    } else {
      toast('لطفاً خطاهای فرم را برطرف کنید.', 'error');
    }
  });

  const upload = $('#uploadForm');
  upload?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (validateUploadForm()) {
      const file = $('#uf-file').files[0];
      toast(`پروژه با موفقیت ثبت شد. فایل «${file.name}» دریافت شد.`, 'success');
      upload.reset();
      resetDropzone();
      $$('input, select', upload).forEach((i) => i.classList.remove('is-invalid'));
    } else {
      toast('لطفاً خطاهای فرم را برطرف کنید.', 'error');
    }
  });

  // clear error on input
  $$('.field__input').forEach((input) => {
    input.addEventListener('input', () => setError(input, ''));
    input.addEventListener('change', () => setError(input, ''));
  });
  $$('input[type="radio"]').forEach((r) => {
    r.addEventListener('change', () => {
      const errEl = r.closest('fieldset')?.querySelector('.field__error');
      if (errEl) errEl.textContent = '';
    });
  });
}

/* -----------------------------------------------------------------
   7. Dropzone
   ----------------------------------------------------------------- */
function bindDropzone() {
  const dz = $('#dropzone');
  const input = $('#uf-file');
  const fileBox = $('#dropzoneFile');
  const fileName = $('#dropzoneFileName');
  const removeBtn = $('#dropzoneRemove');
  if (!dz || !input) return;

  dz.addEventListener('click', () => input.click());
  dz.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
  });

  input.addEventListener('change', () => showFile(input.files[0]));

  ['dragenter', 'dragover'].forEach((ev) =>
    dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('is-drag'); })
  );
  ['dragleave', 'drop'].forEach((ev) =>
    dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('is-drag'); })
  );
  dz.addEventListener('drop', (e) => {
    const f = e.dataTransfer?.files?.[0];
    if (f) { input.files = f ? attachFile(input, f) : input.files; showFile(f); }
  });

  removeBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    resetDropzone();
  });

  function showFile(file) {
    if (!file) return;
    fileName.textContent = `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} مگابایت`;
    fileBox.hidden = false;
    dz.querySelector('.dropzone__content').style.display = 'none';
    dz.classList.remove('is-invalid');
    const errEl = document.querySelector('[data-error-for="uf-file"]');
    if (errEl) errEl.textContent = '';
  }

  function resetDropzone() {
    input.value = '';
    fileBox.hidden = true;
    fileName.textContent = '';
    const content = dz.querySelector('.dropzone__content');
    if (content) content.style.display = '';
  }
  // expose reset
  window.__resetDropzone = resetDropzone;
}
function resetDropzone() { window.__resetDropzone?.(); }

// helper: assign a File to input.files (DataTransfer trick)
function attachFile(input, file) {
  const dt = new DataTransfer();
  dt.items.add(file);
  input.files = dt.files;
  return input.files;
}

/* -----------------------------------------------------------------
   8. Ripple effect
   ----------------------------------------------------------------- */
function bindRipple() {
  $$('.ripple').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const rect = btn.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;
      const wave = document.createElement('span');
      wave.className = 'ripple__wave';
      wave.style.width = wave.style.height = `${size}px`;
      wave.style.left = `${x}px`;
      wave.style.top = `${y}px`;
      btn.appendChild(wave);
      setTimeout(() => wave.remove(), 600);
    });
  });
}

/* -----------------------------------------------------------------
   9. Mobile menu + navbar
   ----------------------------------------------------------------- */
function bindNav() {
  const burger = $('#burger');
  const menu = $('#mobileMenu');
  burger?.addEventListener('click', () => {
    const open = menu.classList.toggle('is-open');
    burger.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-hidden', String(!open));
  });
  $$('.mobile-menu__link').forEach((l) =>
    l.addEventListener('click', () => {
      menu.classList.remove('is-open');
      burger.classList.remove('is-open');
      burger.setAttribute('aria-expanded', 'false');
      menu.setAttribute('aria-hidden', 'true');
    })
  );
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu.classList.contains('is-open')) {
      menu.classList.remove('is-open');
      burger.classList.remove('is-open');
      burger.setAttribute('aria-expanded', 'false');
    }
  });

  // scroll state
  const nav = $('#nav');
  const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 20);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // active link highlighting via IntersectionObserver
  const links = $$('.nav__link');
  const sections = links
    .map((l) => document.querySelector(l.getAttribute('href')))
    .filter(Boolean);
  if (sections.length) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = `#${entry.target.id}`;
            links.forEach((l) => l.classList.toggle('is-active', l.getAttribute('href') === id));
          }
        });
      },
      { rootMargin: '-45% 0px -50% 0px' }
    );
    sections.forEach((s) => io.observe(s));
  }
}

/* -----------------------------------------------------------------
   10. Scroll reveal
   ----------------------------------------------------------------- */
let revealIO = null;
function observeReveals() {
  if (!('IntersectionObserver' in window)) {
    $$('.reveal').forEach((el) => el.classList.add('is-visible'));
    return;
  }
  if (!revealIO) {
    revealIO = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            revealIO.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    );
  }
  $$('.reveal:not(.is-visible)').forEach((el) => revealIO.observe(el));
}

/* -----------------------------------------------------------------
   11. Bootstrap
   ----------------------------------------------------------------- */
function init() {
  renderGallery();
  bindModal();
  bindForms();
  bindDropzone();
  bindRipple();
  bindNav();
  observeReveals();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

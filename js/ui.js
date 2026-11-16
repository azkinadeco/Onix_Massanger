import { h, esc, vibrate } from './util.js';
import { icon } from './icons.js';

const app = () => document.getElementById('app');

/* ---------- viewport (keyboard iOS) ---------- */
export function initViewport() {
  const vv = window.visualViewport;
  const set = () => {
    const height = vv ? vv.height : window.innerHeight;
    const r = document.documentElement.style;
    r.setProperty('--app-h', height + 'px');
    r.setProperty('--app-top', (vv ? vv.offsetTop : 0) + 'px');
  };
  set();
  vv?.addEventListener('resize', set);
  vv?.addEventListener('scroll', set);
  window.addEventListener('resize', set);
  // cegah halaman "ketarik" saat keyboard muncul
  document.addEventListener('focusout', () => setTimeout(() => window.scrollTo(0, 0), 50));
}

/* ---------- router (stack of screens) ---------- */
const stack = [];
export const router = {
  setRoot(s) {
    stack.forEach(x => x.destroy?.());
    stack.length = 0;
    app().querySelectorAll('.screen').forEach(e => e.remove());
    s.el.classList.add('screen');
    app().appendChild(s.el);
    stack.push(s);
    s.show?.();
  },
  push(s) {
    const prev = stack[stack.length - 1];
    s.el.classList.add('screen', 'enter');
    app().appendChild(s.el);
    s.el.getBoundingClientRect();
    s.el.classList.remove('enter');
    prev?.el.classList.add('behind');
    prev?.hide?.();
    stack.push(s);
    history.pushState({ depth: stack.length }, '');
    enableSwipeBack(s.el);
    s.show?.();
  },
  back() { if (stack.length > 1) history.back(); },
  _pop() {
    if (stack.length <= 1) return;
    const s = stack.pop();
    const prev = stack[stack.length - 1];
    document.activeElement?.blur?.();
    s.el.style.transform = '';
    s.el.classList.add('leaving');
    prev.el.classList.remove('behind');
    s.hide?.();
    setTimeout(() => { s.destroy?.(); s.el.remove(); }, 330);
    prev.show?.();
  },
  top() { return stack[stack.length - 1]; },
};
window.addEventListener('popstate', e => {
  const d = Math.max(1, e.state?.depth || 1);
  if (stack.length <= d) { if (stack.length > 1) router._pop(); return; }
  while (stack.length > d) router._pop();
});

function enableSwipeBack(el) {
  let sx = null, sy = 0, dx = 0, active = false;
  el.addEventListener('touchstart', e => {
    const t = e.touches[0];
    if (t.clientX - el.getBoundingClientRect().left > 26) { sx = null; return; }
    sx = t.clientX; sy = t.clientY; active = false; dx = 0;
  }, { passive: true });
  el.addEventListener('touchmove', e => {
    if (sx == null) return;
    const t = e.touches[0];
    dx = t.clientX - sx;
    const dy = t.clientY - sy;
    if (!active) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) { active = true; el.style.transition = 'none'; }
      else if (Math.abs(dy) > 10) { sx = null; return; }
    }
    if (active) el.style.transform = `translateX(${Math.max(0, dx)}px)`;
  }, { passive: true });
  el.addEventListener('touchend', () => {
    if (sx == null) return;
    sx = null;
    el.style.transition = '';
    if (active && dx > el.offsetWidth * 0.3) router.back();
    else el.style.transform = '';
    active = false;
  });
}

/* ---------- click delegation ---------- */
export function bindActs(el, handlers) {
  el.addEventListener('click', e => {
    const t = e.target.closest('[data-act]');
    if (!t || !el.contains(t)) return;
    const a = t.dataset.act;
    if (handlers[a]) { handlers[a](t, e); return; }
    if (a === 'back') router.back();
  });
}

export function onLongPress(root, selector, cb) {
  let timer = null, sx = 0, sy = 0, fired = false, firedAt = 0;
  const cancel = () => { clearTimeout(timer); timer = null; };
  root.addEventListener('touchstart', e => {
    fired = false;
    const target = e.target.closest(selector);
    if (!target || !root.contains(target)) return;
    sx = e.touches[0].clientX; sy = e.touches[0].clientY;
    target.classList.add('pressing');
    timer = setTimeout(() => { fired = true; firedAt = Date.now(); target.classList.remove('pressing'); vibrate(12); cb(target); }, 430);
    const clear = () => target.classList.remove('pressing');
    root.addEventListener('touchend', clear, { once: true });
    root.addEventListener('touchcancel', clear, { once: true });
    root.addEventListener('touchmove', clear, { once: true });
  }, { passive: true });
  root.addEventListener('touchmove', e => {
    if (!timer) return;
    const t = e.touches[0];
    if (Math.hypot(t.clientX - sx, t.clientY - sy) > 8) cancel();
  }, { passive: true });
  root.addEventListener('touchend', cancel);
  root.addEventListener('touchcancel', cancel);
  root.addEventListener('mousedown', () => { fired = false; });
  root.addEventListener('contextmenu', e => {
    const t = e.target.closest(selector);
    if (!t || !root.contains(t)) return;
    e.preventDefault();
    if (Date.now() - firedAt < 800) return; // long-press sentuh sudah memicu
    firedAt = Date.now();
    cb(t);
  });
  root.addEventListener('click', e => {
    if (fired) { e.stopPropagation(); e.preventDefault(); fired = false; }
  }, true);
}

/* ---------- navbar ---------- */
export const navbar = (title, right = '', cls = '') =>
  `<header class="navbar ${cls}"><button class="icon-btn" data-act="back" aria-label="Kembali">${icon('back')}</button><div class="nav-title">${title}</div><div class="nav-right">${right}</div></header>`;

/* ---------- toast ---------- */
export function toast(msg) {
  app().querySelectorAll('.toast').forEach(t => t.remove());
  const t = h(`<div class="toast">${esc(msg)}</div>`);
  app().appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2000);
}

/* ---------- bottom sheet ---------- */
export function sheet({ title = '', top = '', actions = [], onMount } = {}) {
  return new Promise(resolve => {
    const el = h(`<div class="sheet-wrap"><div class="sheet-bg"></div><div class="sheet">
      <div class="grabber"></div>
      ${title ? `<div class="sheet-title">${esc(title)}</div>` : ''}
      ${top}
      ${actions.length ? `<div class="sheet-actions">${actions.map((a, i) => `<button class="sheet-btn ${a.danger ? 'danger' : ''}" data-i="${i}">${a.icon ? icon(a.icon) : ''}<span>${esc(a.label)}</span></button>`).join('')}</div>` : ''}
      <button class="sheet-cancel" data-i="-1">Batal</button>
    </div></div>`);
    let done = false;
    const close = (val) => {
      if (done) return; done = true;
      el.classList.remove('show');
      setTimeout(() => el.remove(), 280);
      resolve(val ?? null);
    };
    el.addEventListener('click', e => {
      if (e.target.classList.contains('sheet-bg')) return close(null);
      const b = e.target.closest('[data-i]');
      if (!b) return;
      const i = +b.dataset.i;
      close(i >= 0 ? actions[i] : null);
      if (i >= 0) actions[i].run?.();
    });
    app().appendChild(el);
    onMount?.(el, close);
    requestAnimationFrame(() => el.classList.add('show'));
  });
}

/* ---------- dialog ---------- */
function dialog(inner, bind) {
  return new Promise(resolve => {
    const el = h(`<div class="dialog-wrap"><div class="dialog">${inner}</div></div>`);
    const close = v => { el.classList.remove('show'); setTimeout(() => el.remove(), 220); resolve(v); };
    app().appendChild(el);
    bind(el, close);
    requestAnimationFrame(() => el.classList.add('show'));
  });
}
export function confirmBox({ title, text = '', ok = 'Oke', danger = false }) {
  return dialog(`<h3>${esc(title)}</h3>${text ? `<p>${esc(text)}</p>` : ''}<div class="dialog-btns"><button class="btn ghost" data-v="0">Batal</button><button class="btn ${danger ? 'danger' : 'primary'}" data-v="1">${esc(ok)}</button></div>`,
    (el, close) => el.addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (b) close(b.dataset.v === '1'); }));
}
export function promptBox({ title, value = '', placeholder = '', ok = 'Simpan', max = 50 }) {
  return dialog(`<h3>${esc(title)}</h3><input class="field" maxlength="${max}" value="${esc(value)}" placeholder="${esc(placeholder)}"><div class="dialog-btns"><button class="btn ghost" data-v="0">Batal</button><button class="btn primary" data-v="1">${esc(ok)}</button></div>`,
    (el, close) => {
      const inp = el.querySelector('input');
      setTimeout(() => inp.focus(), 50);
      const submit = () => { const v = inp.value.trim(); close(v || null); };
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
      el.addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b) return; b.dataset.v === '1' ? submit() : close(null); });
    });
}

/* ---------- banner notifikasi in-app ---------- */
export function banner({ title, text, avatarHtml, onTap }) {
  app().querySelectorAll('.banner').forEach(b => b.remove());
  const el = h(`<div class="banner">${avatarHtml}<div class="banner-txt"><b>${esc(title)}</b><span>${esc(text)}</span></div></div>`);
  app().appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  let sy = null;
  const hide = () => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); };
  const t = setTimeout(hide, 3800);
  el.addEventListener('click', () => { clearTimeout(t); hide(); onTap?.(); });
  el.addEventListener('touchstart', e => { sy = e.touches[0].clientY; }, { passive: true });
  el.addEventListener('touchmove', e => { if (sy != null && e.touches[0].clientY - sy < -20) { clearTimeout(t); hide(); sy = null; } }, { passive: true });
}

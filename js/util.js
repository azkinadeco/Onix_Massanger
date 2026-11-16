export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const linkify = s => esc(s)
  .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
  .replace(/\n/g, '<br>');

export function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

const pad = n => String(n).padStart(2, '0');
const DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const DAYS_FULL = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export const isSameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
export const hm = ts => { const d = new Date(ts); return `${pad(d.getHours())}.${pad(d.getMinutes())}`; };

export function listTime(ts) {
  const now = Date.now();
  if (isSameDay(ts, now)) return hm(ts);
  if (isSameDay(ts, now - 864e5)) return 'Kemarin';
  if (now - ts < 6 * 864e5) return DAYS_FULL[new Date(ts).getDay()];
  const d = new Date(ts);
  return `${d.getDate()}/${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}`;
}
export function dayLabel(ts) {
  const now = Date.now();
  if (isSameDay(ts, now)) return 'Hari ini';
  if (isSameDay(ts, now - 864e5)) return 'Kemarin';
  const d = new Date(ts);
  const y = d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : '';
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}${y}`;
}
export function ago(ts) {
  const s = (Date.now() - ts) / 1000;
  if (s < 60) return 'baru aja';
  if (s < 3600) return `${Math.floor(s / 60)} mnt lalu`;
  if (s < 86400) return `${Math.floor(s / 3600)} jam lalu`;
  return `${Math.floor(s / 86400)} hari lalu`;
}
export const dur = s => `${pad(Math.floor(s / 60))}:${pad(Math.floor(s % 60))}`;

export function initials(name) {
  return (name || '?').trim().split(/\s+/).slice(0, 2).map(w => [...w][0] || '').join('').toUpperCase();
}

export function avatar(u, size = 48, opts = {}) {
  u ||= { name: '?', hue: 0 };
  const style = `width:${size}px;height:${size}px;font-size:${Math.round(size * 0.36)}px;--h:${u.hue ?? 250}`;
  const inner = u.avatar ? `<img src="${u.avatar}" alt="">`
    : u.emoji ? `<span class="av-emoji" style="font-size:${Math.round(size * 0.5)}px">${u.emoji}</span>`
    : esc(initials(u.name));
  const cls = ['avatar', opts.sq ? 'sq' : '', opts.ring ? 'ring' : '', opts.seen ? 'seen' : ''].join(' ');
  return `<div class="${cls}" style="${style}">${inner}${opts.online ? '<i class="dot"></i>' : ''}</div>`;
}

export function hash(str) {
  let x = 2166136261;
  for (let i = 0; i < str.length; i++) { x ^= str.charCodeAt(i); x = Math.imul(x, 16777619); }
  return x >>> 0;
}

export const vibrate = (ms = 8) => { try { navigator.vibrate?.(ms); } catch { /* */ } };

let actx;
export function playPop(freq = 880) {
  try {
    actx ||= new (window.AudioContext || window.webkitAudioContext)();
    const t = actx.currentTime;
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 1.5, t + 0.08);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g).connect(actx.destination);
    o.start(t); o.stop(t + 0.2);
  } catch { /* */ }
}

export function pickFile(accept = 'image/*', capture) {
  return new Promise(res => {
    const i = document.createElement('input');
    i.type = 'file'; i.accept = accept; i.style.display = 'none';
    if (capture) i.setAttribute('capture', capture);
    i.onchange = () => { res(i.files[0] || null); i.remove(); };
    document.body.appendChild(i);
    i.click();
  });
}

export function compressImage(file, max = 1080, q = 0.78) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        let w = img.naturalWidth, hh = img.naturalHeight;
        const k = Math.min(1, max / Math.max(w, hh));
        w = Math.round(w * k); hh = Math.round(hh * k);
        const c = document.createElement('canvas');
        c.width = w; c.height = hh;
        c.getContext('2d').drawImage(img, 0, 0, w, hh);
        res({ src: c.toDataURL('image/jpeg', q), w, h: hh });
      };
      img.onerror = rej;
      img.src = r.result;
    };
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

export async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; }
  catch {
    const ta = document.createElement('textarea');
    ta.value = t; document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy'); ta.remove(); return ok;
  }
}

// Emoji-only pesan pendek -> tampil besar
export function isJumbo(text) {
  if (!text || text.length > 16) return false;
  const stripped = text.replace(/\s/g, '');
  if (!/^[\p{Extended_Pictographic}‍️\u{1F3FB}-\u{1F3FF}]+$/u.test(stripped)) return false;
  const count = [...stripped.replace(/[‍️\u{1F3FB}-\u{1F3FF}]/gu, '')].length;
  return count <= 3;
}

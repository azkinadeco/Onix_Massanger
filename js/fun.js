// Fitur khas Onix (nggak ada di app chat lain)
import { api, bus, ME, firstName } from './service.js';
import { esc } from './util.js';
import { icon } from './icons.js';

// item tambahan di menu + : [aksi, ikon, label, warna]
export const FUN_ITEMS = [['capsule', 'hourglass', 'Kapsul', '#9B5CFF'], ['scratch', 'sparkle', 'Gosok', '#FF5CA8'], ['nudge', 'hand', 'Colek', '#FFB020']];

/* ============ MODE KALEM ============
   Pesan yang kelihatan lagi emosi -> ditawarin tahan dulu sebelum kekirim */
const RUDE = /(^|[^a-z])(anjing|anjg|anjrit|bangsat|bgst|goblok|goblog|gblk|tolol|bego|kampret|brengsek|bajingan|sialan|idiot|bodoh|tai|taik|fuck|shit|wtf|njing|kontol|memek)(?=$|[^a-z])/i;
export function calmReason(text) {
  const letters = text.replace(/[^A-Za-z]/g, '');
  if (RUDE.test(text)) return 'kasar';
  if (letters.length >= 10 && letters.replace(/[^A-Z]/g, '').length / letters.length > 0.7) return 'caps';
  if (/[!?]{4,}/.test(text)) return 'seru';
  const h = new Date().getHours();
  if (h < 4 && text.length > 140) return 'malam';
  return null;
}
const CALM_TXT = { kasar: 'Kata-katanya agak pedes', caps: 'Kayaknya lagi teriak nih', seru: 'Tanda serunya banyak banget', malam: 'Udah larut, pesannya panjang' };
export const calmOn = () => api.settings().calm !== false;
// return 'send' | 'hold' | 'edit'
export function calmSheet(reason, text) {
  return new Promise(async resolve => {
    const { sheet } = await import('./ui.js');
    let picked = 'edit';
    await sheet({
      top: `<div class="calm">
        <div class="calm-orb"><i></i><i></i><span>🫧</span></div>
        <b>Tarik napas dulu?</b>
        <small>${esc(CALM_TXT[reason] || '')}</small>
        <div class="calm-msg">${esc(text.length > 160 ? text.slice(0, 160) + '…' : text)}</div>
        <div class="calm-btns">
          <button class="btn primary wide" data-c="hold">${icon('clock', 'tiny')} Tahan 10 menit</button>
          <div class="calm-row"><button class="btn ghost" data-c="edit">Ubah dulu</button><button class="btn ghost" data-c="send">Kirim aja</button></div>
        </div>
      </div>`,
      onMount: (s, close) => s.addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (b) { picked = b.dataset.c; close(); } }),
    });
    resolve(picked);
  });
}

/* ============ BATAL KIRIM ============ */
export const UNDO_MS = 3000;
export const undoOn = () => api.settings().undoSend !== false;

/* ============ helper ============ */
const untilTxt = ts => {
  const s = Math.max(0, (ts - Date.now()) / 1000);
  if (s < 60) return 'sebentar lagi';
  if (s < 3600) return `${Math.ceil(s / 60)} menit lagi`;
  if (s < 86400) return `${Math.round(s / 3600)} jam lagi`;
  if (s < 86400 * 45) return `${Math.round(s / 86400)} hari lagi`;
  if (s < 86400 * 400) return `${Math.round(s / 86400 / 30)} bulan lagi`;
  return `${Math.round(s / 86400 / 365)} tahun lagi`;
};
const dateTxt = ts => new Date(ts).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
const txt = s => esc(s || '').replace(/\n/g, '<br>');
const buzz = p => { try { navigator.vibrate?.(p); } catch { /* */ } };
// tipe pesan yang isinya rahasia (jangan diteruskan / disalin / di-keep)
export const SECRET_TYPES = ['capsule', 'scratch', 'nudge'];

/* sheet nulis pesan khusus: judul, placeholder, opsi tambahan */
async function composeSheet({ head, ph, extra = '', go, bind }) {
  const { sheet, toast } = await import('./ui.js');
  return sheet({
    top: `<div class="fun-compose">
      <div class="fc-h">${head}</div>
      <textarea class="fc-ta" rows="4" maxlength="1000" placeholder="${esc(ph)}"></textarea>
      ${extra}
      <button class="btn primary wide" data-go>${esc(go)}</button>
    </div>`,
    onMount: (s, close) => {
      const ta = s.querySelector('.fc-ta');
      setTimeout(() => ta.focus(), 250);
      bind?.(s);
      s.querySelector('[data-go]').addEventListener('click', e => {
        e.stopPropagation();
        const v = ta.value.trim();
        if (!v) { ta.focus(); return toast('Tulis dulu pesannya'); }
        if (s._ok?.(v) === false) return;
        close();
      });
    },
  });
}

/* ============ KAPSUL WAKTU ============
   Pesan disegel sampai tanggal tertentu. Pengirim & penerima sama-sama nunggu. */
export const capsuleReady = m => Date.now() >= (m.openAt || 0);
export function capsuleHtml(m) {
  if (!capsuleReady(m)) return `<div class="bubble capsule sealed"><span class="cap-ic">⏳</span><span class="cap-t"><b>Kapsul waktu</b><small>Kebuka ${untilTxt(m.openAt)}</small></span><span class="cap-date">${dateTxt(m.openAt)}</span></div>`;
  if (!m.capOpened) return `<button class="bubble capsule ready" data-act="cap-open" data-mid="${m.id}"><span class="cap-ic">🎁</span><span class="cap-t"><b>Kapsul udah kebuka</b><small>Tap buat baca</small></span></button>`;
  return `<div class="bubble capsule open"><small class="cap-from">⏳ Ditulis ${dateTxt(m.ts)}</small><span class="txt">${txt(m.secret)}</span></div>`;
}
const CAP_OPTS = [['1 jam', 3600e3], ['Besok pagi', 'tmr'], ['1 minggu', 7 * 86400e3], ['1 bulan', 30 * 86400e3], ['1 tahun', 365 * 86400e3]];
export function capsuleSheet(chatId) {
  let at = Date.now() + 7 * 86400e3;
  const pad = n => String(n).padStart(2, '0');
  const local = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return composeSheet({
    head: '⏳ <b>Kapsul waktu</b><small>Baru bisa dibaca nanti</small>',
    ph: 'Pesan buat nanti…',
    go: 'Segel & kirim',
    extra: `<div class="fc-chips">${CAP_OPTS.map(([l], i) => `<button class="${i === 2 ? 'on' : ''}" data-o="${i}">${l}</button>`).join('')}<label class="fc-cal">${icon('calendar', 'tiny')}<input type="datetime-local" min="${local(new Date())}"></label></div>`,
    bind: s => {
      const chips = s.querySelectorAll('[data-o]'), cal = s.querySelector('.fc-cal'), inp = cal.querySelector('input');
      const on = n => { chips.forEach(c => c.classList.toggle('on', c === n)); cal.classList.toggle('on', n === cal); };
      chips.forEach(c => c.addEventListener('click', e => {
        e.stopPropagation();
        const v = CAP_OPTS[+c.dataset.o][1];
        if (v === 'tmr') { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(8, 0, 0, 0); at = +d; } else at = Date.now() + v;
        on(c);
      }));
      inp.addEventListener('change', () => { const t = Date.parse(inp.value); if (t > Date.now()) { at = t; on(cal); } });
      s._ok = v => { api.send(chatId, { type: 'capsule', secret: v, openAt: at }); buzz(10); };
    },
  });
}

/* ============ GOSOK ============
   Pesan ketutup lapisan warna-warni, penerima harus gosok buat baca */
export function scratchHtml(m, mine) {
  if (mine) return `<div class="bubble scratch mine"><small class="sc-tag">🫣 Pesan gosok</small><span class="txt">${txt(m.secret)}</span></div>`;
  if (m.scratched) return `<div class="bubble scratch done"><span class="txt">${txt(m.secret)}</span></div>`;
  return `<div class="bubble scratch" data-sc="${m.id}"><span class="txt">${txt(m.secret)}</span><canvas class="scratch-cv"></canvas></div>`;
}
export function scratchSheet(chatId) {
  return composeSheet({
    head: '🫣 <b>Pesan gosok</b><small>Teman harus gosok dulu buat baca</small>',
    ph: 'Rahasia apa nih…', go: 'Kirim',
    bind: s => { s._ok = v => { api.send(chatId, { type: 'scratch', secret: v }); buzz(10); }; },
  });
}
export function initScratch(root, onDone) {
  root.querySelectorAll('canvas.scratch-cv:not([data-on])').forEach(cv => {
    const box = cv.parentElement, r = box.getBoundingClientRect();
    if (!r.width) return;
    cv.dataset.on = 1;
    const dpr = devicePixelRatio || 1;
    cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
    const x = cv.getContext('2d', { willReadFrequently: true });
    x.scale(dpr, dpr);
    const g = x.createLinearGradient(0, 0, r.width, r.height);
    g.addColorStop(0, '#B9A3FF'); g.addColorStop(.5, '#FF9CCB'); g.addColorStop(1, '#8CD6FF');
    x.fillStyle = g; x.fillRect(0, 0, r.width, r.height);
    x.fillStyle = 'rgba(255,255,255,.6)';
    for (let i = 0; i < r.width * r.height / 90; i++) { x.beginPath(); x.arc(Math.random() * r.width, Math.random() * r.height, Math.random() * 1.3 + .3, 0, 7); x.fill(); }
    x.fillStyle = '#fff'; x.font = '700 13px -apple-system, system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('✨ gosok di sini', r.width / 2, r.height / 2);
    x.globalCompositeOperation = 'destination-out';
    x.lineWidth = 28; x.lineCap = 'round'; x.lineJoin = 'round';
    let down = false, last = null, moves = 0, done = false;
    const pt = e => { const b = cv.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
    const draw = p => { x.beginPath(); x.moveTo(...(last || [p[0] - .1, p[1]])); x.lineTo(...p); x.stroke(); last = p; };
    const check = () => {
      if (done) return;
      const d = x.getImageData(0, 0, cv.width, cv.height).data;
      let clear = 0, n = 0;
      for (let i = 3; i < d.length; i += 64) { n++; if (d[i] === 0) clear++; }
      if (clear / n > 0.5) { done = true; cv.classList.add('gone'); buzz(15); setTimeout(() => onDone(box.dataset.sc), 380); }
    };
    cv.addEventListener('pointerdown', e => { e.stopPropagation(); down = true; last = null; try { cv.setPointerCapture(e.pointerId); } catch { /* */ } draw(pt(e)); });
    cv.addEventListener('pointermove', e => { if (!down) { if (!(e.buttons & 1)) return; down = true; last = null; } draw(pt(e)); if (++moves % 6 === 0) { check(); if (moves % 12 === 0) buzz(3); } });
    const up = () => { down = false; check(); };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  });
}

/* ============ COLEK ============
   Layar teman goyang + getar. Maks 1x tiap 10 detik per chat */
export function nudgeHtml(m, chat) {
  const mine = m.from === ME, group = chat?.type === 'group';
  const who = mine ? 'Kamu' : esc(firstName(api.user(m.from)?.name || '?'));
  const to = group ? 'semua' : mine ? esc(firstName(api.peerOf(chat)?.name || '')) : 'kamu';
  return `<div class="sys nudge"><span>👉 ${who} nyolek ${to}</span></div>`;
}
const lastNudge = new Map();
export function nudge(chatId) {
  if (Date.now() - (lastNudge.get(chatId) || 0) < 10e3) return false;
  lastNudge.set(chatId, Date.now());
  api.send(chatId, { type: 'nudge' });
  return true;
}
export function shake(el, strong) {
  el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
  setTimeout(() => el.classList.remove('shake'), 700);
  if (strong) buzz([40, 60, 40, 60, 40]);
}

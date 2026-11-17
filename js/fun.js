// Fitur khas Onix (nggak ada di app chat lain)
import { api, bus, ME, firstName } from './service.js';
import { esc, h, avatar } from './util.js';
import { icon } from './icons.js';
import { router, bindActs, navbar, sheet, toast } from './ui.js';

// item tambahan di menu + : [aksi, ikon, label, warna]
export const FUN_ITEMS = [['style', 'type', 'Gaya teks', '#5B6CFF'], ['recap', 'chart', 'Rekap', '#2E7BFF'], ['capsule', 'hourglass', 'Kapsul', '#9B5CFF'], ['scratch', 'sparkle', 'Gosok', '#FF5CA8'], ['nudge', 'hand', 'Colek', '#FFB020'], ['doodle', 'brush', 'Coretan', '#10B2A0']];

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
    if (!r.width) { clearTimeout(root._scT); root._scT = setTimeout(() => initScratch(root, onDone), 250); return; }
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

/* ============ REKAP CHAT (ala Wrapped) ============ */
const EMO_RE = /\p{Extended_Pictographic}(‍\p{Extended_Pictographic}|️)*/gu;
const nameOf = id => id === ME ? 'Kamu' : firstName(api.user(id)?.name || '?');
const durTxt = ms => ms == null ? '–' : ms < 60e3 ? Math.max(1, Math.round(ms / 1e3)) + ' dtk' : ms < 3600e3 ? Math.round(ms / 60e3) + ' mnt' : Math.round(ms / 3600e3) + ' jam';
const hourTxt = h => String(h).padStart(2, '0') + '.00';
export function recapStats(chatId) {
  const list = api.messages(chatId).filter(m => m.type !== 'system' && !m.unsent && m.status !== 'hold');
  const by = {}, emo = {}, kinds = {}, hours = Array(24).fill(0), days = new Set(), rMine = [], rThem = [];
  list.forEach((m, i) => {
    by[m.from] = (by[m.from] || 0) + 1;
    kinds[m.type] = (kinds[m.type] || 0) + 1;
    const d = new Date(m.ts);
    hours[d.getHours()]++;
    days.add(d.toDateString());
    const t = (m.type === 'text' ? m.text || '' : '') + (m.type === 'sticker' && !m.img ? m.sticker || '' : '');
    for (const e of t.match(EMO_RE) || []) emo[e] = (emo[e] || 0) + 1;
    for (const [e, a] of Object.entries(m.reactions || {})) emo[e] = (emo[e] || 0) + a.length;
    const p = list[i - 1];
    if (p && p.from !== m.from && m.ts - p.ts < 12 * 3600e3) (m.from === ME ? rMine : rThem).push(m.ts - p.ts);
  });
  const ds = [...days].map(d => +new Date(d)).sort((a, b) => a - b);
  let streak = ds.length ? 1 : 0, cur = 1;
  for (let i = 1; i < ds.length; i++) { cur = Math.round((ds[i] - ds[i - 1]) / 864e5) === 1 ? cur + 1 : 1; streak = Math.max(streak, cur); }
  const med = a => a.length ? a.sort((x, y) => x - y)[a.length >> 1] : null;
  const peak = hours.indexOf(Math.max(...hours));
  const persona = !list.length ? '' : peak >= 22 || peak < 4 ? ['🦉', 'Duo begadang'] : peak < 10 ? ['🐦', 'Tim pagi'] : peak < 16 ? ['☀️', 'Anak siang'] : ['🌇', 'Geng sore'];
  return {
    total: list.length, since: list[0]?.ts, days: days.size, streak, hours, peak, persona,
    by: Object.entries(by).sort((a, b) => b[1] - a[1]),
    emo: Object.entries(emo).sort((a, b) => b[1] - a[1]).slice(0, 5),
    kinds, rMine: med(rMine), rThem: med(rThem),
  };
}
export function RecapScreen(chatId) {
  const ch = api.chat(chatId), s = recapStats(chatId), group = ch.type === 'group';
  const peer = group ? null : api.peerOf(ch);
  const max = Math.max(1, ...s.hours);
  const card = (cls, inner) => `<section class="rc-card ${cls}">${inner}</section>`;
  const body = !s.total ? `<div class="rc-empty">📭<b>Belum ada obrolan</b></div>` : [
    card('rc-hero', `<small>Rekap ${esc(api.chatTitle(ch))}</small><b class="rc-big">${s.total.toLocaleString('id-ID')}</b><span>pesan · ${s.days} hari ngobrol</span><small>sejak ${new Date(s.since).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</small>`),
    card('rc-who', `<small>Paling cerewet</small>${s.by.slice(0, 5).map(([id, n]) => `<div class="rc-bar"><span class="rc-av">${avatar(id === ME ? api.me() : api.user(id), 30)}</span><span class="rc-track"><i style="width:${Math.round(n / s.by[0][1] * 100)}%"></i><em>${esc(nameOf(id))}</em></span><b>${Math.round(n / s.total * 100)}%</b></div>`).join('')}`),
    s.emo.length ? card('rc-emo', `<small>Emoji andalan</small><div class="rc-emo-top">${s.emo[0][0]}</div><div class="rc-emo-rest">${s.emo.slice(1).map(([e, n]) => `<span>${e}<small>${n}</small></span>`).join('')}</div>`) : '',
    card('rc-hour', `<small>Jam paling rame</small><b class="rc-mid">${s.persona[0]} ${s.persona[1]}</b><div class="rc-chart">${s.hours.map((n, i) => `<i class="${i === s.peak ? 'on' : ''}" style="height:${Math.max(4, Math.round(n / max * 100))}%"></i>`).join('')}</div><span>Puncaknya jam ${hourTxt(s.peak)}</span>`),
    card('rc-streak', `<small>Streak terpanjang</small><b class="rc-big">${s.streak}🔥</b><span>hari berturut-turut</span>`),
    !group && (s.rMine != null || s.rThem != null) ? card('rc-speed', `<small>Kecepatan bales</small><div class="rc-vs"><div><b>${durTxt(s.rMine)}</b><span>Kamu</span></div><i>vs</i><div><b>${durTxt(s.rThem)}</b><span>${esc(firstName(peer?.name || ''))}</span></div></div>`) : '',
    `<button class="btn primary wide rc-share" data-act="share">${icon('share', 'tiny')} Kirim rekap ke chat</button>`,
  ].join('');
  const el = h(`<div class="sub-screen">${navbar('Rekap ✨')}<div class="content rc">${body}</div></div>`);
  bindActs(el, {
    share: () => {
      const src = recapImage(ch, s);
      api.send(chatId, { type: 'image', src, w: 1080, h: 1350 });
      toast('Rekap terkirim ✨'); buzz(10); router.back();
    },
  });
  return { el };
}
function recapImage(ch, s) {
  const W = 1080, H = 1350, cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const x = cv.getContext('2d');
  const g = x.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#7C5CFF'); g.addColorStop(.55, '#C04CFF'); g.addColorStop(1, '#FF6FB5');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.fillStyle = 'rgba(255,255,255,.08)';
  [[180, 220, 260], [930, 380, 200], [820, 1180, 300]].forEach(([cx, cy, r]) => { x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); });
  const F = '-apple-system, system-ui, sans-serif';
  const t = (str, y, size, wgt = 700, a = 1) => { x.globalAlpha = a; x.fillStyle = '#fff'; x.font = `${wgt} ${size}px ${F}`; x.textAlign = 'center'; x.fillText(str, W / 2, y); x.globalAlpha = 1; };
  t('REKAP ONIX', 140, 38, 800, .8);
  t(api.chatTitle(ch).slice(0, 26), 220, 60, 800);
  t(s.total.toLocaleString('id-ID'), 420, 190, 900);
  t(`pesan · ${s.days} hari ngobrol`, 490, 44, 600, .9);
  t(`${s.persona[0]} ${s.persona[1]}`, 640, 64, 800);
  t(`paling rame jam ${hourTxt(s.peak)}`, 705, 38, 600, .85);
  if (s.emo.length) { t(s.emo.slice(0, 3).map(e => e[0]).join('  '), 880, 120, 400); t('emoji andalan', 945, 36, 600, .85); }
  t(`${s.streak} hari streak 🔥`, 1080, 56, 800);
  const top = s.by[0];
  if (top) t(`paling cerewet: ${nameOf(top[0])} (${Math.round(top[1] / s.total * 100)}%)`, 1150, 38, 600, .9);
  t('onix', 1290, 34, 800, .55);
  return cv.toDataURL('image/jpeg', .85);
}

/* ============ VIBE CHAT ============
   Suasana obrolan dari 40 pesan terakhir -> emoji + warna di header */
const VIBES = [
  ['kocak', '😂', 'Kocak', '#FFB020', /wk{2,}|ha(ha)+|he(he)+|ngakak|lol|😂|🤣|😆|😹|lucu/giu],
  ['manis', '💗', 'Manis', '#FF5CA8', /sayang|kangen|love|❤️|💖|🥰|😍|🫶|💕|💗|💜/giu],
  ['seru', '🔥', 'Seru', '#FF6B1A', /\bgas+\b|anjay|keren|mantap|🔥|🤩|🎉|seru|wih|gokil/giu],
  ['galau', '🥲', 'Galau', '#5B8CFF', /sedih|capek|cape|galau|nangis|😭|🥲|😢|💔|huhu/giu],
  ['sibuk', '📚', 'Sibuk', '#14B8C4', /tugas|deadline|kerja|meeting|rapat|kuliah|ujian|dosen|📚|💻/giu],
  ['laper', '🍜', 'Laper', '#10B26C', /makan|laper|lapar|\bmie\b|kopi|jajan|bakso|🍜|🍕|☕|🍔|🍩/giu],
];
const VIBE_SEPI = { k: 'sepi', e: '🧊', label: 'Sepi', c: '#8C9BB0' }, VIBE_SANTAI = { k: 'santai', e: '😌', label: 'Santai', c: '#9B8CFF' };
export function vibeOf(chatId) {
  const list = api.messages(chatId).filter(m => m.type !== 'system' && !m.unsent).slice(-40);
  if (list.length < 3) return null;
  if (Date.now() - list[list.length - 1].ts > 3 * 864e5) return { ...VIBE_SEPI, scores: [] };
  const sc = Object.fromEntries(VIBES.map(v => [v[0], 0]));
  list.forEach((m, i) => {
    const w = 1 + i / list.length;
    const t = (m.text || '') + ' ' + (m.type === 'sticker' && !m.img ? m.sticker || '' : '') + ' ' + Object.keys(m.reactions || {}).join(' ');
    for (const [k, , , , re] of VIBES) sc[k] += (t.match(re) || []).length * w;
  });
  const scores = VIBES.map(v => ({ k: v[0], e: v[1], label: v[2], c: v[3], n: sc[v[0]] })).sort((a, b) => b.n - a.n);
  const best = scores[0];
  return best.n < 2 ? { ...VIBE_SANTAI, scores } : { ...best, scores };
}
export function vibeSheet(chatId) {
  const v = vibeOf(chatId);
  if (!v) return;
  const tot = v.scores.reduce((a, b) => a + b.n, 0) || 1;
  sheet({
    top: `<div class="vibe-sh" style="--v:${v.c}"><div class="vs-emo">${v.e}</div><b>Vibe: ${v.label}</b><small>${v.k === 'sepi' ? 'Udah lama nggak ngobrol' : 'Dari 40 pesan terakhir'}</small>
      ${v.scores.filter(x => x.n > 0).slice(0, 4).map(x => `<div class="vs-row" style="--v:${x.c}"><span>${x.e}</span><span class="vs-track"><i style="width:${Math.round(x.n / tot * 100)}%"></i></span><small>${Math.round(x.n / tot * 100)}%</small></div>`).join('')}</div>`,
  });
}

/* ============ PEMECAH SEPI ============
   Chat sepi > 3 hari (atau masih kosong) -> saran topik, tap buat dipakai */
const TOPICS = ['Lagi dengerin lagu apa sekarang? 🎧', 'Kalau bisa liburan besok, mau ke mana?', 'Makanan paling enak minggu ini apa?', 'Ada tontonan seru nggak? Butuh rekomendasi 🍿', 'Hal kecil yang bikin kamu seneng hari ini?', 'Kangen ngobrol nih, apa kabar? 👋', 'Kalau punya 1 juta buat dihabisin sehari, beli apa?', 'Lagi sibuk apa sekarang?', 'Mau nongkrong kapan? ☕', 'Kebiasaan aneh kamu apa? wkwk', 'Lagu yang lagi nyangkut di kepala?', 'Tim bubur diaduk atau nggak diaduk? 🥣', 'Ada cerita lucu minggu ini?', 'Mending gunung atau pantai? 🏔️🏖️', 'Apa yang lagi kamu pengenin banget?', 'Film terakhir yang kamu tonton?', 'Kalau jadi hewan, mau jadi apa? 🐱', 'Rekomendasiin jajanan enak dong', 'Pagi ini sarapan apa?', 'Lagi pengen belajar hal baru apa?', 'Hal paling random yang kamu lakuin minggu ini?', 'Mau main bareng kapan? 🎮', 'Tempat nongkrong favorit kamu sekarang?', 'Kopi atau teh? ☕🍵'];
export function icebreaker(chatId) {
  const ch = api.chat(chatId);
  if (!ch || api.peerOf(ch)?.official) return null;
  const list = api.messages(chatId).filter(m => m.type !== 'system');
  const last = list[list.length - 1];
  if (!last) return { label: 'Mulai obrolan', key: 'empty' };
  const days = Math.floor((Date.now() - last.ts) / 864e5);
  return days >= 3 ? { label: `Udah ${days} hari sepi`, key: last.id } : null;
}
export function pickTopics(n = 3) {
  const a = TOPICS.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, n);
}

/* ============ CORETAN REPLAY ============
   Gambar tangan dikirim sebagai goresan (bukan gambar), jadi di HP teman
   coretannya "digambar ulang" pelan-pelan. Koordinat 0..1000. */
const DD_COLORS = ['#15151C', '#7C5CFF', '#FF3D6E', '#FFB020', '#10B26C', '#2E7BFF'];
const DD_SIZES = [7, 16];
const DD_MAX = 6000;
const ddCount = strokes => strokes.reduce((a, s) => a + s.p.length / 2, 0);
function ddDraw(x, size, strokes, upto = Infinity) {
  const k = size / 1000;
  x.clearRect(0, 0, size, size);
  x.fillStyle = '#fff'; x.fillRect(0, 0, size, size);
  x.lineCap = 'round'; x.lineJoin = 'round';
  let n = 0;
  for (const s of strokes) {
    if (n >= upto) break;
    x.strokeStyle = DD_COLORS[s.c] || DD_COLORS[0];
    x.lineWidth = (DD_SIZES[s.w] || DD_SIZES[0]) * k;
    x.beginPath();
    const p = s.p;
    x.moveTo(p[0] * k, p[1] * k);
    if (p.length === 2) x.lineTo(p[0] * k + .1, p[1] * k);
    for (let i = 2; i < p.length && n < upto; i += 2, n++) x.lineTo(p[i] * k, p[i + 1] * k);
    n++;
    x.stroke();
  }
}
function ddCanvas(cv, css) {
  const dpr = devicePixelRatio || 1;
  cv.width = cv.height = Math.round(css * dpr);
  cv.style.width = cv.style.height = css + 'px';
  const x = cv.getContext('2d');
  x.setTransform(dpr, 0, 0, dpr, 0, 0);
  return x;
}
const played = new Set();
function ddPlay(cv, strokes) {
  const x = cv.getContext('2d'), size = parseFloat(cv.style.width);
  const N = ddCount(strokes), D = Math.min(3500, Math.max(900, N * 7));
  const t0 = performance.now();
  cv._play = (cv._play || 0) + 1;
  const id = cv._play;
  const step = now => {
    if (cv._play !== id) return;
    const f = Math.min(1, (now - t0) / D);
    ddDraw(x, size, strokes, Math.ceil(N * f));
    if (f < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
export function doodleHtml(m) {
  return `<button class="doodle-msg" data-act="doodle-play" data-mid="${m.id}"><canvas class="dd-cv" data-dd="${m.id}"></canvas><span class="dd-replay">${icon('refresh', 'tiny')}</span></button>`;
}
export function initDoodles(root, getMsg) {
  root.querySelectorAll('canvas.dd-cv:not([data-on])').forEach(cv => {
    const m = getMsg(cv.dataset.dd);
    if (!m?.strokes) return;
    cv.dataset.on = 1;
    const x = ddCanvas(cv, 210);
    if (!played.has(m.id) && Date.now() - m.ts < 20e3) { played.add(m.id); ddPlay(cv, m.strokes); }
    else ddDraw(x, 210, m.strokes);
  });
}
export function replayDoodle(root, mid, m) {
  const cv = root.querySelector(`canvas.dd-cv[data-dd="${mid}"]`);
  if (cv && m?.strokes) ddPlay(cv, m.strokes);
}
export function doodleURL(m) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 600;
  ddDraw(cv.getContext('2d'), 600, m.strokes || []);
  return cv.toDataURL('image/png');
}
export function doodleEditor(chatId) {
  let strokes = [], color = 0, width = 0, cur = null;
  const css = Math.min(window.innerWidth - 32, 420);
  const el = h(`<div class="doodle-ed">
    <div class="dd-top"><button class="icon-btn" data-dd="x" aria-label="Tutup">${icon('x')}</button><b>🖍️ Coretan</b><button class="icon-btn" data-dd="undo" aria-label="Undo">${icon('undo')}</button><button class="icon-btn" data-dd="clear" aria-label="Hapus">${icon('trash')}</button></div>
    <div class="dd-pad"><canvas></canvas><span class="dd-hint">Gambar di sini ✨</span></div>
    <div class="dd-bar">
      <div class="dd-colors">${DD_COLORS.map((c, i) => `<button class="${i ? '' : 'on'}" style="--c:${c}" data-c="${i}"></button>`).join('')}</div>
      <div class="dd-sizes">${DD_SIZES.map((s, i) => `<button class="${i ? '' : 'on'}" data-w="${i}"><i style="width:${s}px;height:${s}px"></i></button>`).join('')}</div>
    </div>
    <button class="btn primary wide dd-send" data-dd="send">${icon('send', 'tiny')} Kirim</button>
  </div>`);
  const cv = el.querySelector('canvas'), x = ddCanvas(cv, css), hint = el.querySelector('.dd-hint');
  const redraw = () => { ddDraw(x, css, strokes); hint.hidden = strokes.length > 0; };
  redraw();
  const pt = e => { const b = cv.getBoundingClientRect(); return [Math.round((e.clientX - b.left) / b.width * 1000), Math.round((e.clientY - b.top) / b.height * 1000)].map(v => Math.max(0, Math.min(1000, v))); };
  cv.addEventListener('pointerdown', e => {
    if (ddCount(strokes) > DD_MAX) return toast('Coretannya udah penuh');
    try { cv.setPointerCapture(e.pointerId); } catch { /* */ }
    cur = { c: color, w: width, p: pt(e) };
    strokes.push(cur); redraw();
  });
  cv.addEventListener('pointermove', e => {
    if (!cur) return;
    const [px, py] = pt(e), p = cur.p;
    if (Math.hypot(px - p[p.length - 2], py - p[p.length - 1]) < 5) return;
    p.push(px, py);
    redraw();
  });
  const end = () => { cur = null; };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  const close = () => { el.classList.remove('show'); setTimeout(() => el.remove(), 260); };
  el.addEventListener('click', e => {
    const c = e.target.closest('[data-c]'), w = e.target.closest('[data-w]'), b = e.target.closest('[data-dd]');
    if (c) { color = +c.dataset.c; el.querySelectorAll('[data-c]').forEach(n => n.classList.toggle('on', n === c)); }
    if (w) { width = +w.dataset.w; el.querySelectorAll('[data-w]').forEach(n => n.classList.toggle('on', n === w)); }
    if (!b) return;
    const a = b.dataset.dd;
    if (a === 'x') close();
    if (a === 'undo') { strokes.pop(); redraw(); }
    if (a === 'clear') { strokes = []; redraw(); }
    if (a === 'send') {
      if (!strokes.length) return toast('Gambar dulu dong 🖍️');
      api.send(chatId, { type: 'doodle', strokes });
      buzz(10); close();
    }
  });
  document.getElementById('app').appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
}

/* ============ GAYA TEKS ============
   Ubah tulisan jadi gaya unik (tetap teks biasa, jadi kebaca di mana aja) */
const mapRange = (s, lowA, upA, dig) => [...s].map(ch => {
  const c = ch.codePointAt(0);
  if (c >= 97 && c <= 122 && lowA) return String.fromCodePoint(lowA + c - 97);
  if (c >= 65 && c <= 90 && upA) return String.fromCodePoint(upA + c - 65);
  if (c >= 48 && c <= 57 && dig) return String.fromCodePoint(dig + c - 48);
  return ch;
}).join('');
const SUP = { a: 'ᵃ', b: 'ᵇ', c: 'ᶜ', d: 'ᵈ', e: 'ᵉ', f: 'ᶠ', g: 'ᵍ', h: 'ʰ', i: 'ⁱ', j: 'ʲ', k: 'ᵏ', l: 'ˡ', m: 'ᵐ', n: 'ⁿ', o: 'ᵒ', p: 'ᵖ', q: 'q', r: 'ʳ', s: 'ˢ', t: 'ᵗ', u: 'ᵘ', v: 'ᵛ', w: 'ʷ', x: 'ˣ', y: 'ʸ', z: 'ᶻ', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
const FLIP = { a: 'ɐ', b: 'q', c: 'ɔ', d: 'p', e: 'ǝ', f: 'ɟ', g: 'ƃ', h: 'ɥ', i: 'ᴉ', j: 'ɾ', k: 'ʞ', l: 'l', m: 'ɯ', n: 'u', o: 'o', p: 'd', q: 'b', r: 'ɹ', s: 's', t: 'ʇ', u: 'n', v: 'ʌ', w: 'ʍ', x: 'x', y: 'ʎ', z: 'z', '?': '¿', '!': '¡', '.': '˙', ',': "'", "'": ',', '(': ')', ')': '(' };
export const TEXT_STYLES = [
  ['Tebal', s => mapRange(s, 0x1D5EE, 0x1D5D4, 0x1D7EC)],
  ['Sambung', s => mapRange(s, 0x1D4EA, 0x1D4D0)],
  ['Spongebob', s => { let i = 0; return [...s].map(ch => /\p{L}/u.test(ch) ? (i++ % 2 ? ch.toUpperCase() : ch.toLowerCase()) : ch).join(''); }],
  ['Kecil', s => [...s.toLowerCase()].map(ch => SUP[ch] || ch).join('')],
  ['Bulet', s => mapRange(s, 0x24D0, 0x24B6)],
  ['Terbalik', s => [...s.toLowerCase()].map(ch => FLIP[ch] || ch).reverse().join('')],
  ['Alay', s => [...s].map(ch => ({ a: '4', e: '3', i: '1', o: '0', s: '5' }[ch.toLowerCase()] || (Math.random() < .5 ? ch.toUpperCase() : ch.toLowerCase()))).join('')],
  ['Renggang', s => [...s].join(' ')],
];
export function styleSheet(text, onPick) {
  const src = text.trim() || 'halo';
  sheet({
    top: `<div class="ts-list">${TEXT_STYLES.map(([n, f], i) => `<button class="ts-item" data-s="${i}"><small>${esc(n)}</small><span>${esc(f(src).slice(0, 120))}</span></button>`).join('')}</div>`,
    onMount: (s, close) => s.addEventListener('click', e => { const b = e.target.closest('[data-s]'); if (b) { e.stopPropagation(); onPick(TEXT_STYLES[+b.dataset.s][1](src)); close(); } }),
  });
}

/* ============ EFEK SUARA ============ */
export const VOICE_FX = [[null, '🙂', 1], ['chip', '🐿️', 1.55], ['deep', '🐻', 0.72]];
export const vfxOf = k => VOICE_FX.find(v => v[0] === (k || null)) || VOICE_FX[0];

/* ============ INGETIN AKU ============
   Tunda pesan: nanti muncul pengingat, tap langsung loncat ke pesannya */
const atHour = (h, addDay) => { const d = new Date(); if (addDay || d.getHours() >= h) d.setDate(d.getDate() + 1); d.setHours(h, 0, 0, 0); return +d; };
export function remindSheet(chatId, m) {
  const ex = api.reminderFor(m.id);
  if (ex) { api.removeReminder(ex.id); toast('Pengingat dihapus'); return; }
  const now = new Date();
  const opts = [['20 menit', Date.now() + 20 * 60e3], ['1 jam', Date.now() + 3600e3], [now.getHours() < 19 ? 'Nanti malam' : 'Besok malam', atHour(20)], ['Besok pagi', atHour(8, true)]];
  sheet({
    top: `<div class="rm-sh"><div class="rm-ic">🔔</div><b>Ingetin aku</b><small>${esc((m.text || '').slice(0, 80) || 'Pesan ini')}</small>
      <div class="rm-opts">${opts.map(([l, at], i) => `<button data-r="${i}"><b>${l}</b><small>${new Date(at).toLocaleString('id-ID', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</small></button>`).join('')}</div></div>`,
    onMount: (s, close) => s.addEventListener('click', e => {
      const b = e.target.closest('[data-r]');
      if (!b) return;
      e.stopPropagation();
      const [l, at] = opts[+b.dataset.r];
      const who = m.from === ME ? 'Kamu' : firstName(api.user(m.from)?.name || '');
      api.addReminder({ chatId, mid: m.id, at, text: (m.text || '').slice(0, 120), who });
      toast(`Oke, diingetin ${l.toLowerCase()} 🔔`); buzz(8); close();
    }),
  });
}
// dipanggil berkala dari app.js -> kembalikan pengingat yang udah waktunya
export function dueReminders() {
  const due = api.reminders().filter(r => r.at <= Date.now());
  due.forEach(r => api.removeReminder(r.id));
  return due.filter(r => api.chat(r.chatId));
}

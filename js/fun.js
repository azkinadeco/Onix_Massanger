// Fitur khas Onix (nggak ada di app chat lain)
import { api, bus, ME, firstName } from './service.js';
import { esc, h, avatar, hash, pickFile, compressImage } from './util.js';
import { icon } from './icons.js';
import { router, bindActs, navbar, sheet, toast } from './ui.js';

// item tambahan di menu + : [aksi, ikon, label, warna]
export const FUN_ITEMS = [['sopan', 'sparkle', 'Sopanin', '#3B2E7A'], ['style', 'type', 'Gaya teks', '#5B6CFF'], ['recap', 'chart', 'Rekap', '#2E7BFF'], ['capsule', 'hourglass', 'Kapsul', '#9B5CFF'], ['scratch', 'sparkle', 'Gosok', '#FF5CA8'], ['nudge', 'hand', 'Colek', '#FFB020'], ['doodle', 'brush', 'Coretan', '#10B2A0'], ['quiz', 'star', 'Kuis', '#FF3D81'], ['countdown', 'clock', 'Countdown', '#FF7A1A'], ['checkin', 'smile', 'Cek kabar', '#14B8C4'], ['spin', 'refresh', 'Roda putar', '#B05CFF'], ['todo', 'checks', 'Checklist', '#0FB46C'], ['story', 'note', 'Cerita', '#7C5CFF'], ['guess', 'brush', 'Tebak gambar', '#FF5C8A'], ['tsticker', 'sticker', 'Stiker teks', '#FF7A1A'], ['when', 'calendar', 'Kapan bisa', '#2E7BFF'], ['bomb', 'sparkle', 'Bom waktu', '#15151C'], ['challenge', 'camera', 'Tantangan foto', '#FF3D6E'], ['fortune', 'star', 'Kartu hoki', '#9B5CFF'], ['mix', 'smile', 'Emoji campur', '#FFB020'], ['who', 'users', 'Siapa paling', '#E1A100']];

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
export const SECRET_TYPES = ['capsule', 'scratch', 'nudge', 'quiz', 'quizres', 'checkin', 'checkans', 'todo', 'story', 'when', 'bomb'];

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
const vibeCache = new Map();
export function vibeOf(chatId) {
  const all = api.messages(chatId), last = all[all.length - 1];
  const key = all.length + '|' + (last?.id || '') + '|' + Object.keys(last?.reactions || {}).length + '|' + Math.floor(Date.now() / 36e5);
  const c = vibeCache.get(chatId);
  if (c && c.key === key) return c.v;
  const v = vibeCalc(chatId);
  vibeCache.set(chatId, { key, v });
  return v;
}
function vibeCalc(chatId) {
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
  const btn = `<button class="doodle-msg" data-act="doodle-play" data-mid="${m.id}"><canvas class="dd-cv" data-dd="${m.id}"></canvas><span class="dd-replay">${icon('refresh', 'tiny')}</span></button>`;
  return m.word ? `<div class="dd-wrap">${btn}${guessHtml(m)}</div>` : btn;
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
export function doodleEditor(chatId, { guess: guessMode = false } = {}) {
  let strokes = [], color = 0, width = 0, cur = null;
  const css = Math.min(window.innerWidth - 32, 420);
  const el = h(`<div class="doodle-ed">
    <div class="dd-top"><button class="icon-btn" data-dd="x" aria-label="Tutup">${icon('x')}</button><b>${guessMode ? '🤔 Tebak gambar' : '🖍️ Coretan'}</b><button class="icon-btn" data-dd="undo" aria-label="Undo">${icon('undo')}</button><button class="icon-btn" data-dd="clear" aria-label="Hapus">${icon('trash')}</button></div>
    ${guessMode ? `<input class="fc-in dd-word" maxlength="24" placeholder="Kata rahasia (mis. kucing)">` : ''}
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
      const word = guessMode ? el.querySelector('.dd-word').value.trim() : '';
      if (guessMode && !word) return toast('Isi kata rahasianya dulu');
      const sent = api.send(chatId, { type: 'doodle', strokes, ...(word ? { word } : {}) });
      if (word) demoPeer(chatId, sent.id, p => api.funActAs(chatId, sent.id, p, { ok: Math.random() < .6, n: 1, g: '?', ts: Date.now() }), 4000);
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

/* ============ KUIS "SEBERAPA KENAL AKU?" ============
   Pengirim bikin soal tentang dirinya, teman jawab, skornya otomatis kekirim */
const QUIZ_IDEAS = ['Makanan favorit aku?', 'Aku paling takut sama?', 'Warna favorit aku?', 'Kalau weekend aku biasanya?', 'Minuman andalan aku?', 'Genre musik favorit aku?'];
export function QuizComposeScreen(chatId) {
  const qs = [0, 1, 2].map(i => ({ q: '', o: ['', '', ''], a: 0, ph: QUIZ_IDEAS[i] }));
  const el = h(`<div class="sub-screen">${navbar('Kuis 🎯')}<div class="content qz-c"></div></div>`);
  const box = el.querySelector('.qz-c');
  const render = () => {
    box.innerHTML = `<p class="qz-intro">Bikin soal tentang kamu. Tandai jawaban yang benar ✅</p>${qs.map((x, i) => `<div class="qz-card" data-i="${i}">
      <div class="qz-num">${i + 1}</div>
      <input class="qz-q" data-k="q" value="${esc(x.q)}" placeholder="${esc(x.ph)}" maxlength="80">
      ${x.o.map((o, j) => `<div class="qz-o ${x.a === j ? 'on' : ''}"><button data-act="ok" data-q="${i}" data-o="${j}" aria-label="Benar">${icon('check')}</button><input data-k="o" data-o="${j}" value="${esc(o)}" placeholder="Pilihan ${j + 1}" maxlength="40"></div>`).join('')}
      ${qs.length > 1 ? `<button class="qz-del" data-act="del" data-q="${i}" aria-label="Hapus">${icon('trash')}</button>` : ''}
    </div>`).join('')}
    ${qs.length < 5 ? `<button class="btn ghost wide" data-act="add">${icon('plus', 'tiny')} Tambah soal</button>` : ''}
    <button class="btn primary wide" data-act="send">Kirim kuis</button>`;
  };
  box.addEventListener('input', e => {
    const card = e.target.closest('.qz-card'); if (!card) return;
    const x = qs[+card.dataset.i];
    if (e.target.dataset.k === 'q') x.q = e.target.value; else x.o[+e.target.dataset.o] = e.target.value;
  });
  bindActs(el, {
    ok: t => { qs[+t.dataset.q].a = +t.dataset.o; render(); buzz(5); },
    add: () => { qs.push({ q: '', o: ['', '', ''], a: 0, ph: QUIZ_IDEAS[qs.length] || 'Pertanyaan' }); render(); },
    del: t => { qs.splice(+t.dataset.q, 1); render(); },
    send: () => {
      const ok = qs.map(x => ({ q: x.q.trim() || x.ph, o: x.o.map(s => s.trim()), a: x.a })).filter(x => x.o.filter(Boolean).length >= 2);
      if (!ok.length) return toast('Isi minimal 2 pilihan per soal');
      if (ok.some(x => !x.o[x.a])) return toast('Jawaban yang benar belum diisi');
      const clean = ok.map(x => { const keep = x.o.map((s, j) => [s, j]).filter(([s]) => s); return { q: x.q, o: keep.map(k => k[0]), a: keep.findIndex(k => k[1] === x.a) }; });
      api.send(chatId, { type: 'quiz', quiz: { qs: clean } });
      buzz(10); router.back();
    },
  });
  render();
  return { el };
}
let refIdx = null;
// dipanggil chat.js sebelum render: kelompokin pesan yang punya ref
export function indexRefs(list) { refIdx = new Map(); for (const m of list) if (m.ref) { const k = m.type + '|' + m.ref; (refIdx.get(k) || refIdx.set(k, []).get(k)).push(m); } }
const byRef = (chatId, type, mid) => refIdx ? (refIdx.get(type + '|' + mid) || []) : api.messages(chatId).filter(x => x.type === type && x.ref === mid);
const scoresFor = (chatId, mid) => byRef(chatId, 'quizres', mid);
export function quizHtml(m, chatId) {
  const mine = m.from === ME, n = m.quiz?.qs?.length || 0;
  const res = scoresFor(chatId, m.id);
  const myRes = res.find(r => r.from === ME);
  const owner = mine ? 'aku' : firstName(api.user(m.from)?.name || '');
  return `<div class="bubble quiz"><div class="qz-top"><span>🎯</span><div><b>Seberapa kenal ${esc(owner)}?</b><small>${n} soal</small></div></div>
    ${res.length ? `<div class="qz-res">${res.map(r => `<span>${esc(r.from === ME ? 'Kamu' : firstName(api.user(r.from)?.name || '?'))} <b>${r.score}/${r.total}</b></span>`).join('')}</div>` : ''}
    ${!mine && !myRes ? `<button class="qz-play" data-act="quiz-play" data-mid="${m.id}">Main</button>` : ''}</div>`;
}
export function quizResHtml(m) {
  const who = m.from === ME ? 'Kamu' : esc(firstName(api.user(m.from)?.name || '?'));
  const pct = m.total ? m.score / m.total : 0;
  return `<div class="sys quizres"><span>${pct === 1 ? '🏆' : pct >= .5 ? '🎯' : '😅'} ${who} dapet ${m.score}/${m.total} di kuis</span></div>`;
}
export function playQuiz(chatId, m) {
  const qs = m.quiz?.qs || [];
  if (!qs.length || scoresFor(chatId, m.id).some(r => r.from === ME)) return;
  let i = 0, score = 0, locked = false;
  sheet({
    top: `<div class="qz-play-sh"></div>`,
    onMount: (s, close) => {
      const box = s.querySelector('.qz-play-sh');
      const show = () => {
        const x = qs[i];
        box.innerHTML = `<div class="qz-prog">${qs.map((_, k) => `<i class="${k < i ? 'done' : k === i ? 'now' : ''}"></i>`).join('')}</div><b class="qz-q-t">${esc(x.q)}</b><div class="qz-ans">${x.o.map((o, j) => `<button data-j="${j}">${esc(o)}</button>`).join('')}</div>`;
        locked = false;
      };
      const finish = () => {
        box.innerHTML = `<div class="qz-done"><span>${score === qs.length ? '🏆' : score >= qs.length / 2 ? '🎯' : '😅'}</span><b>${score}/${qs.length}</b><small>${score === qs.length ? 'Kenal banget!' : score >= qs.length / 2 ? 'Lumayan kenal' : 'Kurang kenal nih wkwk'}</small></div>`;
        api.send(chatId, { type: 'quizres', ref: m.id, score, total: qs.length });
        setTimeout(close, 1600);
      };
      box.addEventListener('click', e => {
        const b = e.target.closest('[data-j]');
        if (!b || locked) return;
        e.stopPropagation(); locked = true;
        const right = +b.dataset.j === qs[i].a;
        if (right) score++;
        b.classList.add(right ? 'right' : 'wrong');
        box.querySelector(`[data-j="${qs[i].a}"]`)?.classList.add('right');
        buzz(right ? 10 : [20, 40, 20]);
        setTimeout(() => { i++; i < qs.length ? show() : finish(); }, 750);
      });
      show();
    },
  });
}

/* ============ HITUNG MUNDUR ============ */
const CD_EMO = ['🎂', '🎉', '✈️', '🏖️', '📚', '🎮', '💍', '🎄', '🎓', '🎤'];
export function countdownHtml(m) {
  const left = m.at - Date.now();
  let big, unit;
  if (left <= 0) { big = '🎉'; unit = 'Udah tiba!'; }
  else if (left >= 864e5) { big = Math.ceil(left / 864e5); unit = 'hari lagi'; }
  else if (left >= 3600e3) { big = Math.floor(left / 3600e3); unit = 'jam lagi'; }
  else { big = Math.max(1, Math.ceil(left / 60e3)); unit = 'menit lagi'; }
  return `<div class="bubble cdown ${left <= 0 ? 'done' : ''}"><div class="cd-emo">${esc(m.emoji || '🎉')}</div><div class="cd-t"><b>${esc(m.title || '')}</b><small>${new Date(m.at).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</small></div><div class="cd-num"><b>${big}</b><small>${unit}</small></div></div>`;
}
export function countdownSheet(chatId) {
  let emoji = CD_EMO[0];
  const pad = n => String(n).padStart(2, '0');
  const d = new Date(Date.now() + 7 * 864e5);
  const def = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  sheet({
    top: `<div class="fun-compose">
      <div class="fc-h">⏱️ <b>Hitung mundur</b><small>Biar nunggunya bareng</small></div>
      <div class="cd-emos">${CD_EMO.map((e, i) => `<button class="${i ? '' : 'on'}" data-e="${e}">${e}</button>`).join('')}</div>
      <input class="fc-in" maxlength="40" placeholder="Nunggu apa? (mis. Liburan Bali)">
      <input class="fc-in" type="date" value="${def}" min="${def.slice(0, 8)}01">
      <button class="btn primary wide" data-go>Mulai hitung mundur</button>
    </div>`,
    onMount: (s, close) => {
      const [title, date] = s.querySelectorAll('.fc-in');
      s.querySelectorAll('[data-e]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); emoji = b.dataset.e; s.querySelectorAll('[data-e]').forEach(x => x.classList.toggle('on', x === b)); }));
      s.querySelector('[data-go]').addEventListener('click', e => {
        e.stopPropagation();
        const at = new Date(date.value + 'T00:00').getTime();
        if (!title.value.trim()) { title.focus(); return toast('Kasih judul dulu'); }
        if (!(at > Date.now())) return toast('Pilih tanggal yang akan datang');
        api.send(chatId, { type: 'countdown', title: title.value.trim(), at, emoji });
        buzz(10); close();
      });
    },
  });
}

/* ============ KENANGAN ============
   "1 bulan lalu hari ini" -> pesan dari tanggal yang sama di bulan/tahun sebelumnya */
export function memoryOf(chatId) {
  const now = new Date(), day = now.getDate();
  const list = api.messages(chatId).filter(m => (m.type === 'text' || m.type === 'image') && !m.unsent && !m.secret);
  for (const m of list) {
    const d = new Date(m.ts);
    if (d.getDate() !== day) continue;
    const months = (now.getFullYear() - d.getFullYear()) * 12 + now.getMonth() - d.getMonth();
    if (months < 1) continue;
    const label = months % 12 === 0 ? `${months / 12} tahun lalu` : `${months} bulan lalu`;
    const who = m.from === ME ? 'Kamu' : firstName(api.user(m.from)?.name || '');
    return { mid: m.id, label, text: `${who}: ${m.type === 'image' ? '📷 Foto' : m.text}`, key: chatId + now.toDateString() };
  }
  return null;
}
const memoSeen = new Set();
export const memoDismiss = k => memoSeen.add(k);
export const memoHidden = k => memoSeen.has(k);

/* ============ MODE FOKUS ============ */
export function focusSheet() {
  const f = api.focus();
  const tmr = (() => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(8, 0, 0, 0); return +d; })();
  const opts = [['30 menit', 30 * 60e3], ['1 jam', 3600e3], ['2 jam', 7200e3], ['Sampai besok', 0]];
  const jam = t => new Date(t).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  sheet({
    top: `<div class="fc-sh">
      <div class="fc-orb">🎧</div>
      <b>${f ? `Fokus sampai ${jam(f.until)}` : 'Mode fokus'}</b>
      <small>Notif diem, chat personal dibales otomatis, teman lihat kamu lagi fokus</small>
      ${f ? `<button class="btn danger-ghost wide" data-off>Matikan fokus</button>` : `
      <input class="fc-in" maxlength="30" placeholder="Lagi ngapain? (mis. belajar)">
      <div class="rm-opts">${opts.map(([l], i) => `<button data-f="${i}"><b>${l}</b><small>s/d ${jam(opts[i][1] ? Date.now() + opts[i][1] : tmr)}</small></button>`).join('')}</div>`}
    </div>`,
    onMount: (s, close) => s.addEventListener('click', e => {
      if (e.target.closest('[data-off]')) { e.stopPropagation(); api.setFocus(0); toast('Fokus selesai 👋'); close(); return; }
      const b = e.target.closest('[data-f]');
      if (!b) return;
      e.stopPropagation();
      const ms = opts[+b.dataset.f][1];
      api.setFocus(ms ? Date.now() + ms : tmr, s.querySelector('.fc-in').value.trim());
      toast('Mode fokus nyala 🎧'); buzz(10); close();
    }),
  });
}

/* ============ CEK KABAR ============
   "Gimana harimu?" — jawaban orang lain baru kebuka setelah kamu ikut jawab */
export const FEELS = ['😫', '😕', '😐', '🙂', '🤩'];
const FEEL_TXT = ['Berat', 'Kurang', 'Biasa', 'Oke', 'Mantap'];
const ansFor = (chatId, mid) => byRef(chatId, 'checkans', mid);
export function checkinHtml(m, chatId) {
  const all = [{ from: m.from, v: m.v, note: m.note }, ...ansFor(chatId, m.id)];
  const answered = all.some(a => a.from === ME);
  const name = id => id === ME ? 'Kamu' : esc(firstName(api.user(id)?.name || '?'));
  const head = `<div class="ck-h"><span>💭</span><b>Gimana harimu?</b></div>`;
  if (!answered) return `<div class="bubble checkin">${head}
    <small class="ck-lock">🔒 ${all.length} jawaban nunggu kamu</small>
    <div class="ck-pick">${FEELS.map((e, i) => `<button data-act="ck-ans" data-mid="${m.id}" data-v="${i}">${e}</button>`).join('')}</div></div>`;
  return `<div class="bubble checkin open">${head}<div class="ck-list">${all.map(a => `<div class="ck-row"><span class="ck-e">${FEELS[a.v] || '🙂'}</span><span class="ck-t"><b>${name(a.from)}</b><small>${esc(a.note || FEEL_TXT[a.v] || '')}</small></span></div>`).join('')}</div></div>`;
}
export function checkAnsHtml(m) {
  const who = m.from === ME ? 'Kamu' : esc(firstName(api.user(m.from)?.name || '?'));
  return `<div class="sys checkans"><span>💭 ${who} udah jawab cek kabar</span></div>`;
}
export function checkinSheet(chatId) {
  let v = 3;
  sheet({
    top: `<div class="fun-compose">
      <div class="fc-h">💭 <b>Cek kabar</b><small>Jawabanmu kebuka setelah teman ikut jawab</small></div>
      <div class="ck-pick big">${FEELS.map((e, i) => `<button class="${i === v ? 'on' : ''}" data-v="${i}">${e}</button>`).join('')}</div>
      <input class="fc-in" maxlength="60" placeholder="Ceritain dikit (opsional)">
      <button class="btn primary wide" data-go>Kirim</button>
    </div>`,
    onMount: (s, close) => {
      s.querySelectorAll('[data-v]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); v = +b.dataset.v; s.querySelectorAll('[data-v]').forEach(x => x.classList.toggle('on', x === b)); buzz(5); }));
      s.querySelector('[data-go]').addEventListener('click', e => {
        e.stopPropagation();
        api.send(chatId, { type: 'checkin', v, note: s.querySelector('.fc-in').value.trim() });
        buzz(10); close();
      });
    },
  });
}
export function answerCheckin(chatId, mid, v) {
  if (ansFor(chatId, mid).some(a => a.from === ME)) return;
  api.send(chatId, { type: 'checkans', ref: mid, v });
  buzz(10);
}

/* ============ MENU PINTAR ============ yang sering dipakai naik ke depan */
const USE_KEY = 'onix:funUse';
const useMap = () => { try { return JSON.parse(localStorage.getItem(USE_KEY) || '{}'); } catch { return {}; } };
export function noteUse(act) { try { const u = useMap(); u[act] = (u[act] || 0) + 1; localStorage.setItem(USE_KEY, JSON.stringify(u)); } catch { /* */ } }
export function sortByUse(items) { const u = useMap(); return items.map((x, i) => [x, i]).sort((a, b) => (u[b[0][0]] || 0) - (u[a[0][0]] || 0) || a[1] - b[1]).map(x => x[0]); }

/* ============ RINGKASAN BELUM DIBACA ============ */
export function catchUp(chatId, unread) {
  const ch = api.chat(chatId);
  if (!(unread >= 8)) return null;
  const list = api.messages(chatId).filter(m => m.from !== ME && m.type !== 'system').slice(-unread);
  if (list.length < 8) return null;
  const by = {}, kinds = {};
  const mentions = [];
  const re = new RegExp('@' + firstName(api.me().name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
  list.forEach(m => { by[m.from] = (by[m.from] || 0) + 1; kinds[m.type] = (kinds[m.type] || 0) + 1; if (re.test(m.text || '')) mentions.push(m.id); });
  const top = Object.entries(by).sort((a, b) => b[1] - a[1])[0];
  const bits = [];
  if (ch.type === 'group' && top) bits.push(`${firstName(api.user(top[0])?.name || '')} paling rame`);
  const K = { image: 'foto', video: 'video', voice: 'voice', poll: 'polling', event: 'event', pay: 'Pay', location: 'lokasi', file: 'file' };
  for (const [k, l] of Object.entries(K)) if (kinds[k]) bits.push(`${kinds[k]} ${l}`);
  return { n: list.length, first: list[0].id, mentions, sub: bits.slice(0, 4).join(' · ') };
}

/* ============ RODA PUTAR ============
   Bingung milih? Roda diputar sekali di HP pengirim, hasilnya sama di semua HP */
const WHEEL_COL = ['#7C5CFF', '#FF3D81', '#FFB020', '#10B26C', '#2E7BFF', '#FF7A1A', '#14B8C4', '#B05CFF'];
export function spinHtml(m) {
  const o = m.opts || [], n = o.length || 1, seg = 360 / n;
  const grad = o.map((_, i) => `${WHEEL_COL[i % WHEEL_COL.length]} ${i * seg}deg ${(i + 1) * seg}deg`).join(',');
  const labels = o.map((t, i) => `<em class="sp-lb" style="transform:translate(-50%,-50%) rotate(${(i + .5) * seg - 90}deg) translateX(50px)">${esc(t.slice(0, 12))}</em>`).join('');
  return `<div class="bubble spinmsg">${m.q ? `<b class="sp-q">${esc(m.q)}</b>` : ''}
    <div class="sp-box"><i class="sp-ptr"></i><div class="sp-wheel" data-spin="${m.id}" style="background:conic-gradient(${grad})">${labels}</div><i class="sp-hub"></i></div>
    <div class="sp-res">🎯 ${esc(o[m.pick] || '')}</div></div>`;
}
const spun = new Set();
export function initSpins(root, getMsg) {
  root.querySelectorAll('.sp-wheel:not([data-on])').forEach(w => {
    const m = getMsg(w.dataset.spin);
    if (!m?.opts?.length) return;
    w.dataset.on = 1;
    const seg = 360 / m.opts.length;
    const final = 360 * 6 + (360 - (m.pick + .5) * seg) + (m.jit || 0) * seg * .35;
    const res = w.closest('.spinmsg').querySelector('.sp-res');
    if (!spun.has(m.id) && Date.now() - m.ts < 20e3) {
      spun.add(m.id);
      res.classList.add('wait');
      w.style.transform = 'rotate(0deg)';
      requestAnimationFrame(() => requestAnimationFrame(() => {
        w.style.transition = 'transform 3.6s cubic-bezier(.17,.67,.12,1)';
        w.style.transform = `rotate(${final}deg)`;
      }));
      setTimeout(() => { res.classList.remove('wait'); res.classList.add('pop'); buzz([10, 30, 10]); }, 3700);
    } else w.style.transform = `rotate(${final}deg)`;
  });
}
export function spinSheet(chatId) {
  composeSheet({
    head: '🎡 <b>Roda putar</b><small>Satu pilihan per baris</small>',
    ph: 'Bakso\nSeblak\nMie ayam',
    go: 'Putar!',
    extra: `<input class="fc-in sp-qin" maxlength="50" placeholder="Pertanyaannya? (mis. Makan di mana?)">`,
    bind: s => {
      s._ok = v => {
        const opts = [...new Set(v.split('\n').map(x => x.trim()).filter(Boolean))].slice(0, 8);
        if (opts.length < 2) { toast('Minimal 2 pilihan'); return false; }
        api.send(chatId, { type: 'spin', q: s.querySelector('.sp-qin').value.trim(), opts, pick: Math.floor(Math.random() * opts.length), jit: +(Math.random() * 2 - 1).toFixed(2) });
        buzz(10);
      };
    },
  });
}

/* ============ SIAPA PALING…? ============
   Polling yang pilihannya otomatis anggota chat */
const WHO_Q = ['sering telat', 'receh', 'bucin', 'tidur mulu', 'jago masak', 'boros', 'galak', 'bakal kaya duluan'];
export function whoSheet(chatId) {
  const ch = api.chat(chatId);
  sheet({
    top: `<div class="fun-compose">
      <div class="fc-h">🤔 <b>Siapa paling…?</b><small>Pilihannya otomatis semua anggota</small></div>
      <div class="fc-chips">${WHO_Q.map(q => `<button data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>
      <div class="who-in"><span>Siapa paling</span><input class="fc-in" maxlength="40" placeholder="…"></div>
      <button class="btn primary wide" data-go>Kirim</button>
    </div>`,
    onMount: (s, close) => {
      const inp = s.querySelector('.fc-in');
      s.querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); inp.value = b.dataset.q; s.querySelectorAll('[data-q]').forEach(x => x.classList.toggle('on', x === b)); }));
      s.querySelector('[data-go]').addEventListener('click', e => {
        e.stopPropagation();
        const q = inp.value.trim().replace(/\?+$/, '');
        if (!q) { inp.focus(); return toast('Paling apa nih?'); }
        const names = ch.members.map(id => id === ME ? api.me().name : api.user(id)?.name).filter(Boolean).slice(0, 12);
        api.createPoll(chatId, `🤔 Siapa paling ${q}?`, names);
        buzz(10); close();
      });
    },
  });
}

/* ============ helper aksi bareng ============ */
const actsOf = m => Object.entries(m.acts || {});
const nm = id => id === ME ? 'Kamu' : firstName(api.user(id)?.name || '?');
const hueOf = id => (id === ME ? api.me() : api.user(id))?.hue ?? 260;
// mode demo: teman ikut main
function demoPeer(chatId, mid, fn, ms = 2500) {
  const ch = api.chat(chatId);
  if (!ch || ch.remote) return;
  const peer = ch.members.find(id => id !== ME && !api.user(id)?.official);
  if (peer) setTimeout(() => fn(peer), ms);
}

/* ============ CHECKLIST BARENG ============ */
export function todoState(m) {
  const st = (m.items || []).map(() => ({ done: false, by: null, ts: 0 }));
  for (const [uid, v] of actsOf(m)) for (const [i, a] of Object.entries(v || {})) {
    const s = st[+i];
    if (s && Array.isArray(a) && a[1] > s.ts) Object.assign(s, { done: !!a[0], by: uid, ts: a[1] });
  }
  return st;
}
export function todoHtml(m) {
  const st = todoState(m), done = st.filter(s => s.done).length;
  return `<div class="bubble todo"><div class="td-h"><b>☑️ ${esc(m.title || 'Checklist')}</b><small>${done}/${st.length}</small></div>
    <div class="td-bar"><i style="width:${st.length ? Math.round(done / st.length * 100) : 0}%"></i></div>
    ${(m.items || []).map((t, i) => `<button class="td-row ${st[i].done ? 'on' : ''}" data-act="todo-tick" data-mid="${m.id}" data-i="${i}"><span class="td-box">${icon('check')}</span><span class="td-t">${esc(t)}</span>${st[i].done ? `<small style="--h:${hueOf(st[i].by)}">${esc(nm(st[i].by))}</small>` : ''}</button>`).join('')}</div>`;
}
export function todoTick(chatId, m, i) {
  const cur = todoState(m)[i];
  const mine = { ...(m.acts?.[ME] || {}), [i]: [cur.done ? 0 : 1, Date.now()] };
  api.funAct(chatId, m.id, mine);
  buzz(cur.done ? 5 : [8, 30, 8]);
}
export function todoSheet(chatId) {
  composeSheet({
    head: '☑️ <b>Checklist bareng</b><small>Satu item per baris, semua bisa centang</small>',
    ph: 'Beli es batu\nBawa speaker\nPesen tempat',
    go: 'Kirim',
    extra: `<input class="fc-in td-title" maxlength="40" placeholder="Judul (mis. Persiapan camping)">`,
    bind: s => {
      s._ok = v => {
        const items = v.split('\n').map(x => x.trim()).filter(Boolean).slice(0, 15);
        if (!items.length) return false;
        const m = api.send(chatId, { type: 'todo', title: s.querySelector('.td-title').value.trim() || 'Checklist', items });
        demoPeer(chatId, m.id, p => api.funActAs(chatId, m.id, p, { 0: [1, Date.now()] }), 3000);
        buzz(10);
      };
    },
  });
}

/* ============ LANJUTIN CERITA ============
   Cerita estafet: tiap orang nambah satu kalimat, nggak boleh dua kali berturut-turut */
export function storyLines(m) {
  const lines = [{ from: m.from, t: m.start || '', ts: 0 }];
  for (const [uid, v] of actsOf(m)) for (const l of (Array.isArray(v) ? v : [])) lines.push({ from: uid, t: l.t, ts: l.ts });
  return lines.sort((a, b) => a.ts - b.ts);
}
export function storyHtml(m) {
  const lines = storyLines(m), last = lines[lines.length - 1];
  const myTurn = last.from !== ME;
  return `<div class="bubble chain"><div class="ch-h">📖 <b>Cerita bareng</b><small>${lines.length} kalimat</small></div>
    <div class="ch-body">${lines.map(l => `<p><b style="--h:${hueOf(l.from)}">${esc(nm(l.from))}</b> ${esc(l.t)}</p>`).join('')}</div>
    <button class="ch-add" data-act="story-add" data-mid="${m.id}" ${myTurn ? '' : 'disabled'}>${myTurn ? '✍️ Lanjutin' : '⏳ Tunggu giliran teman'}</button></div>`;
}
export async function storyAdd(chatId, m) {
  const lines = storyLines(m);
  if (lines[lines.length - 1].from === ME) return toast('Gantian dong 😆');
  const { promptBox } = await import('./ui.js');
  const t = await promptBox({ title: 'Lanjutin ceritanya…', placeholder: 'Terus tiba-tiba…', ok: 'Tambah', max: 140 });
  if (!t) return;
  const mine = Array.isArray(m.acts?.[ME]) ? m.acts[ME] : [];
  api.funAct(chatId, m.id, [...mine, { t, ts: Date.now() }].slice(-20));
  buzz(8);
  demoPeer(chatId, m.id, p => { const cur = Array.isArray(m.acts?.[p]) ? m.acts[p] : []; api.funActAs(chatId, m.id, p, [...cur, { t: ['terus semuanya kaget 😱', 'eh ternyata itu cuma mimpi wkwk', 'dan kucingnya ngomong "halo"', 'tapi tiba-tiba hujan deres 🌧️'][Math.floor(Math.random() * 4)], ts: Date.now() }]); }, 3500);
}
export function storySheet(chatId) {
  composeSheet({
    head: '📖 <b>Lanjutin cerita</b><small>Tulis pembuka, teman nambah satu-satu</small>',
    ph: 'Suatu hari di kantin kampus…', go: 'Mulai cerita',
    bind: s => { s._ok = v => { api.send(chatId, { type: 'story', start: v.slice(0, 200) }); buzz(10); }; },
  });
}

/* ============ TEBAK GAMBAR ============
   Coretan + kata rahasia. Teman nebak, yang bener dapet ✅ */
const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
export function guessHtml(m) {
  if (!m.word) return '';
  const mine = m.from === ME;
  const gs = actsOf(m).filter(([, v]) => v && typeof v === 'object');
  const me = m.acts?.[ME];
  const right = gs.filter(([, v]) => v.ok);
  let body;
  if (mine) body = gs.length ? gs.map(([u, v]) => `<span class="${v.ok ? 'ok' : ''}">${esc(nm(u))}: ${v.ok ? '✅' : `${v.n}x ❌`}</span>`).join('') : '<span>Belum ada yang nebak</span>';
  else if (me?.ok) body = `<span class="ok">✅ Bener! <b>${esc(m.word)}</b></span>`;
  else body = `<button data-act="guess" data-mid="${m.id}">🤔 Tebak${me?.n ? ` lagi (${me.n}x salah)` : ''}</button>`;
  return `<div class="dd-guess"><small>${mine ? `Kata: <b>${esc(m.word)}</b>` : `Tebak gambar · ${right.length} bener`}</small>${body}</div>`;
}
export async function guess(chatId, m) {
  const { promptBox } = await import('./ui.js');
  const g = await promptBox({ title: 'Ini gambar apa?', placeholder: 'Jawabanmu', ok: 'Tebak', max: 30 });
  if (!g) return;
  const ok = norm(g) === norm(m.word);
  const prev = m.acts?.[ME] || { n: 0 };
  api.funAct(chatId, m.id, { ok, n: (prev.n || 0) + (ok ? 0 : 1), g: g.slice(0, 30), ts: Date.now() });
  if (ok) { toast('BENER! 🎉'); buzz([10, 40, 10, 40, 10]); } else { toast('Salah, coba lagi 😆'); buzz([30, 50, 30]); }
}

/* ============ STIKER DARI TEKS ============ */
const TS_STYLES = [
  { bg: null, fill: ['#FF3D81', '#7C5CFF'], stroke: '#fff', sw: 18, shadow: 'rgba(0,0,0,.25)' },
  { bg: '#FFD23F', fill: ['#15151C', '#15151C'], stroke: null, pill: true },
  { bg: null, fill: ['#2EE6FF', '#B06CFF'], stroke: '#15151C', sw: 10, glow: '#2EE6FF' },
  { bg: null, fill: ['#FFB020', '#FF5C38'], stroke: '#15151C', sw: 12, retro: true },
];
function wrapLines(x, text, maxW) {
  const words = text.split(/\s+/), lines = [];
  let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (x.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur);
  return lines.slice(0, 4);
}
export function textSticker(text, si, size = 300) {
  const st = TS_STYLES[si], cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const x = cv.getContext('2d'), F = '900 {s}px -apple-system, "SF Pro Rounded", system-ui, sans-serif';
  let fs = 92, lines;
  do { x.font = F.replace('{s}', fs); lines = wrapLines(x, text, size * .82); fs -= 4; }
  while (fs > 26 && (lines.length * fs * 1.1 > size * .78 || lines.some(l => x.measureText(l).width > size * .86)));
  fs += 4;
  x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
  const lh = fs * 1.08, y0 = size / 2 - (lines.length - 1) * lh / 2;
  x.save(); x.translate(size / 2, size / 2); x.rotate(-.06); x.translate(-size / 2, -size / 2);
  if (st.pill) {
    const w = Math.max(...lines.map(l => x.measureText(l).width)) + 50, hh = lines.length * lh + 36;
    x.fillStyle = st.bg; x.shadowColor = 'rgba(0,0,0,.2)'; x.shadowBlur = 14; x.shadowOffsetY = 6;
    x.beginPath(); x.roundRect((size - w) / 2, (size - hh) / 2, w, hh, 30); x.fill();
    x.shadowColor = 'transparent';
  }
  lines.forEach((l, i) => {
    const y = y0 + i * lh;
    if (st.retro) { x.fillStyle = '#15151C'; x.fillText(l, size / 2 + 7, y + 7); }
    if (st.stroke) { x.strokeStyle = st.stroke; x.lineWidth = st.sw; if (st.shadow) { x.shadowColor = st.shadow; x.shadowBlur = 10; x.shadowOffsetY = 4; } x.strokeText(l, size / 2, y); x.shadowColor = 'transparent'; }
    const g = x.createLinearGradient(0, y - fs / 2, 0, y + fs / 2);
    g.addColorStop(0, st.fill[0]); g.addColorStop(1, st.fill[1]);
    if (st.glow) { x.shadowColor = st.glow; x.shadowBlur = 24; }
    x.fillStyle = g; x.fillText(l, size / 2, y);
    x.shadowColor = 'transparent';
  });
  x.restore();
  return cv.toDataURL('image/png');
}
export function textStickerSheet(chatId, onSent) {
  sheet({
    top: `<div class="fun-compose">
      <div class="fc-h">💬 <b>Stiker teks</b><small>Ketik, pilih gaya, langsung jadi stiker</small></div>
      <input class="fc-in" maxlength="40" placeholder="GAS!! / otw / makasih bestie" value="GAS!!">
      <div class="tsk-grid">${TS_STYLES.map((_, i) => `<button data-st="${i}"><img alt=""></button>`).join('')}</div>
      <label class="tsk-save"><input type="checkbox" checked> Simpan ke stiker buatanku</label>
    </div>`,
    onMount: (s, close) => {
      const inp = s.querySelector('.fc-in'), imgs = [...s.querySelectorAll('.tsk-grid img')];
      const draw = () => { const t = inp.value.trim() || '…'; imgs.forEach((im, i) => { im.src = textSticker(t, i, 200); }); };
      let tm; inp.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(draw, 120); });
      draw();
      s.querySelectorAll('[data-st]').forEach(b => b.addEventListener('click', e => {
        e.stopPropagation();
        const t = inp.value.trim();
        if (!t) return inp.focus();
        const src = textSticker(t, +b.dataset.st);
        if (s.querySelector('.tsk-save input').checked) api.addMySticker(src);
        api.send(chatId, { type: 'sticker', sticker: '💬', img: src });
        buzz(10); close(); onSent?.();
      }));
    },
  });
}

/* ============ SOPANIN ============
   Pesan gaul -> bahasa sopan buat dosen / atasan (tanpa AI, pakai kamus) */
const SOPAN = {
  'gw|gue|gua|aku|ak|w': 'saya', 'lu|lo|elu|elo|kamu|km|u': '{A}', 'gak|ga|gk|nggak|ngga|enggak|engga|kagak|g': 'tidak',
  'udh|udah|dah|sdh': 'sudah', 'blm|belom|blom': 'belum', 'tp|tapi': 'tetapi', 'yg': 'yang', 'dgn|ama|sama': 'dengan',
  'krn|karna|soalnya': 'karena', 'bgt|banget|bngt': '', 'ttg': 'tentang', 'dlm': 'dalam', 'trs|terus': 'lalu', 'msh|masih': 'masih', 'pak|bapak': 'Bapak', 'bu|ibu': 'Ibu', 'aja|doang': 'saja', 'gimana|gmn|gmna': 'bagaimana', 'knp|kenapa|napa': 'mengapa',
  'mau|pengen|pgn|pingin': 'ingin', 'tau': 'tahu', 'ok|oke|okee|okey|sip|siap': 'baik', 'makasih|mksh|makasi|thx|thanks|tengkyu|thank': 'terima kasih',
  'sorry|sori|sory|maap|maaf': 'mohon maaf', 'bsk|besok': 'besok', 'skrg|skrng|sekarang': 'sekarang', 'dmn|dimana': 'di mana', 'jg|juga': 'juga',
  'utk|buat': 'untuk', 'kalo|klo|kl': 'apabila', 'emang|emg': 'memang', 'nanya|nanyain': 'bertanya', 'ngerjain': 'mengerjakan', 'ngumpulin|ngumpul': 'mengumpulkan',
  'bales|balas': 'membalas', 'liat|lihat': 'melihat', 'ketemu': 'bertemu', 'bikin': 'membuat', 'ngasih': 'memberikan', 'nunggu': 'menunggu', 'nyampe|nyampai': 'sampai',
  'telat': 'terlambat', 'abis|habis': 'setelah', 'gede': 'besar', 'kayak|kek|kyk': 'seperti', 'cuma|cuman': 'hanya', 'udahan': 'selesai', 'bener|bnr': 'benar',
  'td|tadi': 'tadi', 'kmrn|kemaren': 'kemarin', 'pd|pada': 'pada', 'dr|dari': 'dari', 'sy': 'saya', 'tlg|tolong': 'mohon', 'ijin|izin': 'izin', 'bs|bisa': 'bisa',
};
const SOPAN_RE = Object.entries(SOPAN).map(([k, v]) => [new RegExp(`(^|[^\\p{L}])(${k})(?=$|[^\\p{L}])`, 'giu'), v]);
export const sapaOf = text => { const m = text.trim().match(/^(pak|bapak|bu|ibu|kak|kakak)\b[\s,.]*/i); return m ? ({ pak: 'Bapak', bapak: 'Bapak', bu: 'Ibu', ibu: 'Ibu' }[m[1].toLowerCase()] || 'Kak') : null; };
export function sopanin(text, sapa = 'Bapak') {
  text = text.trim().replace(/^(pak|bapak|bu|ibu|kak|kakak)\b[\s,.]*/i, '');
  const hasSalam = /^(selamat|assalamu|permisi|halo|hai)/i.test(text);
  let t = ' ' + text.replace(/(\p{L})\1{2,}/gu, '$1') + ' ';   // yaaa -> ya
  t = t.replace(/\p{Extended_Pictographic}|‍|️/gu, '').replace(/\b(wk)+w?k*\b|\b(ha){2,}\b|\b(he){2,}\b|\bxixi\w*/gi, '');
  t = t.replace(/[!?]{2,}/g, m => m[0]);
  for (const [re, v] of SOPAN_RE) t = t.replace(re, (m, a) => a + v.replace('{A}', sapa));
  t = t.replace(/\s+(ya|yah|deh|dong|sih|nih|tuh|kok|loh|lho|nya kak)(?=[\s.,!?]|$)/gi, '').replace(/\s{2,}/g, ' ').trim();
  t = t.split(/(?<=[.!?])\s+/).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
  if (t && !/[.!?]$/.test(t)) t += '.';
  const h = new Date().getHours();
  const salam = `Selamat ${h < 11 ? 'pagi' : h < 15 ? 'siang' : h < 18 ? 'sore' : 'malam'}, ${sapa}.`;
  const out = [];
  if (!hasSalam) out.push(salam, /^mohon maaf/i.test(t) ? '' : 'Mohon maaf mengganggu waktunya.');
  out.push(t);
  if (!/terima kasih/i.test(t)) out.push('Terima kasih.');
  return out.filter(Boolean).join(' ');
}
export function sopanSheet(text, onUse) {
  if (!text.trim()) return toast('Ketik pesannya dulu, nanti aku sopanin ✨');
  let sapa = sapaOf(text) || 'Bapak';
  sheet({
    top: `<div class="fun-compose">
      <div class="fc-h">🎩 <b>Sopanin</b><small>Buat chat dosen / atasan</small></div>
      <div class="fc-chips">${['Bapak', 'Ibu', 'Kak'].map(s => `<button class="${s === sapa ? 'on' : ''}" data-s="${s}">${s}</button>`).join('')}</div>
      <div class="sop-old">${esc(text)}</div>
      <div class="sop-new"></div>
      <button class="btn primary wide" data-go>Pakai</button>
    </div>`,
    onMount: (s, close) => {
      const out = s.querySelector('.sop-new');
      const draw = () => { out.textContent = sopanin(text, sapa); };
      draw();
      s.querySelectorAll('[data-s]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); sapa = b.dataset.s; s.querySelectorAll('[data-s]').forEach(x => x.classList.toggle('on', x === b)); draw(); }));
      s.querySelector('[data-go]').addEventListener('click', e => { e.stopPropagation(); onUse(out.textContent); close(); buzz(8); });
    },
  });
}

/* ============ KAPAN BISA? ============
   Cari hari ketemuan: tiap orang centang hari yang bisa, hari terbaik ditandai 👑 */
const dKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dLabel = k => new Date(k + 'T12:00').toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
export function whenHtml(m) {
  const votes = {};
  for (const [u, v] of actsOf(m)) for (const d of (Array.isArray(v) ? v : [])) (votes[d] ||= []).push(u);
  const best = Math.max(0, ...(m.days || []).map(d => (votes[d] || []).length));
  const n = actsOf(m).length;
  return `<div class="bubble when"><div class="wh-h"><b>📅 ${esc(m.title || 'Kapan bisa?')}</b><small>${n} orang ngisi</small></div>
    ${(m.days || []).map(d => { const vs = votes[d] || [], on = vs.includes(ME); return `<button class="wh-row ${on ? 'on' : ''} ${best && vs.length === best ? 'best' : ''}" data-act="when-tick" data-mid="${m.id}" data-d="${d}">
      <span class="wh-chk">${icon('check')}</span><span class="wh-d">${dLabel(d)}${best && vs.length === best ? ' 👑' : ''}</span>
      <span class="wh-av">${vs.slice(0, 4).map(u => avatar(u === ME ? api.me() : api.user(u), 20)).join('')}</span><b>${vs.length || ''}</b></button>`; }).join('')}</div>`;
}
export function whenTick(chatId, m, d) {
  const mine = Array.isArray(m.acts?.[ME]) ? m.acts[ME] : [];
  api.funAct(chatId, m.id, mine.includes(d) ? mine.filter(x => x !== d) : [...mine, d]);
  buzz(6);
}
export function whenSheet(chatId) {
  const days = [...Array(14)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() + i + 1); return dKey(d); });
  const picked = new Set(days.slice(0, 7).filter(k => [5, 6, 0].includes(new Date(k + 'T12:00').getDay())));
  sheet({
    top: `<div class="fun-compose">
      <div class="fc-h">📅 <b>Kapan bisa?</b><small>Pilih hari-hari pilihan, teman centang yang bisa</small></div>
      <input class="fc-in" maxlength="40" placeholder="Acara apa? (mis. Nonton bareng)">
      <div class="wh-pick">${days.map(k => `<button class="${picked.has(k) ? 'on' : ''}" data-k="${k}"><small>${new Date(k + 'T12:00').toLocaleDateString('id-ID', { weekday: 'short' })}</small><b>${+k.slice(8)}</b></button>`).join('')}</div>
      <button class="btn primary wide" data-go>Kirim</button>
    </div>`,
    onMount: (s, close) => {
      s.querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); const k = b.dataset.k; picked.has(k) ? picked.delete(k) : picked.add(k); b.classList.toggle('on'); buzz(4); }));
      s.querySelector('[data-go]').addEventListener('click', e => {
        e.stopPropagation();
        if (picked.size < 2) return toast('Pilih minimal 2 hari');
        const ds = [...picked].sort();
        const m = api.send(chatId, { type: 'when', title: s.querySelector('.fc-in').value.trim() || 'Kapan bisa?', days: ds });
        demoPeer(chatId, m.id, p => api.funActAs(chatId, m.id, p, ds.filter(() => Math.random() < .6)), 3000);
        buzz(10); close();
      });
    },
  });
}

/* ============ BOM WAKTU ============
   Bom dioper-oper. Sumbunya rahasia (20-45 detik). Yang megang pas meledak, kalah! */
export function bombState(m) {
  const passes = [];
  const map = id => api.remote?.mapId ? api.remote.mapId(id) : id;
  for (const [u, v] of actsOf(m)) for (const p of (Array.isArray(v) ? v : [])) passes.push({ by: u, to: map(p.to), ts: p.ts });
  passes.sort((a, b) => a.ts - b.ts);
  let holder = m.from, n = 0;
  for (const p of passes) if (p.by === holder && p.ts < m.endAt) { holder = p.to; n++; }
  return { holder, n, done: Date.now() >= m.endAt };
}
export function bombHtml(m) {
  const s = bombState(m), who = nm(s.holder);
  if (s.done) return `<div class="bubble bomb boom"><div class="bm-ic">💥</div><b>BOOM!</b><small>${s.holder === ME ? 'Kamu kena 😭' : esc(who) + ' kena 😂'} · ${s.n}x dioper</small></div>`;
  const mine = s.holder === ME;
  return `<div class="bubble bomb ${mine ? 'hot' : ''}"><div class="bm-ic">💣</div><b>${mine ? 'Bomnya di KAMU!' : `Bom di ${esc(who)}`}</b><small>Sumbunya rahasia… · ${s.n}x dioper</small>
    ${mine ? `<button data-act="bomb-pass" data-mid="${m.id}">Oper! 👉</button>` : ''}</div>`;
}
export function bombPass(chatId, m) {
  const s = bombState(m);
  if (s.done || s.holder !== ME) return;
  const ch = api.chat(chatId), others = ch.members.filter(id => id !== ME && !api.user(id)?.official);
  if (!others.length) return;
  const go = to => {
    const mine = Array.isArray(m.acts?.[ME]) ? m.acts[ME] : [];
    api.funAct(chatId, m.id, [...mine, { to, ts: Date.now() }].slice(-30));
    buzz(12);
    // mode demo: teman oper balik
    demoPeer(chatId, m.id, p => { if (bombState(m).holder === to && !bombState(m).done) { const cur = Array.isArray(m.acts?.[to]) ? m.acts[to] : []; api.funActAs(chatId, m.id, to, [...cur, { to: ME, ts: Date.now() }]); } }, 1500 + Math.random() * 2500);
  };
  if (others.length === 1) return go(others[0]);
  sheet({ title: 'Oper ke siapa?', actions: others.map(id => ({ label: api.user(id)?.name || '?', run: () => go(id) })) });
}
export function bombSend(chatId) {
  const m = api.send(chatId, { type: 'bomb', endAt: Date.now() + (20 + Math.random() * 25) * 1000 });
  buzz([20, 40, 20]);
  return m;
}

/* ============ TANTANGAN FOTO ============
   "Foto langit sekarang!" — semua kirim foto, kumpul di kartunya */
const CHAL = ['Foto langit sekarang ☁️', 'Pose paling aneh 🤪', 'Isi kulkasmu 🧊', 'Sepatu yang lagi dipake 👟', 'Pemandangan dari jendela 🪟', 'Makanan terakhir 🍜', 'Sesuatu warna ungu 💜', 'Meja kamu sekarang 💻'];
export function challengeHtml(m, chatId) {
  const pics = byRef(chatId, 'image', m.id), open = Date.now() < m.until;
  const done = pics.some(p => p.from === ME);
  const left = Math.max(0, Math.ceil((m.until - Date.now()) / 60e3));
  return `<div class="bubble chal"><div class="cl-h"><span>📸</span><div><small>Tantangan foto</small><b>${esc(m.task)}</b></div></div>
    ${pics.length ? `<div class="cl-grid">${pics.slice(0, 6).map(p => `<button data-act="goto" data-mid="${p.id}"><img src="${p.src}" alt="" loading="lazy"><i>${esc(nm(p.from))}</i></button>`).join('')}</div>` : ''}
    <div class="cl-f"><small>${open ? `⏳ ${left} menit lagi · ${pics.length} foto` : `Selesai · ${pics.length} foto`}</small>${open && !done ? `<button data-act="chal-join" data-mid="${m.id}">Ikutan</button>` : done ? '<small>✅ kamu ikut</small>' : ''}</div></div>`;
}
export async function challengeJoin(chatId, m) {
  const f = await pickFile('image/*', 'environment');
  if (!f) return;
  try { const img = await compressImage(f, 900, .72); api.send(chatId, { type: 'image', ...img, ref: m.id, chal: true }); buzz(10); }
  catch { toast('Gagal memuat foto 😢'); }
}
export function challengeSheet(chatId) {
  let mins = 10;
  sheet({
    top: `<div class="fun-compose">
      <div class="fc-h">📸 <b>Tantangan foto</b><small>Semua kirim foto, kumpul jadi satu</small></div>
      <div class="fc-chips cl-ideas">${CHAL.map(c => `<button data-c="${esc(c)}">${esc(c)}</button>`).join('')}</div>
      <input class="fc-in" maxlength="50" placeholder="Atau tulis tantanganmu">
      <div class="fc-chips">${[5, 10, 30, 60].map(n => `<button class="${n === 10 ? 'on' : ''}" data-n="${n}">${n < 60 ? n + ' menit' : '1 jam'}</button>`).join('')}</div>
      <button class="btn primary wide" data-go>Mulai tantangan</button>
    </div>`,
    onMount: (s, close) => {
      const inp = s.querySelector('.fc-in');
      s.querySelectorAll('[data-c]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); inp.value = b.dataset.c; s.querySelectorAll('[data-c]').forEach(x => x.classList.toggle('on', x === b)); }));
      s.querySelectorAll('[data-n]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); mins = +b.dataset.n; s.querySelectorAll('[data-n]').forEach(x => x.classList.toggle('on', x === b)); }));
      s.querySelector('[data-go]').addEventListener('click', e => {
        e.stopPropagation();
        const task = inp.value.trim();
        if (!task) return toast('Pilih atau tulis tantangannya');
        api.send(chatId, { type: 'challenge', task, until: Date.now() + mins * 60e3 });
        buzz(10); close();
      });
    },
  });
}

/* ============ KARTU HOKI HARIAN ============
   Tiap orang dapet kartu beda tiap hari (dari ID + tanggal), buat seru-seruan */
const LUCK = ['Hari ini cocok buat mulai hal baru ✨', 'Ada kabar baik dari orang yang nggak kamu sangka 📩', 'Jangan lupa minum air, kamu butuh 💧', 'Rezeki nomplok: jajan gratis kemungkinan besar 🍩', 'Seseorang lagi kangen kamu 🫶', 'Waktunya istirahat, jangan dipaksa 🛌', 'Chat duluan, nanti dibales cepet 📱', 'Outfit kamu bakal dipuji hari ini 👗', 'Ide brilian datang pas mandi 🚿', 'Hati-hati boros di e-commerce 🛒', 'Ketawa paling kenceng hari ini 😂', 'Tugas yang ditunda bakal kelar 💪'];
const LUCK_COL = [['Ungu', '#7C5CFF'], ['Pink', '#FF3D81'], ['Kuning', '#FFB020'], ['Hijau', '#10B26C'], ['Biru', '#2E7BFF'], ['Oranye', '#FF7A1A'], ['Tosca', '#14B8C4']];
const LUCK_EMO = ['🍀', '🌈', '⭐', '🔮', '🌙', '☀️', '🦋', '🍓', '🎐', '🪐'];
export function myFortune(uid = api.remote?.state?.()?.uid || api.me().id || 'me') {
  const d = new Date();
  let k = 7;
  for (const ch of uid + d.toDateString()) k = (Math.imul(k, 31) + ch.charCodeAt(0)) >>> 0;
  return { day: d.toDateString(), text: LUCK[k % LUCK.length], col: LUCK_COL[(k >> 3) % LUCK_COL.length], num: 1 + (k >> 6) % 99, emo: LUCK_EMO[(k >> 9) % LUCK_EMO.length], pct: 40 + (k >> 12) % 61 };
}
const fortuneCard = f => `<div class="ft-card" style="--c:${f.col[1]}"><div class="ft-emo">${f.emo}</div><b>${esc(f.text)}</b>
  <div class="ft-stats"><span><small>Hoki</small>${f.pct}%</span><span><small>Angka</small>${f.num}</span><span><small>Warna</small>${esc(f.col[0])}</span></div></div>`;
export function fortuneHtml(m) {
  const who = m.from === ME ? 'Kartu hoki kamu' : `Kartu hoki ${esc(nm(m.from))}`;
  return `<div class="bubble fortune"><small class="ft-who">🔮 ${who} · ${new Date(m.ts).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</small>${fortuneCard(m.f)}${m.from === ME ? '' : '<button data-act="fortune" class="ft-mine">Cek punyaku</button>'}</div>`;
}
export function fortuneSheet(chatId) {
  const f = myFortune();
  sheet({
    top: `<div class="ft-sh"><div class="ft-flip">${fortuneCard(f)}</div><small>Ganti tiap hari, cuma buat seru-seruan 😆</small>${chatId ? '<button class="btn primary wide" data-go>Kirim ke chat</button>' : ''}</div>`,
    onMount: (s, close) => s.querySelector('[data-go]')?.addEventListener('click', e => { e.stopPropagation(); api.send(chatId, { type: 'fortune', f }); buzz(10); close(); }),
  });
}

/* ============ EMOJI CAMPUR ============ */
const MIX = ['😂', '🥹', '😎', '🥺', '😡', '😴', '🤡', '👻', '💀', '🐱', '🐸', '🐶', '🍩', '🍕', '🔥', '💖', '⭐', '🌈', '👑', '🎧', '🌚', '🙈', '🤓', '🫠'];
export function mixEmoji(a, b, mode, size = 240) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const x = cv.getContext('2d'), F = s => `${s}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  x.textAlign = 'center'; x.textBaseline = 'middle';
  const put = (e, s, cx, cy, rot = 0) => { x.save(); x.translate(cx, cy); x.rotate(rot); x.font = F(s); x.fillText(e, 0, s * .06); x.restore(); };
  x.shadowColor = 'rgba(0,0,0,.18)'; x.shadowBlur = 12; x.shadowOffsetY = 6;
  if (mode === 0) { put(a, size * .72, size * .5, size * .52); put(b, size * .42, size * .74, size * .74, .25); }
  else if (mode === 1) { put(a, size * .62, size * .5, size * .58); put(b, size * .42, size * .5, size * .2, -.1); }
  else { put(a, size * .5, size * .3, size * .5, -.2); put(b, size * .5, size * .7, size * .5, .2); }
  return cv.toDataURL('image/png');
}
export function mixSheet(chatId) {
  let a = '😎', b = '👑', mode = 0;
  sheet({
    top: `<div class="fun-compose">
      <div class="fc-h">🧪 <b>Emoji campur</b><small>Pilih dua emoji, jadi stiker</small></div>
      <div class="mx-prev"><img alt=""></div>
      <div class="fc-chips">${['Pegang', 'Topi', 'Kembar'].map((l, i) => `<button class="${i ? '' : 'on'}" data-m="${i}">${l}</button>`).join('')}</div>
      <div class="mx-row" data-r="a">${MIX.map(e => `<button class="${e === a ? 'on' : ''}" data-e="${e}">${e}</button>`).join('')}</div>
      <div class="mx-row" data-r="b">${MIX.map(e => `<button class="${e === b ? 'on' : ''}" data-e="${e}">${e}</button>`).join('')}</div>
      <button class="btn primary wide" data-go>Kirim stiker</button>
    </div>`,
    onMount: (s, close) => {
      const img = s.querySelector('.mx-prev img');
      const draw = () => { img.src = mixEmoji(a, b, mode, 220); };
      draw();
      s.querySelectorAll('.mx-row').forEach(row => row.addEventListener('click', e => {
        const btn = e.target.closest('[data-e]'); if (!btn) return; e.stopPropagation();
        if (row.dataset.r === 'a') a = btn.dataset.e; else b = btn.dataset.e;
        row.querySelectorAll('[data-e]').forEach(x => x.classList.toggle('on', x === btn)); draw(); buzz(4);
      }));
      s.querySelectorAll('[data-m]').forEach(btn => btn.addEventListener('click', e => { e.stopPropagation(); mode = +btn.dataset.m; s.querySelectorAll('[data-m]').forEach(x => x.classList.toggle('on', x === btn)); draw(); }));
      s.querySelector('[data-go]').addEventListener('click', e => {
        e.stopPropagation();
        const src = mixEmoji(a, b, mode);
        api.addMySticker(src);
        api.send(chatId, { type: 'sticker', sticker: a + b, img: src });
        buzz(10); close();
      });
    },
  });
}

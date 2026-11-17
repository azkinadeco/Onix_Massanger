import { TTL_OPTS, ttlLabel, suitResult, rupiah } from './service.js';
import { canCall, callSession } from './backend.js';
import { api, bus, ME, firstName, mentionRe } from './service.js';
import { $, h, esc, linkify, avatar, hm, dayLabel, isSameDay, dur, hash, vibrate, pickFile, pickFiles, compressImage, copyText, isJumbo } from './util.js';
import { icon } from './icons.js';
import { router, bindActs, onLongPress, sheet, toast, confirmBox } from './ui.js';
import { chatAvatar, presence, verified } from './views.js';
import { STICKERS, STICKER_TABS, EMOJIS, ANIM_STICKERS, STORE_PACKS } from './seed.js';
import { putMedia, mediaURL, videoInfo, fmtSize, fileExt } from './media.js';
import { ProfileScreen, GroupInfoScreen, AlbumScreen, openImage, openGallery } from './screens.js';
import { forwardMessage, keepFromMessage, PollComposeScreen, wallpaperSheet, EventComposeScreen, NotesScreen, StickerStoreScreen, scheduleSheet, fmtWhen, openStickerMaker } from './features.js';

const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// jalankan fn hanya di bagian teks (bukan di dalam tag HTML)
/* ---------- format teks: *tebal* _miring_ ~coret~ `kode` ---------- */
export function fmtMarks(html) {
  const B = '(^|[\\s(>])', E = '(?=$|[\\s.,!?:;)<])';
  const parts = html.split(/(`[^`\n]+`)/);
  return parts.map(p => {
    if (/^`[^`\n]+`$/.test(p)) return `<code>${p.slice(1, -1)}</code>`;
    return p
      .replace(new RegExp(B + '\\*([^*\\n]+?)\\*' + E, 'g'), '$1<b>$2</b>')
      .replace(new RegExp(B + '_([^_\\n]+?)_' + E, 'g'), '$1<i>$2</i>')
      .replace(new RegExp(B + '~([^~\\n]+?)~' + E, 'g'), '$1<s>$2</s>');
  }).join('');
}
export const stripMarks = s => String(s || '').replace(/(^|\s)[*_~`]([^*_~`\n]+)[*_~`](?=$|[\s.,!?])/g, '$1$2');

/* ---------- preview link (dummy, tanpa server) ---------- */
const SITES = {
  'youtube.com': ['YouTube', '▶️', '#FF0033'], 'youtu.be': ['YouTube', '▶️', '#FF0033'],
  'instagram.com': ['Instagram', '📸', '#E1306C'], 'tiktok.com': ['TikTok', '🎵', '#111'],
  'spotify.com': ['Spotify', '🎧', '#1DB954'], 'github.com': ['GitHub', '🐙', '#24292F'],
  'x.com': ['X', '✖️', '#111'], 'twitter.com': ['X', '✖️', '#111'],
  'google.com': ['Google', '🔎', '#4285F4'], 'tokopedia.com': ['Tokopedia', '🛍️', '#03AC0E'],
  'shopee.co.id': ['Shopee', '🛒', '#EE4D2D'], 'wikipedia.org': ['Wikipedia', '📖', '#666'],
};
function linkCard(text) {
  const mm = String(text || '').match(/https?:\/\/[^\s<]+/);
  if (!mm) return '';
  let u;
  try { u = new URL(mm[0]); } catch { return ''; }
  const host = u.hostname.replace(/^www\.|^m\./, '');
  const key = Object.keys(SITES).find(k => host === k || host.endsWith('.' + k));
  const [name, emo, col] = key ? SITES[key] : [host, '🔗', `hsl(${hash(host) % 360} 60% 52%)`];
  const seg = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() || '').replace(/[-_+]/g, ' ').replace(/\.\w+$/, '');
  const title = seg && seg.length > 2 && !/^[\w]{10,}$/.test(seg) ? seg.charAt(0).toUpperCase() + seg.slice(1) : name;
  return `<a class="link-card" href="${esc(mm[0])}" target="_blank" rel="noopener" style="--lc:${col}"><span class="lc-thumb">${emo}</span><span class="lc-txt"><b>${esc(title.slice(0, 60))}</b><small>${esc(host)}</small></span></a>`;
}

/* ---------- efek pesan ---------- */
const FX_WORDS = [
  [/selamat|congrat|hbd|happy birthday|ulang tahun|ultah|🎉|🥳/i, 'confetti'],
  [/love u|love you|sayang|❤️|💖|🥰|i love/i, 'hearts'],
  [/happy new year|tahun baru|🎆|🎇/i, 'fireworks'],
  [/❄️|salju|snow/i, 'snow'],
];
function effectOf(m) {
  if (!m || m.unsent || m.type !== 'text') return null;
  if (m.effect) return m.effect;
  for (const [re, fx] of FX_WORDS) if (re.test(m.text || '')) return fx;
  return null;
}
export function playEffect(fx, host = document.body) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  host.querySelector('.fx-layer')?.remove();
  const layer = document.createElement('div');
  layer.className = 'fx-layer fx-' + fx;
  const pool = { confetti: ['', '', '', ''], hearts: ['💖', '💜', '💗', '❤️', '💕'], fireworks: [''], snow: ['❄️'], balloons: ['🎈', '🎈', '🎈', '🎉'] }[fx] || ['✨'];
  const n = fx === 'confetti' ? 70 : fx === 'fireworks' ? 72 : 26;
  const cols = ['#7C5CFF', '#FF3D6E', '#FFC53D', '#2EE6A6', '#2E7BFF', '#FF7A1A'];
  let html = '';
  for (let i = 0; i < n; i++) {
    const x = Math.random() * 100, d = (Math.random() * .8).toFixed(2), t = (1.8 + Math.random() * 1.6).toFixed(2), r = Math.round(Math.random() * 720 - 360), s = (0.7 + Math.random() * .8).toFixed(2);
    const ch = pool[i % pool.length];
    if (fx === 'fireworks') {
      const b = i % 3, cx = [25, 70, 45][b], cy = [30, 22, 48][b], ang = (i / n) * Math.PI * 2 * 3 + b, dist = 90 + Math.random() * 80;
      html += `<i class="fw" style="--x:${cx}%;--y:${cy}%;--d:${(b * .45).toFixed(2)}s;--tx:${Math.round(Math.cos(ang) * dist)}px;--ty:${Math.round(Math.sin(ang) * dist)}px;--c:${cols[(b * 2 + i) % cols.length]}"></i>`;
      continue;
    }
    html += ch
      ? `<i style="--x:${x}%;--d:${d}s;--t:${t}s;--r:${r}deg;--dx:${Math.round(r / 8)}px;--s:${s}">${ch}</i>`
      : `<i class="cf" style="--x:${x}%;--d:${d}s;--t:${t}s;--r:${r}deg;--s:${s};--c:${cols[i % cols.length]}"></i>`;
  }
  layer.innerHTML = html;
  host.appendChild(layer);
  setTimeout(() => layer.remove(), 4200);
}

const ttlShort = s => s >= 86400 ? Math.round(s / 86400) + 'h' : s >= 3600 ? Math.round(s / 3600) + 'j' : s >= 60 ? Math.round(s / 60) + 'm' : s + 'd';

/* ---------- Onix Pay ---------- */
function payHtml(m, group) {
  const mine = m.from === ME;
  const title = m.kind === 'send' ? (mine ? 'Kamu kirim' : 'Kamu terima') : m.kind === 'split' ? 'Patungan' : (mine ? 'Kamu minta' : 'Minta bayar');
  let foot = '';
  if (m.kind === 'send') foot = `<span class="py-st ok">${icon('check', 'tiny')} Berhasil</span>`;
  else if (m.kind === 'request') {
    const done = m.paid?.length > 0;
    foot = done ? `<span class="py-st ok">${icon('check', 'tiny')} Lunas</span>`
      : mine ? `<span class="py-st wait">${icon('clock', 'tiny')} Menunggu</span>`
      : `<button class="py-btn" data-act="pay-now" data-mid="${m.id}">Bayar ${rupiah(m.per)}</button>`;
  } else {
    const n = m.members.length, k = m.paid.length;
    const canPay = !mine && m.members.includes(ME) && !m.paid.includes(ME);
    foot = `${canPay ? `<button class="py-btn" data-act="pay-now" data-mid="${m.id}">Bayar ${rupiah(m.per)}</button>` : ''}<div class="py-split"><div class="py-bar"><i style="width:${n ? k / n * 100 : 0}%"></i></div><span>${k}/${n} bayar · ${rupiah(m.per)}/org</span>
      <div class="py-avs">${m.members.map(id => `<span class="${m.paid.includes(id) ? 'on' : ''}">${avatar(api.user(id), 22)}</span>`).join('')}</div></div>`;
  }
  return `<div class="paycard ${m.kind}"><div class="py-top">${icon('wallet')}<small>${title}</small></div><b class="py-amt">${rupiah(m.amount)}</b>${m.note ? `<div class="py-note">${esc(m.note)}</div>` : ''}${foot}</div>`;
}

/* ---------- mini game ---------- */
const SUIT = [['rock', '✊'], ['paper', '✋'], ['scissors', '✌️']];
const suitEmo = k => (SUIT.find(x => x[0] === k) || [0, '❔'])[1];
const PIPS = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
function gameHtml(m) {
  if (m.game === 'dice') {
    return `<div class="game dice-wrap"><div class="dice">${Array.from({ length: 9 }, (_, i) => `<i class="${PIPS[m.result]?.includes(i + 1) ? 'on' : ''}"></i>`).join('')}</div><b class="g-res">${m.result}</b></div>`;
  }
  if (m.game === 'coin') {
    return `<div class="game coin-wrap"><div class="coin ${m.result === 'A' ? 'a' : 'g'}"><span>${m.result === 'A' ? '1' : '★'}</span></div><b class="g-res">${m.result === 'A' ? 'Angka' : 'Gambar'}</b></div>`;
  }
  const me = m.picks?.[ME], oppId = m.opp || Object.keys(m.picks || {}).find(k => k !== m.from);
  const mineMsg = m.from === ME;
  const a = m.picks?.[m.from], b = oppId ? m.picks[oppId] : null;
  if (!b) {
    if (!mineMsg) return `<div class="game suit-wrap wait pick"><span class="sw-q">❔</span><span class="sw-vs">vs</span><span class="sw-q">❔</span><div class="sw-pick">${SUIT.map(([k, e]) => `<button data-act="suit-pick" data-mid="${m.id}" data-v="${k}">${e}</button>`).join('')}</div></div>`;
    return `<div class="game suit-wrap wait"><span class="sw-me">${suitEmo(a)}</span><span class="sw-vs">vs</span><span class="sw-q">❔</span></div>`;
  }
  const r = suitResult(mineMsg ? a : b, mineMsg ? b : a);
  const label = r === 1 ? 'Menang! 🎉' : r === -1 ? 'Kalah 😭' : 'Seri 🤝';
  return `<div class="game suit-wrap done ${r === 1 ? 'win' : r === -1 ? 'lose' : 'draw'}"><span class="sw-me">${suitEmo(a)}</span><span class="sw-vs">vs</span><span class="sw-opp">${suitEmo(b)}</span><b class="g-res">${label}</b></div>`;
}

const mapText = (html, fn) => html.split(/(<[^>]+>)/).map(p => (p.startsWith('<') ? p : fn(p))).join('');

export function openChat(chatId, opts = {}) {
  // kalau chat yang sama sudah terbuka di atas, jangan dobel
  const top = router.top();
  if (top?.chatId === chatId) { if (opts.mid) top.goto?.(opts.mid); return; }
  const scr = ChatScreen(chatId);
  router.push(scr);
  if (opts.mid) setTimeout(() => scr.goto(opts.mid), 380);
}

const REACTS = ['❤️', '😂', '😮', '😢', '😡', '👍'];

// isi & cover paket sticker -> [[emoji, anim?], ...]
function packItems(id) {
  if (id === 'anim') return ANIM_STICKERS;
  if (STICKERS[id]) return STICKERS[id].map(s => [s]);
  const p = STORE_PACKS.find(x => x.id === id);
  return p ? p.stickers.map(s => (Array.isArray(s) ? s : [s])) : [];
}
function packCover(id) {
  const t = STICKER_TABS.find(x => x[0] === id);
  return t ? t[1] : STORE_PACKS.find(x => x.id === id)?.cover || '❓';
}

function waveBars(id, n = 26) {
  let x = hash(id);
  let out = '';
  for (let i = 0; i < n; i++) {
    x = (x * 1103515245 + 12345) >>> 0;
    const v = 25 + (x % 75);
    out += `<i style="height:${v}%"></i>`;
  }
  return out;
}

function ChatScreen(chatId) {
  const el = h(`<div class="chat-screen">
    <header class="navbar chat-nav">
      <button class="icon-btn back-btn" data-act="back" aria-label="Kembali">${icon('back')}<b class="back-count"></b></button>
      <button class="chat-title" data-act="info"></button>
      <div class="nav-right">
        <button class="icon-btn" data-act="call" aria-label="Telepon">${icon('phone')}</button>
        <button class="icon-btn" data-act="menu" aria-label="Menu">${icon('more')}</button>
      </div>
    </header>
    <div class="search-bar" hidden>
      <div class="search">${icon('search')}<input placeholder="Cari" enterkeyhint="search"></div>
      <span class="sr-count"></span>
      <button class="icon-btn sm" data-act="sr-up">${icon('chevronUp')}</button>
      <button class="icon-btn sm" data-act="sr-down">${icon('chevronDown')}</button>
      <button class="text-btn" data-act="sr-close">Batal</button>
    </div>
    <div class="announce" hidden></div>
    <div class="msgs"><div class="msgs-inner"></div><div class="typing-row" hidden></div></div>
    <button class="jump" hidden>${icon('chevronDown')}<b></b></button>
    <div class="composer-wrap">
      <div class="mention-list" hidden></div>
      <button class="sched-bar" data-act="sched-list" hidden></button>
      <div class="reply-bar" hidden></div>
      <div class="rec-bar" hidden></div>
      <div class="composer">
        <button class="icon-btn" data-act="plus" aria-label="Lampiran">${icon('plus')}</button>
        <div class="input-wrap">
          <textarea rows="1" placeholder="Pesan" enterkeyhint="send" maxlength="2000"></textarea>
          <button class="icon-btn in" data-act="stickers" aria-label="Sticker">${icon('smile')}</button>
        </div>
        <button class="send-btn" data-act="send" aria-label="Kirim">${icon('mic')}</button>
      </div>
      <div class="panel" hidden></div>
    </div>
  </div>`);

  const sc = $('.msgs', el), inner = $('.msgs-inner', el), ta = $('textarea', el);
  const sendBtn = $('.send-btn', el), panel = $('.panel', el), jump = $('.jump', el);
  onLongPress(panel, '.my-st', async n => { if (await confirmBox({ title: 'Hapus sticker ini?', ok: 'Hapus', danger: true })) api.removeMySticker(n.dataset.id); });
  const replyBar = $('.reply-bar', el), recBar = $('.rec-bar', el), typingRow = $('.typing-row', el);
  let nodes = new Map(), lastId = null, firstRender = true, stick = true, newCount = 0;
  const animated = new Set();
  function gameSheet() {
    sheet({
      top: `<div class="game-pick">
        <button data-g="dice"><span class="gp-ic">🎲</span><small>Dadu</small></button>
        <button data-g="coin"><span class="gp-ic">🪙</span><small>Koin</small></button>
      </div>
      <div class="game-suit">${SUIT.map(([k, e]) => `<button data-s="${k}">${e}</button>`).join('')}</div>`,
      onMount: (s, close) => {
        s.querySelectorAll('[data-g]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); close(); api.playGame(chatId, b.dataset.g); vibrate(10); }));
        s.querySelectorAll('[data-s]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); close(); api.playGame(chatId, 'suit', b.dataset.s); vibrate(10); }));
      },
    });
  }
  const PAGE = 50;
  let limit = PAGE, loadingOlder = false;
  function ensureLoaded(mid) {
    const all = api.messages(chatId), i = all.findIndex(m => m.id === mid);
    if (i >= 0 && i < all.length - limit) { limit = all.length - i + 10; renderMsgs(); }
  }
  function loadOlder() {
    const all = api.messages(chatId);
    if (loadingOlder) return;
    if (limit >= all.length) {
      const ch = c();
      if (!ch?.remote || !ch.hasMore || !api.remote.hooks.older) return;
      loadingOlder = true;
      api.remote.hooks.older(chatId).finally(() => { loadingOlder = false; if (api.messages(chatId).length > all.length) loadOlder(); });
      return;
    }
    loadingOlder = true; stick = false;
    const h0 = sc.scrollHeight, t0 = sc.scrollTop;
    limit += PAGE;
    renderMsgs();
    sc.scrollTop = t0 + (sc.scrollHeight - h0);
    requestAnimationFrame(() => { loadingOlder = false; });
  }
  let replyTo = null, panelMode = null, stickerTab = 'anim', editing = null;
  let searchQ = '', hits = [], hitIdx = -1;
  const searchBar = $('.search-bar', el), searchInp = $('.search-bar input', el), announce = $('.announce', el), mentionList = $('.mention-list', el);
  const c = () => api.chat(chatId);

  /* ---------- header ---------- */
  function renderHeader() {
    const ch = c();
    const t = api.typingIn(chatId);
    let sub;
    if (t.length) sub = `<span class="accent-txt">${ch.type === 'group' ? esc(firstName(api.user(t[0])?.name)) + ' ' : ''}lagi ngetik…</span>`;
    else if (ch.type === 'group') sub = `${ch.members.length} anggota`;
    else sub = esc(presence(api.peerOf(ch)));
    const peer = api.peerOf(ch);
    $('.chat-title', el).innerHTML = `${chatAvatar(ch, 36)}<span class="ct-txt"><b>${esc(api.chatTitle(ch))}${peer?.official ? verified() : ''}${ch.muted ? icon('bellOff', 'tiny muted-ic') : ''}${ch.ttl ? `<span class="ttl-pill">${icon('clock')}${esc(ttlShort(ch.ttl))}</span>` : ''}</b><small>${sub}</small></span>`;
    const n = api.totalUnread(chatId);
    $('.back-count', el).textContent = n ? (n > 99 ? '99+' : n) : '';
    el.dataset.wall = ch.wallpaper || 'default';
    const an = ch.announcement;
    announce.hidden = !an;
    if (an) {
      announce.innerHTML = `<button class="an-main" data-act="ann-go">${icon('megaphone')}<b>${esc(an.text)}</b></button><button class="icon-btn sm" data-act="ann-close">${icon('x')}</button>`;
    }
  }

  function fmtText(text) {
    const ch = c();
    let html = esc(text);
    html = fmtMarks(html);
    html = mapText(html, t => t.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>'));
    if (ch.type === 'group' && text.includes('@')) {
      const names = ch.members.map(id => ({ id, n: firstName(api.user(id)?.name || '') })).filter(x => x.n);
      html = mapText(html, t => t.replace(/@([\p{L}\d_]+)/gu, (all, nm) => {
        const hit = names.find(x => x.n.toLowerCase() === nm.toLowerCase());
        return hit ? `<span class="mention ${hit.id === ME ? 'me' : ''}">@${nm}</span>` : all;
      }));
    }
    if (searchQ) {
      const re = new RegExp(reEsc(esc(searchQ)), 'gi');
      html = mapText(html, t => t.replace(re, '<mark>$&</mark>'));
    }
    return html.replace(/\n/g, '<br>');
  }

  function pollHtml(m) {
    const p = m.poll, total = new Set(p.options.flatMap(o => o.votes)).size;
    const max = Math.max(1, ...p.options.map(o => o.votes.length));
    return `<div class="bubble poll">
      <div class="poll-h">${icon('poll', 'tiny')} Polling</div>
      <b class="poll-q">${esc(p.q)}</b>
      ${p.options.map(o => { const on = o.votes.includes(ME); const pct = total ? Math.round(o.votes.length / total * 100) : 0; return `<button class="poll-o ${on ? 'on' : ''} ${o.votes.length === max && total ? 'lead' : ''}" data-act="vote" data-mid="${m.id}" data-o="${o.id}"><span class="po-bar" style="width:${pct}%"></span><span class="po-check">${icon('check')}</span><span class="po-t">${esc(o.text)}</span><span class="po-n">${o.votes.length}</span></button>`; }).join('')}
      <small class="poll-total">${total} vote</small>
    </div>`;
  }

  /* ---------- messages ---------- */
  function brk(a, b) {
    return !a || !b || a.from !== b.from || a.type === 'system' || b.type === 'system' || Math.abs(b.ts - a.ts) > 5 * 60e3 || !isSameDay(a.ts, b.ts);
  }

  function msgHtml(m, prev, next, group) {
    if (m.type === 'system') return `<div class="sys"><span>${esc(m.text)}</span></div>`;
    const mine = m.from === ME;
    const u = api.user(m.from) || { name: '?' };
    const first = brk(prev, m), last = brk(m, next);
    let body, bare = false;
    const quote = m.replyTo ? `<button class="quote" data-act="goto" data-mid="${m.replyTo.id}"><b>${esc(m.replyTo.name)}</b><span>${esc(m.replyTo.text)}</span></button>` : '';
    if (m.unsent) {
      body = `<div class="bubble unsent">${icon('undo', 'tiny')} Pesan ditarik</div>`;
    } else if (m.type === 'sticker') {
      bare = true; body = m.img ? `<div class="sticker"><img class="sticker-img" src="${m.img}" alt="sticker"></div>` : `<div class="sticker">${m.anim ? `<span class="anim-${m.anim}">${m.sticker}</span>` : m.sticker}</div>`;
    } else if (m.type === 'video') {
      bare = true; body = `<button class="photo vid" data-act="open-video" data-mid="${m.id}">${m.thumb ? `<img src="${m.thumb}" style="aspect-ratio:${m.w || 16}/${m.h || 9}" alt="video">` : `<span class="vid-ph" style="aspect-ratio:${m.w || 16}/${m.h || 9}"></span>`}<span class="vid-play">${icon('play')}</span><span class="vid-dur">${dur(m.duration || 0)}</span></button>`;
    } else if (m.type === 'file') {
      body = `<button class="bubble filemsg" data-act="open-file" data-mid="${m.id}"><span class="file-ic">${esc(fileExt(m.name || 'FILE')) || icon('file')}</span><span class="file-txt"><b>${esc(m.name)}</b><small>${fmtSize(m.size || 0)}</small></span>${icon('download', 'file-dl')}</button>`;
    } else if (m.cleared && ['image', 'video', 'file', 'voice'].includes(m.type)) {
      body = `<div class="bubble cleared">${icon(m.type === 'image' ? 'image' : m.type === 'video' ? 'film' : m.type === 'voice' ? 'mic' : 'file', 'tiny')} ${m.type === 'image' ? 'Foto' : m.type === 'video' ? 'Video' : m.type === 'voice' ? 'Voice note' : esc(m.name || 'File')} dihapus</div>`;
    } else if (m.type === 'image' && m.album?.length > 1) {
      bare = true;
      const a = m.album, n = a.length, show = a.slice(0, 4);
      body = `<div class="photo-grid g${Math.min(n, 4)}">${show.map((x, i) => `<button data-act="view-img" data-mid="${m.id}" data-i="${i}"><img src="${x.src}" alt="foto" loading="lazy">${i === 3 && n > 4 ? `<b>+${n - 4}</b>` : ''}</button>`).join('')}</div>`;
    } else if (m.type === 'image') {
      bare = true; body = `<button class="photo" data-act="view-img" data-mid="${m.id}"><img src="${m.src}" style="aspect-ratio:${m.w || 1}/${m.h || 1}" alt="foto"></button>`;
    } else if (m.type === 'voice') {
      body = `<div class="bubble voice" data-act="play" data-mid="${m.id}"><span class="vplay">${icon('play')}</span><span class="wave">${waveBars(m.id)}</span><span class="vdur">${dur(m.duration || 0)}</span></div>`;
    } else if (m.type === 'location') {
      body = `<div class="bubble loc" data-act="loc" data-mid="${m.id}"><div class="map"><span class="map-pin">${icon('location')}</span></div><div class="loc-txt"><b>${esc(m.title)}</b><small>${esc(m.address)}</small></div></div>`;
    } else if (m.type === 'pay') {
      bare = true; body = payHtml(m, group);
    } else if (m.type === 'game') {
      bare = true; body = gameHtml(m);
    } else if (m.type === 'post') {
      const p = api.post(m.postId), pu = p && api.user(p.userId);
      const img = p && (p.images?.[0] || p.image);
      body = p
        ? `<button class="bubble postmsg" data-act="open-post" data-pid="${p.id}">${img ? `<img src="${img}" alt="">` : ''}<span class="pm-txt"><span class="pm-who">${avatar(pu, 20)}<b>${esc(pu?.name || '')}</b></span>${p.text ? `<span class="pm-body">${esc(p.text.slice(0, 120))}</span>` : ''}<small>${icon('voom', 'tiny')} VOOM${p.images?.length > 1 ? ` · ${p.images.length} foto` : ''}</small></span></button>`
        : `<div class="bubble unsent">${icon('voom', 'tiny')} Post udah dihapus</div>`;
    } else if (m.type === 'poll') {
      body = pollHtml(m);
    } else if (m.type === 'event') {
      const e = m.event, d = new Date(e.at);
      const mon = d.toLocaleDateString('id-ID', { month: 'short' });
      const meGo = e.going.includes(ME), meNo = e.notGoing.includes(ME);
      body = `<div class="bubble event">
        <div class="ev-top"><div class="ev-date"><small>${esc(mon)}</small><b>${d.getDate()}</b></div><div class="ev-info"><b>${esc(e.title)}</b><small>${icon('clock', 'tiny')} ${esc(fmtWhen(e.at))}</small>${e.place ? `<small>${icon('location', 'tiny')} ${esc(e.place)}</small>` : ''}</div></div>
        <div class="ev-people">${e.going.slice(0, 5).map(id => avatar(api.user(id), 22)).join('')}<span>${e.going.length} ikut</span></div>
        <div class="ev-btns"><button class="${meGo ? 'on' : ''}" data-act="rsvp" data-mid="${m.id}" data-v="1">${icon('check', 'tiny')} Ikut</button><button class="${meNo ? 'on no' : ''}" data-act="rsvp" data-mid="${m.id}" data-v="0">${icon('x', 'tiny')} Nggak</button></div>
      </div>`;
    } else if (!m.replyTo && !m.forwarded && isJumbo(m.text)) {
      bare = true; body = `<div class="jumbo">${esc(m.text)}</div>`;
    } else {
      body = `<div class="bubble ${effectOf(m) ? 'has-fx' : ''}" ${effectOf(m) ? `data-act="replay-fx" data-mid="${m.id}"` : ''}>${m.forwarded ? `<span class="fwd">${icon('forward', 'tiny')} Diteruskan</span>` : ''}${quote}<span class="txt">${fmtText(m.text)}</span>${linkCard(m.text)}</div>`;
    }
    const reacts = Object.entries(m.reactions || {}).filter(([, a]) => a.length);
    const reactHtml = reacts.length ? `<div class="reacts" data-act="react-info" data-mid="${m.id}">${reacts.map(([e, a]) => `<span class="${a.includes(ME) ? 'mine' : ''}">${e}${a.length > 1 ? `<small>${a.length}</small>` : ''}</span>`).join('')}</div>` : '';
    let read = '';
    if (mine && !m.unsent) {
      const n = (m.readBy || []).length;
      if (m.status === 'sending') read = '<span class="sending"></span>';
      else if (m.status === 'failed') read = `<button class="failed" data-act="retry" data-mid="${m.id}" aria-label="Kirim ulang">!</button>`;
      else if (n) read = group ? `<button class="read" data-act="readers" data-mid="${m.id}">${icon('checks')}${n}</button>` : `<span class="read">${icon('checks')}</span>`;
      else read = `<span class="sent">${icon('check')}</span>`;
    }
    const meta = last || m.edited || m.expires ? `<div class="meta">${m.expires ? `<span class="exp">${icon('clock')}</span>` : ''}${m.edited ? `<span class="edited">${icon('edit')}</span>` : ''}${last ? `<span class="tm">${read}${hm(m.ts)}</span>` : ''}</div>` : '';
    return `<div class="msg-row ${mine ? 'me' : 'them'} ${first ? 'first' : ''} ${last ? 'last' : ''} ${bare ? 'bare' : ''}" data-mid="${m.id}">
      ${!mine ? `<div class="av-col">${first ? `<button data-act="profile" data-id="${m.from}">${avatar(u, 32)}</button>` : ''}</div>` : ''}
      <div class="msg-col">${!mine && first && group ? `<div class="sender">${esc(u.name)}</div>` : ''}
        <div class="bubble-line">${body}${meta}</div>${reactHtml}</div>
    </div>`;
  }

  function renderMsgs() {
    const ch = c();
    if (!ch) return;
    const full = api.messages(chatId);
    const list = full.length > limit ? full.slice(-limit) : full;
    const group = ch.type === 'group';
    const out = [], fresh = new Map();
    if (full.length > list.length || ch.hasMore) out.push(h(`<div class="older"><span></span></div>`));
    const put = (k, html) => {
      let n = nodes.get(k);
      if (!n || n._h !== html) { n = h(html); n._h = html; }
      fresh.set(k, n); out.push(n);
    };
    let prev = null;
    list.forEach((m, i) => {
      if (!prev || !isSameDay(prev.ts, m.ts)) put('d' + new Date(m.ts).toDateString(), `<div class="day-sep"><span>${dayLabel(m.ts)}</span></div>`);
      put(m.id, msgHtml(m, prev, list[i + 1], group));
      prev = m;
    });
    if (!list.length) put('empty', `<div class="chat-empty">${chatAvatar(ch, 72, { online: false })}<b>${esc(api.chatTitle(ch))}</b><div class="quick-stickers">${['👋', '🫶', '😆', '✨'].map(s => `<button data-act="quick-sticker" data-s="${s}">${s}</button>`).join('')}</div></div>`);
    inner.replaceChildren(...out);
    nodes = fresh;
    list.forEach(m => {
      if (m.type !== 'game' || animated.has(m.id)) return;
      animated.add(m.id);
      if (Date.now() - m.ts > 2500) return;
      const n = fresh.get(m.id)?.querySelector('.game');
      if (n) { n.classList.add('rolling'); setTimeout(() => n.classList.remove('rolling'), m.game === 'coin' ? 1300 : 1100); }
    });

    const lm = list[list.length - 1];
    const newLast = lm && lm.id !== lastId;
    if (newLast && !firstRender) { const fx = effectOf(lm); if (fx) playEffect(fx, el); }
    if (firstRender || stick || (newLast && lm.from === ME)) { scrollBottom(); }
    else if (newLast) { newCount++; showJump(); }
    lastId = lm?.id;
    firstRender = false;
  }

  function renderTyping() {
    const t = api.typingIn(chatId);
    if (!t.length) { typingRow.hidden = true; return; }
    const u = api.user(t[0]);
    typingRow.innerHTML = `<div class="av-col">${avatar(u, 32)}</div><div class="bubble typing"><i></i><i></i><i></i></div>`;
    const wasStick = stick;
    typingRow.hidden = false;
    if (wasStick) scrollBottom();
  }

  function scrollBottom(smooth) {
    requestAnimationFrame(() => {
      sc.scrollTo({ top: sc.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
      stick = true; newCount = 0; jump.hidden = true;
    });
  }
  function showJump() {
    jump.hidden = false;
    $('b', jump).textContent = newCount ? newCount : '';
  }
  sc.addEventListener('scroll', () => {
    stick = sc.scrollHeight - sc.scrollTop - sc.clientHeight < 80;
    if (sc.scrollTop < 120 && !stick) loadOlder();
    if (stick) { jump.hidden = true; newCount = 0; }
    else if (sc.scrollHeight - sc.scrollTop - sc.clientHeight > 400) showJump();
  }, { passive: true });
  inner.addEventListener('load', () => { if (stick) scrollBottom(); }, true);
  jump.addEventListener('click', () => scrollBottom(true));
  sc.addEventListener('touchstart', () => { if (panelMode) closePanel(); }, { passive: true });

  /* ---------- composer ---------- */
  function autosize() {
    ta.style.height = 'auto';
    if (ta.scrollHeight) ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
    const has = ta.value.trim().length > 0;
    sendBtn.innerHTML = icon(has ? 'send' : 'mic');
    sendBtn.classList.toggle('active', has);
  }
  ta.addEventListener('input', () => { autosize(); checkMention(); if (ta.value.trim()) api.typingNow(chatId); });
  // tahan tombol kirim = jadwalkan
  let holdT = null, held = false;
  sendBtn.addEventListener('pointerdown', () => {
    held = false;
    if (!ta.value.trim() || editing) return;
    holdT = setTimeout(() => {
      held = true; vibrate(12);
      const text = ta.value.trim();
      scheduleSheet(at => { api.schedule(chatId, withReply({ type: 'text', text }), at); ta.value = ''; autosize(); },
        fx => { api.send(chatId, withReply({ type: 'text', text, effect: fx })); ta.value = ''; autosize(); vibrate(10); });
    }, 450);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => sendBtn.addEventListener(ev, () => clearTimeout(holdT)));
  sendBtn.addEventListener('click', e => { if (held) { e.stopImmediatePropagation(); held = false; } }, true);
  sendBtn.addEventListener('contextmenu', e => e.preventDefault());
  const schedBar = $('.sched-bar', el);
  function renderSched() {
    const list = api.scheduledIn(chatId);
    schedBar.hidden = !list.length;
    if (list.length) schedBar.innerHTML = `${icon('clock', 'tiny')} ${list.length} terjadwal · ${esc(fmtWhen(list[0].at))}`;
  }
  let mentionQ = null;
  function checkMention() {
    const ch = c();
    if (ch.type !== 'group') return;
    const before = ta.value.slice(0, ta.selectionStart ?? ta.value.length);
    const mm = before.match(/(^|\s)@([\p{L}\d_]*)$/u);
    if (!mm) return hideMentions();
    mentionQ = mm[2];
    const list = ch.members.filter(id => id !== ME).map(id => api.user(id)).filter(u => u && firstName(u.name).toLowerCase().startsWith(mentionQ.toLowerCase()));
    if (!list.length) return hideMentions();
    mentionList.innerHTML = list.slice(0, 6).map(u => `<button data-act="mention" data-n="${esc(firstName(u.name))}">${avatar(u, 28)}<b>${esc(u.name)}</b><small>@${esc(firstName(u.name))}</small></button>`).join('');
    mentionList.hidden = false;
  }
  function hideMentions() { mentionList.hidden = true; mentionQ = null; }
  ta.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendText(); }
  });
  ta.addEventListener('focus', () => { if (panelMode) closePanel(); setTimeout(() => stick && scrollBottom(), 300); });

  function withReply(payload) {
    if (replyTo) { payload.replyTo = replyTo; setReply(null); }
    return payload;
  }
  function sendText() {
    const text = ta.value.trim();
    if (!text) return;
    hideMentions();
    if (editing) {
      if (text !== editing.text) { api.editMessage(chatId, editing.id, text); toast('Pesan diedit ✏️'); }
      setReply(null);
      ta.value = ''; autosize();
      return;
    }
    api.send(chatId, withReply({ type: 'text', text }));
    ta.value = '';
    autosize();
    ta.focus();
    vibrate(6);
  }
  function sendSticker(s, anim) {
    api.send(chatId, withReply({ type: 'sticker', sticker: s, ...(anim ? { anim } : {}) }));
    vibrate(6);
  }

  function setEdit(m) {
    replyTo = null;
    editing = { id: m.id, text: m.text };
    replyBar.innerHTML = `<div class="rb-line"></div><div class="rb-txt"><b>${icon('edit', 'tiny')} Edit</b><span>${esc(m.text)}</span></div><button class="icon-btn sm" data-act="cancel-reply">${icon('x')}</button>`;
    replyBar.hidden = false;
    ta.value = m.text; autosize();
    ta.focus();
  }
  function setReply(m) {
    if (!m) {
      if (editing) { editing = null; ta.value = ''; autosize(); }
      replyTo = null; replyBar.hidden = true; return;
    }
    editing = null;
    const u = api.user(m.from);
    const text = m.type === 'text' ? m.text : m.type === 'poll' ? '📊 ' + m.poll.q : { sticker: 'Sticker ' + m.sticker, image: '📷 Foto', voice: '🎤 Voice note', location: '📍 Lokasi', video: '🎬 Video', file: '📎 ' + m.name }[m.type];
    replyTo = { id: m.id, name: m.from === ME ? 'Kamu' : u?.name, text: (text || '').slice(0, 120) };
    replyBar.innerHTML = `<div class="rb-line"></div><div class="rb-txt"><b>${esc(replyTo.name)}</b><span>${esc(replyTo.text)}</span></div><button class="icon-btn sm" data-act="cancel-reply">${icon('x')}</button>`;
    replyBar.hidden = false;
    ta.focus();
  }

  /* ---------- panels ---------- */
  function openPanel(mode) {
    if (panelMode === mode) return closePanel();
    panelMode = mode;
    ta.blur();
    panel.hidden = false;
    renderPanel();
    el.classList.add('panel-open');
    scrollBottom();
  }
  function closePanel() {
    panelMode = null; panel.hidden = true; el.classList.remove('panel-open');
  }
  function renderPanel() {
    if (panelMode === 'plus') {
      const items = [['photo', 'image', 'Foto', '#7C5CFF'], ['camera', 'camera', 'Kamera', '#FF3D81'], ['video', 'film', 'Video', '#14B8C4'], ['file', 'file', 'File', '#5B6CFF'], ['location', 'location', 'Lokasi', '#10B26C'], ['voice', 'mic', 'Voice', '#FF7A1A'], ['poll', 'poll', 'Polling', '#E1A100'], ['event', 'calendar', 'Event', '#2E7BFF'], ['game', 'dice', 'Game', '#FF3D6E'], ['pay', 'wallet', 'Pay', '#0FB46C']];
      panel.innerHTML = `<div class="attach-grid">${items.map(([a, ic, label, col]) => `<button data-act="att-${a}"><span style="--c:${col}">${icon(ic)}</span><small>${label}</small></button>`).join('')}</div>`;
    } else if (panelMode === 'stickers') {
      const owned = api.packs();
      if (stickerTab !== 'emoji' && stickerTab !== 'mine' && !owned.includes(stickerTab)) stickerTab = owned[0] || 'emoji';
      const isEmoji = stickerTab === 'emoji', isMine = stickerTab === 'mine';
      const items = isEmoji || isMine ? [] : packItems(stickerTab);
      const mineGrid = `<div class="sticker-grid mine"><button class="ms-new" data-act="make-sticker" aria-label="Bikin sticker">${icon('plus')}</button>${api.myStickers().map(s => `<button class="my-st" data-act="my-sticker" data-id="${s.id}"><img src="${s.src}" alt=""></button>`).join('')}</div>`;
      const grid = isMine ? mineGrid : isEmoji
        ? `<div class="emoji-grid">${EMOJIS.map(e => `<button data-act="emoji" data-e="${e}">${e}</button>`).join('')}</div>`
        : `<div class="sticker-grid">${items.map(([s, a]) => a ? `<button data-act="sticker" data-s="${s}" data-a="${a}"><span class="anim-${a}">${s}</span></button>` : `<button data-act="sticker" data-s="${s}">${s}</button>`).join('')}</div>`;
      const myCover = api.myStickers()[0];
      const tabs = `<button class="${isMine ? 'on' : ''}" data-act="stab" data-k="mine">${myCover ? `<img class="st-cov" src="${myCover.src}" alt="">` : '✂️'}</button>` + owned.map(k => `<button class="${k === stickerTab ? 'on' : ''}" data-act="stab" data-k="${k}">${packCover(k)}</button>`).join('');
      panel.innerHTML = `<div class="sticker-wrap">${grid}</div><div class="sticker-tabs"><div class="st-scroll">${tabs}<button class="${isEmoji ? 'on' : ''}" data-act="stab" data-k="emoji">😀</button></div><button class="st-store" data-act="store" aria-label="Toko sticker">${icon('store')}</button></div>`;
    }
  }

  /* ---------- voice note ---------- */
  let rec = null;
  async function startRec() {
    closePanel();
    rec = { t0: Date.now(), chunks: [], media: null, stream: null, timer: null };
    recBar.hidden = false;
    el.classList.add('recording');
    recBar.innerHTML = `<button class="icon-btn rec-cancel" data-act="rec-cancel">${icon('trash')}</button><div class="rec-mid"><i class="rec-dot"></i><span class="rec-time">00:00</span><span class="rec-hint"></span></div><button class="send-btn active" data-act="rec-send">${icon('send')}</button>`;
    rec.timer = setInterval(() => {
      const s = (Date.now() - rec.t0) / 1000;
      $('.rec-time', recBar).textContent = dur(s);
      if (s >= 60) stopRec(true);
    }, 250);
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error('unsupported');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!rec) { stream.getTracks().forEach(t => t.stop()); return; }
      rec.stream = stream;
      rec.media = new MediaRecorder(stream);
      rec.media.ondataavailable = e => e.data.size && rec?.chunks.push(e.data);
      rec.media.start();
    } catch {
      if (rec) $('.rec-hint', recBar).textContent = 'demo';
    }
  }
  function stopRec(send) {
    if (!rec) return;
    const r = rec; rec = null;
    clearInterval(r.timer);
    recBar.hidden = true;
    el.classList.remove('recording');
    const duration = Math.max(1, Math.round((Date.now() - r.t0) / 1000));
    const finish = (src) => {
      r.stream?.getTracks().forEach(t => t.stop());
      if (send) api.send(chatId, withReply({ type: 'voice', duration, src }));
    };
    if (r.media && r.media.state !== 'inactive') {
      r.media.onstop = () => {
        if (!send) return finish(null);
        const blob = new Blob(r.chunks, { type: r.media.mimeType || 'audio/mp4' });
        if (blob.size > 1.5e6) return finish(null);
        const fr = new FileReader();
        fr.onload = () => finish(fr.result);
        fr.readAsDataURL(blob);
      };
      r.media.stop();
    } else finish(null);
  }

  let playing = null;
  function playVoice(mid) {
    const m = api.messages(chatId).find(x => x.id === mid);
    if (!m) return;
    if (playing) {
      const same = playing.mid === mid;
      stopPlay();
      if (same) return;
    }
    const p = { mid, t0: Date.now(), audio: null, raf: 0 };
    playing = p;
    const total = (m.duration || 1) * 1000;
    if (m.src) {
      p.audio = new Audio(m.src);
      p.audio.play().catch(() => {});
      p.audio.onended = stopPlay;
    }
    const tick = () => {
      if (playing !== p) return;
      const node = inner.querySelector(`.voice[data-mid="${mid}"]`);
      const prog = p.audio && p.audio.duration && isFinite(p.audio.duration) ? p.audio.currentTime / p.audio.duration : (Date.now() - p.t0) / total;
      if (node) {
        node.classList.add('playing');
        const bars = node.querySelectorAll('.wave i'), k = Math.floor(Math.min(1, prog) * bars.length);
        bars.forEach((b, i) => b.classList.toggle('on', i < k));
        $('.vplay', node).innerHTML = icon('pause');
      }
      if (!p.audio && prog >= 1) return stopPlay();
      p.raf = requestAnimationFrame(tick);
    };
    tick();
  }
  function stopPlay() {
    if (!playing) return;
    const p = playing; playing = null;
    cancelAnimationFrame(p.raf);
    p.audio?.pause();
    const node = inner.querySelector(`.voice[data-mid="${p.mid}"]`);
    if (node) { node.classList.remove('playing'); node.querySelectorAll('.wave i.on').forEach(b => b.classList.remove('on')); $('.vplay', node).innerHTML = icon('play'); }
  }

  /* ---------- actions ---------- */
  async function sendImage(capture) {
    closePanel();
    const fs = capture ? [await pickFile('image/*', 'environment')].filter(Boolean) : await pickFiles('image/*', 10);
    if (!fs.length) return;
    try {
      const max = fs.length > 1 ? 900 : 1080;
      const imgs = [];
      for (const f of fs) imgs.push(await compressImage(f, max, .74));
      if (imgs.length === 1) api.send(chatId, withReply({ type: 'image', ...imgs[0] }));
      else api.send(chatId, withReply({ type: 'image', ...imgs[0], album: imgs }));
    } catch { toast('Gagal memuat foto 😢'); }
  }

  const MAX = 50 * 1048576;
  async function sendVideo() {
    closePanel();
    const f = await pickFile('video/*');
    if (!f) return;
    if (f.size > MAX) return toast('Maks 50 MB');
    toast('Memproses video…');
    try {
      const [info, mediaId] = await Promise.all([videoInfo(f), putMedia(f)]);
      api.send(chatId, withReply({ type: 'video', mediaId, mime: f.type, size: f.size, ...info }));
    } catch { toast('Video gagal dikirim'); }
  }
  async function sendFile() {
    closePanel();
    const f = await pickFile('');
    if (!f) return;
    if (f.size > MAX) return toast('Maks 50 MB');
    try {
      const mediaId = await putMedia(f);
      api.send(chatId, withReply({ type: 'file', mediaId, name: f.name, size: f.size, mime: f.type }));
    } catch { toast('File gagal dikirim'); }
  }
  async function openMediaMsg(m) {
    const url = m.fileUrl || (m.mediaId && await mediaURL(m.mediaId));
    if (!url) return toast(m.type === 'video' ? 'Video demo, belum ada file' : 'File nggak tersedia');
    if (m.type === 'video') return openVideo(url);
    const a = document.createElement('a');
    a.href = url; a.download = m.name || 'file'; a.target = '_blank';
    document.body.appendChild(a); a.click(); a.remove();
  }

  function msgById(mid) { return api.messages(chatId).find(x => x.id === mid); }

  async function msgMenu(row) {
    const m = msgById(row.dataset.mid);
    if (!m || m.type === 'system') return;
    ta.blur();
    const mine = m.from === ME;
    const acts = [];
    if (!m.unsent) {
      acts.push({ label: 'Balas', icon: 'reply', run: () => setReply(m) });
      if (m.type === 'text') acts.push({ label: 'Salin', icon: 'copy', run: async () => { await copyText(m.text); toast('Disalin'); } });
      if (mine && m.type === 'text' && Date.now() - m.ts < 15 * 60e3) acts.push({ label: 'Edit', icon: 'edit', run: () => setEdit(m) });
      if (m.type !== 'poll') acts.push({ label: 'Teruskan', icon: 'forward', run: () => forwardMessage(m) });
      acts.push({ label: 'Keep', icon: 'bookmark', run: () => keepFromMessage(m, c()) });
      acts.push({ label: c().announcement?.mid === m.id ? 'Lepas pengumuman' : 'Pin pengumuman', icon: 'megaphone', run: () => api.setAnnouncement(chatId, c().announcement?.mid === m.id ? null : m) });
      if (mine && c().type === 'group') acts.push({ label: 'Dibaca oleh', icon: 'eye', run: () => showReaders(m) });
      if (m.type === 'video' || m.type === 'file') acts.push({ label: 'Simpan', icon: 'download', run: () => openMediaMsg(m) });
      if (m.type === 'image') acts.push({ label: 'Simpan foto', icon: 'download', run: () => { const a = document.createElement('a'); a.href = m.src; a.download = 'onix-foto.jpg'; a.click(); } });
      if (mine && Date.now() - m.ts < 24 * 3600e3) acts.push({ label: 'Tarik', icon: 'undo', run: () => api.unsend(chatId, m.id) });
    }
    acts.push({ label: 'Hapus', icon: 'trash', danger: true, run: async () => { if (await confirmBox({ title: 'Hapus pesan?', ok: 'Hapus', danger: true })) api.deleteMessage(chatId, m.id); } });
    const top = m.unsent ? '' : `<div class="react-strip">${REACTS.map(e => `<button data-r="${e}" class="${(m.reactions?.[e] || []).includes(ME) ? 'on' : ''}">${e}</button>`).join('')}</div>`;
    sheet({
      top, actions: acts,
      onMount: (s, close) => s.querySelectorAll('[data-r]').forEach(b => b.addEventListener('click', () => { api.react(chatId, m.id, b.dataset.r); vibrate(10); close(); })),
    });
  }

  function ttlSheet() {
    const cur = c().ttl || 0;
    sheet({
      top: `<div class="ttl-pick"><div class="ttl-ic">${icon('clock')}</div><div class="ttl-opts">${TTL_OPTS.map(([s, l]) => `<button class="${s === cur ? 'on' : ''}" data-s="${s}">${l}</button>`).join('')}</div></div>`,
      onMount: (s, close) => s.querySelectorAll('[data-s]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); api.setTTL(chatId, +b.dataset.s); renderHeader(); close(); vibrate(6); })),
    });
  }

  function chatMenu() {
    const ch = c();
    const acts = [];
    if (ch.type === 'group') acts.push({ label: 'Info grup', icon: 'users', run: () => router.push(GroupInfoScreen(chatId)) });
    else acts.push({ label: 'Lihat profil', icon: 'user', run: () => router.push(ProfileScreen(api.peerOf(ch).id)) });
    acts.push({ label: 'Video call', icon: 'video', run: () => startCall(chatId, true) });
    acts.push({ label: 'Cari', icon: 'search', run: openSearch });
    if (ch.type === 'group') acts.push({ label: 'Catatan', icon: 'note', run: () => router.push(NotesScreen(chatId)) });
    acts.push({ label: 'Album', icon: 'grid', run: () => router.push(AlbumScreen(chatId)) });
    acts.push({ label: 'Wallpaper', icon: 'palette', run: () => wallpaperSheet(chatId) });
    acts.push({ label: ch.ttl ? `Pesan sementara · ${ttlLabel(ch.ttl)}` : 'Pesan sementara', icon: 'clock', run: ttlSheet });
    acts.push({ label: ch.muted ? 'Bunyikan' : 'Bisukan', icon: ch.muted ? 'bell' : 'bellOff', run: () => { api.toggleMute(chatId); renderHeader(); } });
    acts.push({ label: ch.pinned ? 'Lepas pin' : 'Pin', icon: 'pin', run: () => api.togglePin(chatId) });
    acts.push({ label: ch.archived ? 'Batal arsip' : 'Arsipkan', icon: 'archive', run: () => api.toggleArchive(chatId) });
    acts.push({ label: 'Hapus riwayat', icon: 'trash', danger: true, run: async () => { if (await confirmBox({ title: 'Hapus semua pesan?', ok: 'Hapus', danger: true })) api.clearChat(chatId); } });
    sheet({ actions: acts });
  }

  function bindGoto(mid) {
    ensureLoaded(mid);
    const n = inner.querySelector(`.msg-row[data-mid="${mid}"]`);
    if (!n) return;
    n.scrollIntoView({ behavior: 'smooth', block: 'center' });
    n.classList.add('flash'); setTimeout(() => n.classList.remove('flash'), 1200);
  }

  function showReaders(m) {
    const ch = c();
    const read = m.readBy || [];
    const unread = ch.members.filter(id => id !== ME && !read.includes(id));
    const row = id => `<div class="list-item">${avatar(api.user(id), 36)}<div class="li-main"><div class="li-name">${esc(api.user(id)?.name)}</div></div></div>`;
    sheet({ top: `<div class="sheet-list"><div class="section-h">${icon('checks', 'tiny')} ${read.length}</div>${read.map(row).join('')}${unread.length ? `<div class="section-h">${icon('check', 'tiny')} ${unread.length}</div>${unread.map(row).join('')}` : ''}</div>` });
  }

  function openSearch() {
    searchBar.hidden = false;
    el.classList.add('searching');
    setTimeout(() => searchInp.focus(), 50);
  }
  function closeSearch() {
    searchBar.hidden = true; el.classList.remove('searching');
    searchQ = ''; searchInp.value = ''; hits = []; hitIdx = -1;
    $('.sr-count', el).textContent = '';
    renderMsgs();
  }
  function runSearch() {
    searchQ = searchInp.value.trim();
    const q = searchQ.toLowerCase();
    hits = q ? api.messages(chatId).filter(m => m.type === 'text' && !m.unsent && m.text.toLowerCase().includes(q)).map(m => m.id) : [];
    hitIdx = hits.length - 1;
    renderMsgs();
    gotoHit();
  }
  function gotoHit() {
    $('.sr-count', el).textContent = searchQ ? (hits.length ? `${hitIdx + 1}/${hits.length}` : '0') : '';
    inner.querySelectorAll('.hit-current').forEach(n => n.classList.remove('hit-current'));
    if (hitIdx < 0) return;
    ensureLoaded(hits[hitIdx]);
    const n = inner.querySelector(`.msg-row[data-mid="${hits[hitIdx]}"]`);
    if (n) { n.classList.add('hit-current'); n.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  }
  let srT;
  searchInp.addEventListener('input', () => { clearTimeout(srT); srT = setTimeout(runSearch, 200); });
  searchInp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); searchInp.blur(); } });

  /* ---------- swipe untuk balas ---------- */
  let sw = null;
  sc.addEventListener('touchstart', e => {
    const row = e.target.closest('.msg-row');
    const t = e.touches[0];
    if (!row || row.querySelector('.unsent') || t.clientX - el.getBoundingClientRect().left < 30) return;
    sw = { row, x: t.clientX, y: t.clientY, dx: 0, active: false, hit: false };
  }, { passive: true });
  sc.addEventListener('touchmove', e => {
    if (!sw) return;
    const t = e.touches[0];
    const dx = t.clientX - sw.x, dy = t.clientY - sw.y;
    if (!sw.active) {
      if (dx < -12 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        sw.active = true; sw.row.classList.add('swiping');
        sw.ic = h(`<span class="swipe-ic">${icon('reply')}</span>`); sw.row.appendChild(sw.ic);
      } else if (Math.abs(dy) > 10 || dx > 12) { sw = null; return; }
    }
    if (sw.active) {
      sw.dx = Math.max(-84, Math.min(0, dx));
      sw.row.style.setProperty('--sx', sw.dx + 'px');
      const hit = sw.dx <= -60;
      if (hit && !sw.hit) vibrate(8);
      sw.hit = hit; sw.ic.classList.toggle('on', hit);
      sw.ic.style.opacity = Math.min(1, -sw.dx / 60);
    }
  }, { passive: true });
  const endSwipe = () => {
    if (!sw) return;
    const s = sw; sw = null;
    if (!s.active) return;
    s.row.classList.remove('swiping');
    s.row.style.removeProperty('--sx');
    s.ic?.remove();
    if (s.hit) { const m = msgById(s.row.dataset.mid); if (m) setReply(m); }
  };
  sc.addEventListener('touchend', endSwipe);
  sc.addEventListener('touchcancel', endSwipe);

  bindActs(el, {
    vote: t => { api.vote(chatId, t.dataset.mid, t.dataset.o); vibrate(8); },
    readers: t => { const m = msgById(t.dataset.mid); if (m) showReaders(m); },
    'ann-go': () => {
      const an = c().announcement;
      if (an?.mid && inner.querySelector(`.msg-row[data-mid="${an.mid}"]`)) bindGoto(an.mid);
      else sheet({ title: 'Pengumuman', top: `<p class="sheet-note">${esc(an?.text || '')}</p>` });
    },
    'ann-close': async () => { if (await confirmBox({ title: 'Hapus pengumuman?', ok: 'Hapus', danger: true })) api.setAnnouncement(chatId, null); },
    'sr-close': closeSearch,
    'sr-up': () => { if (hits.length) { hitIdx = Math.max(0, hitIdx - 1); gotoHit(); } },
    'sr-down': () => { if (hits.length) { hitIdx = Math.min(hits.length - 1, hitIdx + 1); gotoHit(); } },
    mention: t => {
      const pos = ta.selectionStart ?? ta.value.length;
      const before = ta.value.slice(0, pos).replace(/@([\p{L}\d_]*)$/u, '@' + t.dataset.n + ' ');
      ta.value = before + ta.value.slice(pos);
      ta.setSelectionRange(before.length, before.length);
      hideMentions(); autosize(); ta.focus();
    },
    'att-pay': async () => { closePanel(); const { PayScreen } = await import('./features.js'); router.push(PayScreen(chatId)); },
    'pay-now': async t => {
      const m = msgById(t.dataset.mid);
      const { askPin } = await import('./features.js');
      if (api.settings().passcode && !(await askPin('PIN buat bayar'))) return;
      const r = api.payIncoming(chatId, t.dataset.mid);
      if (r === null) toast('Saldo kurang 🥲'); else if (r) { toast(`Dibayar ${rupiah(m.per)} ✅`); vibrate(10); }
    },
    retry: t => api.remote.retry(chatId, t.dataset.mid),
    'suit-pick': t => { api.suitPick(chatId, t.dataset.mid, t.dataset.v); vibrate(10); },
    'att-game': () => { closePanel(); gameSheet(); },
    'att-poll': () => { closePanel(); router.push(PollComposeScreen(chatId)); },
    'att-event': () => { closePanel(); router.push(EventComposeScreen(chatId)); },
    rsvp: t => { api.rsvp(chatId, t.dataset.mid, t.dataset.v === '1'); vibrate(8); },
    store: () => router.push(StickerStoreScreen()),
    'sched-list': () => {
      const list = api.scheduledIn(chatId);
      sheet({
        top: `<div class="sheet-list">${list.map(x => `<div class="list-item sched-item"><span class="round-ic">${icon('clock')}</span><div class="li-main"><div class="li-name">${esc(x.payload.text || '')}</div><div class="li-sub">${esc(fmtWhen(x.at))}</div></div><button class="icon-btn sm" data-now="${x.id}" aria-label="Kirim sekarang">${icon('send')}</button><button class="icon-btn sm danger-txt" data-del="${x.id}" aria-label="Batal">${icon('trash')}</button></div>`).join('')}</div>`,
        onMount: (s, close) => s.addEventListener('click', e => {
          const n = e.target.closest('[data-now]'), d = e.target.closest('[data-del]');
          if (n) { api.sendScheduledNow(n.dataset.now); close(); }
          if (d) { api.cancelScheduled(d.dataset.del); close(); }
        }),
      });
    },
    info: () => { const ch = c(); router.push(ch.type === 'group' ? GroupInfoScreen(chatId) : ProfileScreen(api.peerOf(ch).id)); },
    call: () => startCall(chatId, false),
    video: () => startCall(chatId, true),
    menu: chatMenu,
    send: () => { ta.value.trim() ? sendText() : startRec(); },
    plus: () => openPanel('plus'),
    stickers: () => openPanel('stickers'),
    stab: t => { stickerTab = t.dataset.k; renderPanel(); },
    'make-sticker': () => openStickerMaker(() => { stickerTab = 'mine'; renderPanel(); }),
    'my-sticker': t => { const s = api.myStickers().find(x => x.id === t.dataset.id); if (s) { api.send(chatId, withReply({ type: 'sticker', sticker: '✨', img: s.src })); vibrate(6); } },
    sticker: t => sendSticker(t.dataset.s, t.dataset.a),
    'quick-sticker': t => sendSticker(t.dataset.s),
    emoji: t => {
      const s = ta.selectionStart ?? ta.value.length;
      ta.value = ta.value.slice(0, s) + t.dataset.e + ta.value.slice(ta.selectionEnd ?? s);
      autosize();
    },
    'att-photo': () => sendImage(false),
    'att-camera': () => sendImage(true),
    'replay-fx': (t, e) => { if (e.target.closest('a')) return; const m = api.messages(chatId).find(x => x.id === t.dataset.mid); const fx = effectOf(m); if (fx) playEffect(fx, el); },
    'open-post': async t => { const { PostDetailScreen } = await import('./screens.js'); if (api.post(t.dataset.pid)) router.push(PostDetailScreen(t.dataset.pid)); },
    'att-location': () => { closePanel(); const p = api.randomPlace(); api.send(chatId, withReply({ type: 'location', ...p })); },
    'att-voice': () => startRec(),
    'att-video': sendVideo,
    'att-file': sendFile,
    'open-video': t => { const m = msgById(t.dataset.mid); if (m) openMediaMsg(m); },
    'open-file': t => { const m = msgById(t.dataset.mid); if (m) openMediaMsg(m); },
    'att-call': () => { closePanel(); startCall(chatId, false); },
    'att-vcall': () => { closePanel(); startCall(chatId, true); },
    'rec-cancel': () => stopRec(false),
    'rec-send': () => stopRec(true),
    'cancel-reply': () => setReply(null),
    'view-img': t => {
      const all = api.images(chatId);
      const id = +t.dataset.i ? t.dataset.mid + '~' + t.dataset.i : t.dataset.mid;
      const at = Math.max(0, all.findIndex(x => x.id === id));
      openGallery(all.map(x => ({ src: x.src, caption: api.user(x.from)?.name || '' })), at);
    },
    play: t => playVoice(t.dataset.mid),
    loc: t => { const m = msgById(t.dataset.mid); if (m) window.open('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(m.title + ' ' + m.address), '_blank'); },
    profile: t => router.push(ProfileScreen(t.dataset.id)),
    goto: t => bindGoto(t.dataset.mid),
    'react-info': t => {
      const m = msgById(t.dataset.mid);
      const rows = Object.entries(m.reactions).flatMap(([e, ids]) => ids.map(id => `<div class="list-item">${avatar(api.user(id), 36)}<div class="li-main"><div class="li-name">${esc(id === ME ? 'Kamu' : api.user(id)?.name)}</div></div><span class="react-big">${e}</span></div>`)).join('');
      sheet({ top: `<div class="sheet-list">${rows}</div>` });
    },
  });
  onLongPress(inner, '.msg-row .bubble, .msg-row .sticker, .msg-row .photo, .msg-row .jumbo', b => msgMenu(b.closest('.msg-row')));

  /* ---------- lifecycle ---------- */
  const offs = [
    bus.on('messages', id => { if (id === chatId) { renderMsgs(); api.markRead(chatId); } }),
    bus.on('typing', id => { if (id === chatId) { renderTyping(); renderHeader(); } }),
    bus.on('chats', renderHeader),
    bus.on('presence', renderHeader),
    bus.on('wallpaper', id => id === chatId && renderHeader()),
    bus.on('scheduled', renderSched),
    bus.on('packs', () => panelMode === 'stickers' && renderPanel()),
  ];
  const onVis = () => { if (!document.hidden) api.markRead(chatId); };
  document.addEventListener('visibilitychange', onVis);

  ta.value = c()?.draft || '';
  autosize();
  renderHeader();
  renderMsgs();
  renderTyping();
  renderSched();

  return {
    el, chatId, goto: bindGoto,
    show() { api.setActive(chatId); api.markRead(chatId); renderHeader(); },
    destroy() {
      offs.forEach(f => f());
      document.removeEventListener('visibilitychange', onVis);
      stopPlay();
      if (rec) stopRec(false);
      api.setDraft(chatId, ta.value.trim());
      if (router.top()?.chatId !== chatId) api.setActive(router.top()?.chatId || null);
    },
  };
}

function openVideo(url) {
  const el = h(`<div class="viewer"><div class="viewer-top"><button class="icon-btn" data-x>${icon('x')}</button><span></span></div><video src="${url}" controls autoplay playsinline></video></div>`);
  document.getElementById('app').appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  $('[data-x]', el).addEventListener('click', () => { $('video', el).pause(); el.classList.remove('show'); setTimeout(() => el.remove(), 250); });
}

/* ================= CALL ================= */
let callOpen = false;
export function startCall(chatId, video = false, incoming = false, rtc = null) {
  if (callOpen) { rtc?.reject?.(); return; }
  const ch = api.chat(chatId);
  if (!ch) return;
  if (ch.remote && !incoming) {
    if (ch.type !== 'direct') return toast('Call grup online belum ada');
    if (!canCall()) return toast('Telepon butuh HTTPS 🔒');
    rtc = callSession(chatId, video);
    if (!rtc) return;
  }
  callOpen = true;
  const title = api.chatTitle(ch);
  const hue = ch.type === 'group' ? ch.hue : api.peerOf(ch)?.hue;
  const isGroup = ch.type === 'group';
  const others = isGroup ? ch.members.filter(id => id !== ME && api.user(id)) : [];
  const tile = id => {
    const u = api.user(id);
    return `<div class="gc-tile ${id === ME ? 'me joined' : ''}" data-u="${id}">${id === ME ? '<video playsinline autoplay muted hidden></video>' : ''}${avatar(u, 60)}<span class="gc-name">${esc(id === ME ? 'Kamu' : firstName(u?.name))}<i class="gc-mute">${icon('micOff')}</i></span></div>`;
  };
  const statusTxt = incoming ? (video ? 'Video call…' : 'Panggilan masuk…') : 'Memanggil…';
  const el = h(`<div class="call ${video ? 'is-video' : ''} ${incoming ? 'is-incoming' : ''} ${isGroup ? 'is-group' : ''}" style="--h:${hue ?? 260}">
    <div class="call-bg"></div>
    <video class="remote-cam" playsinline autoplay hidden></video>
    <video class="self-cam" playsinline autoplay muted hidden></video>
    <div class="call-top"><span class="enc">${icon('lock', 'tiny')}</span></div>
    ${isGroup ? `<div class="call-center gc">
      <div class="gc-head"><h2>${esc(title)}</h2><p class="call-status">${statusTxt}</p></div>
      <div class="gc-grid n${Math.min(others.length + 1, 6)}">${[ME, ...others].slice(0, 6).map(tile).join('')}</div>
    </div>` : `<div class="call-center">
      <div class="call-av">${chatAvatar(ch, 116, { online: false })}</div>
      <h2>${esc(title)}</h2>
      <p class="call-status">${statusTxt}</p>
    </div>`}
    <div class="call-controls"></div>
  </div>`);
  document.getElementById('app').appendChild(el);
  el.addEventListener('scroll', () => { el.scrollTop = 0; el.scrollLeft = 0; });
  requestAnimationFrame(() => el.classList.add('show'));
  vibrate([20, 60, 20]);

  let state = incoming ? 'ringing' : 'calling';
  let t0 = 0, timer = null, ringT = null, stream = null, muted = false, speaker = false, camOn = video, talkT = null;
  const status = $('.call-status', el), ctr = $('.call-controls', el), cam = $(isGroup ? '.gc-tile.me video' : '.self-cam', el);
  const joinTimers = [];
  function join(id) {
    if (state === 'ended') return;
    const t = el.querySelector(`.gc-tile[data-u="${id}"]`);
    if (!t) return;
    t.classList.add('joined');
    if (Math.random() < 0.3) t.classList.add('muted');
    vibrate(6);
    if (state === 'calling') connect();
  }

  const remoteV = $('.remote-cam', el);
  if (rtc) {
    rtc.on('local', s => { if (s.getVideoTracks().length) { cam.srcObject = s; cam.hidden = !camOn; } });
    rtc.on('remote', s => {
      remoteV.srcObject = s; remoteV.hidden = !s.getVideoTracks().length;
      el.classList.toggle('has-remote', !remoteV.hidden);
      remoteV.play?.().catch(() => {});
    });
    rtc.on('connected', () => { if (state !== 'live') connect(); });
    rtc.on('ended', r => {
      if (r === 'nomedia') toast('Mic/kamera nggak bisa dipakai 🔒');
      if (r === 'busy') toast('Lagi di panggilan lain');
      end(state === 'live' ? undefined : r === 'reject' ? 'declined' : r === 'busy' ? 'noanswer' : r === 'end' && incoming ? 'missed' : undefined, true);
    });
  }

  async function camera(on) {
    if (rtc) return;
    if (on) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
        if (state === 'ended') return stream.getTracks().forEach(t => t.stop());
        cam.srcObject = stream; cam.hidden = false;
      } catch { cam.hidden = true; }
    } else {
      stream?.getTracks().forEach(t => t.stop()); stream = null; cam.hidden = true;
    }
  }

  function controls() {
    if (state === 'ringing') {
      ctr.innerHTML = `<button class="cbtn end" data-c="decline" aria-label="Tolak">${icon('phoneOff')}</button>
        <button class="cbtn accept" data-c="accept" aria-label="Angkat">${icon(video ? 'video' : 'phone')}</button>`;
      return;
    }
    ctr.innerHTML = `<button class="cbtn ${muted ? 'on' : ''}" data-c="mute" aria-label="Mute">${icon(muted ? 'micOff' : 'mic')}</button>
      <button class="cbtn ${camOn ? 'on' : ''}" data-c="cam" aria-label="Kamera">${icon(camOn ? 'video' : 'videoOff')}</button>
      <button class="cbtn ${speaker ? 'on' : ''}" data-c="speaker" aria-label="Speaker">${icon('volume')}</button>
      <button class="cbtn end" data-c="end" aria-label="Akhiri">${icon('phoneOff')}</button>`;
    el.querySelector('.gc-tile.me')?.classList.toggle('muted', muted);
  }

  function connect() {
    state = 'live'; t0 = Date.now();
    el.classList.add('live');
    status.textContent = '00:00';
    timer = setInterval(() => { status.textContent = dur((Date.now() - t0) / 1000); }, 500);
    controls();
    if (isGroup) {
      talkT = setInterval(() => {
        const tiles = [...el.querySelectorAll('.gc-tile.joined:not(.muted)')];
        tiles.forEach(t => t.classList.remove('speaking'));
        if (tiles.length && Math.random() < 0.85) tiles[Math.floor(Math.random() * tiles.length)].classList.add('speaking');
      }, 1300);
      if (incoming) others.forEach((id, i) => joinTimers.push(setTimeout(() => join(id), 300 + i * 700)));
    }
  }

  function end(st, fromRemote) {
    if (state === 'ended') return;
    const was = state;
    state = 'ended';
    if (rtc && !fromRemote) (st === 'declined' ? rtc.reject() : rtc.hangup());
    if (remoteV) { remoteV.srcObject = null; }
    clearInterval(timer); clearTimeout(ringT); clearInterval(talkT); joinTimers.forEach(clearTimeout);
    camera(false);
    let logStatus;
    if (was === 'live') logStatus = 'done';
    else if (incoming) logStatus = st || 'missed';
    else logStatus = st || 'noanswer';
    const duration = was === 'live' ? Math.round((Date.now() - t0) / 1000) : 0;
    api.logCall({ chatId, video, dir: incoming ? 'in' : 'out', status: logStatus, duration });
    status.textContent = logStatus === 'done' ? 'Selesai' : logStatus === 'noanswer' ? 'Tidak dijawab' : 'Berakhir';
    ctr.innerHTML = '';
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => { el.remove(); callOpen = false; }, 300); }, 900);
  }

  ctr.addEventListener('click', e => {
    const b = e.target.closest('[data-c]');
    if (!b) return;
    vibrate(8);
    const a = b.dataset.c;
    if (a === 'end') end();
    else if (a === 'decline') end('declined');
    else if (a === 'accept') {
      if (rtc) { if (!canCall()) { toast('Telepon butuh HTTPS 🔒'); return end('declined'); } state = 'connecting'; status.textContent = 'Menyambungkan…'; ctr.innerHTML = `<button class="cbtn end" data-c="end" aria-label="Akhiri">${icon('phoneOff')}</button>`; rtc.accept(); return; }
      connect(); if (camOn) camera(true);
    }
    else if (a === 'mute') { muted = !muted; rtc?.setMute(muted); controls(); }
    else if (a === 'speaker') { speaker = !speaker; controls(); }
    else if (a === 'cam') {
      if (rtc && !rtc.hasVideo()) return toast('Kamera cuma di video call');
      camOn = !camOn; el.classList.toggle('is-video', camOn);
      if (rtc) { rtc.setCam(camOn); cam.hidden = !camOn; } else camera(camOn);
      controls();
    }
  });

  controls();
  if (rtc) {
    if (!incoming) { rtc.start(); ringT = setTimeout(() => { if (state === 'calling') end('noanswer'); }, 35000); }
    else ringT = setTimeout(() => { if (state === 'ringing') end('missed'); }, 35000);
    return;
  }
  if (camOn && !incoming) camera(true);
  if (!incoming && isGroup) {
    others.forEach((id, i) => { if (i === 0 || Math.random() < 0.8) joinTimers.push(setTimeout(() => join(id), 1800 + i * (900 + Math.random() * 1800))); });
    ringT = setTimeout(() => { if (state === 'calling') end('noanswer'); }, 20000);
  } else if (!incoming) {
    ringT = setTimeout(() => { if (state !== 'calling') return; Math.random() < 0.85 ? connect() : end('noanswer'); }, 2500 + Math.random() * 2500);
  } else {
    ringT = setTimeout(() => { if (state === 'ringing') end('missed'); }, 20000);
  }
}

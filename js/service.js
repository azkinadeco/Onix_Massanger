/*
 * ONIX SERVICE (DUMMY)
 * ---------------------------------------------------------------
 * Semua akses data aplikasi lewat objek `api` di file ini.
 * Saat ini datanya disimpan di localStorage dan balasan teman
 * disimulasikan. Nanti tinggal ganti isi fungsi-fungsi ini dengan
 * panggilan ke backend (REST / WebSocket / Firebase / Supabase, dll.)
 * dan memanggil bus.emit(...) saat ada event dari server.
 *
 * Event yang dipakai UI:
 *  chats, messages(chatId), typing(chatId), friends, me, posts,
 *  stories, calls, settings, presence, notify({chat,msg}),
 *  incoming-call({chatId,video}), storage-full
 */
import { buildSeed, USERS, PLACES, DEFAULT_PACKS, STORE_PACKS } from './seed.js';

export const ME = 'me';
const KEY = 'onix:v1';
let db = null;

const L = {};
export const bus = {
  on(e, f) { (L[e] ||= new Set()).add(f); return () => L[e].delete(f); },
  emit(e, d) { L[e]?.forEach(f => { try { f(d); } catch (err) { console.error(err); } }); },
};

const uid = (p = 'm') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const pick = a => a[Math.floor(Math.random() * a.length)];
const rand = (a, b) => a + Math.random() * (b - a);
const shuffle = a => a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(x => x[1]);
export const firstName = n => (n || '').split(' ')[0];

/* ---------- persistence ---------- */
let saveT;
function save() { clearTimeout(saveT); saveT = setTimeout(flush, 250); }
function flush() {
  if (!db) return;
  try { localStorage.setItem(KEY, JSON.stringify(db)); }
  catch (e) { bus.emit('storage-full'); }
}
window.addEventListener('pagehide', flush);
document.addEventListener('visibilitychange', () => document.hidden && flush());

try {
  const d = JSON.parse(localStorage.getItem(KEY) || 'null');
  if (d && d.v === 1 && d.me) {
    db = migrate(d);
    Object.values(db.messages).forEach(list => list.forEach(m => { if (m.status === 'sending') m.status = 'sent'; }));
  }
} catch { /* data rusak -> mulai baru */ }

/* ---------- migrasi data lama -> fitur baru ---------- */
function migrate(d) {
  d.keep ||= [];
  d.notes ||= {};
  d.scheduled ||= [];
  d.packs ||= DEFAULT_PACKS.slice();
  if (!d.activity) {
    const t = Date.now();
    d.activity = [
      { id: 'a1', type: 'friend', from: 'luna', ts: t - 20 * 60e3, read: false },
      { id: 'a2', type: 'like', from: 'kezia', ref: { userId: 'kezia' }, text: 'story', ts: t - 2 * 3600e3, read: false },
      { id: 'a3', type: 'friend', from: 'reza', ts: t - 26 * 3600e3, read: true },
    ];
  }
  d.settings.fontSize ||= 'm';
  if (!d.featuresV4) {
    d.featuresV4 = true;
    const t = Date.now(), day = 864e5;
    const mmdd = ts => { const x = new Date(ts); return `${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
    const bd = { nadia: mmdd(t), kezia: mmdd(t + 3 * day), dimas: mmdd(t + 9 * day), salsa: mmdd(t + 20 * day), raka: mmdd(t + 40 * day) };
    Object.entries(bd).forEach(([id, v]) => { if (d.users[id]) d.users[id].birthday = v; });
    if (d.chats.g_project) d.notes.g_project = [
      { id: 'n1', from: 'raka', ts: t - 2 * day, text: '📌 Pembagian tugas laporan\n• Bab 1: Raka\n• Bab 2: Dimas\n• Bab 3 + kesimpulan: kamu\n• Slide: Farel\n• Revisi & dapus: Yoga' },
      { id: 'n2', from: 'yoga', ts: t - day, text: 'Format: Times New Roman 12, spasi 1.5, margin 4-3-3-3 ✍️' },
    ];
    if (d.chats.g_bestie) d.notes.g_bestie = [{ id: 'n3', from: 'salsa', ts: t - 3 * day, text: '🎤 List lagu karaoke:\n1. APT.\n2. Dynamite\n3. Sial\n4. Monokrom' }];
  }
  if (!('passcode' in d.settings)) d.settings.passcode = null;
  Object.values(d.chats).forEach(c => { c.wallpaper ||= 'default'; });
  if (!d.featuresV2) {
    d.featuresV2 = true;
    const t = Date.now();
    const gp = d.messages.g_project, gb = d.chats.g_bestie;
    if (gp && d.chats.g_project && !d.chats.g_project.left) {
      gp.push({ id: 'poll1', chatId: 'g_project', from: 'raka', ts: t - 2 * 3600e3, type: 'poll', reactions: {}, readBy: [], status: 'sent',
        poll: { q: 'Ngerjain bareng dimana guys?', multi: false, options: [
          { id: 'o0', text: 'Perpus kampus 📚', votes: ['raka', 'yoga'] },
          { id: 'o1', text: 'Kafe deket kampus ☕', votes: ['dimas'] },
          { id: 'o2', text: 'Online aja 💻', votes: ['farel'] }] } });
      d.chats.g_project.updatedAt = Math.max(d.chats.g_project.updatedAt, t - 2 * 3600e3);
    }
    if (gb && !gb.announcement) gb.announcement = { mid: null, text: '🎤 Karaoke sabtu jam 7 malam, jangan telat!!', from: 'salsa' };
    d.keep.push({ id: 'k_welcome', ts: t, type: 'note', text: 'Keep = tempat nyimpen pesan, foto, dan catatan penting kamu ✨\nTahan pesan di chat → "Simpan ke Keep".' });
  }
  return d;
}

/* ---------- runtime state (tidak disimpan) ---------- */
let activeChat = null;
const typing = {}; // chatId -> Set(userId)
const pendingReply = {};

/* ---------- teks simulasi ---------- */
const GENERIC = ['wkwk iya bener 😂', 'anjir serius?? 😭', 'valid banget sih', 'HAHAHA ngakak 💀', 'boleh boleh', 'sama aku juga', 'fr fr', 'oke noted ✍️', 'hmm bisa jadi sih 🤔', 'gas lah 🔥', 'bentar ya lagi sibuk dikit', 'ih lucu bgt', 'no debat', 'nanti aku kabarin yaa', 'okeyy', 'wkwkwk parah', 'beneran deh', 'siap 🫡', 'iyaa', 'ga sih 😭'];
const RULES = [
  [/^(halo|hai|hi|hey|hello|p|woi|oi|helo)\b/i, ['haii! 👋', 'yoo whatsup', 'hai jugaa ✨', 'apa nih']],
  [/makan|laper|lapar|maem/i, ['ayo makan dimana? 🍜', 'aku juga laper bgt', 'mie ayam ga sih']],
  [/tugas|nugas|deadline|kuliah|ujian/i, ['duh jangan ingetin 😭', 'semangat nugasnya!! 💪', 'aku juga belum kelar wkwk']],
  [/makasih|thanks|thx|tengkyu|trims/i, ['sama-samaa 🫶', 'santuy', 'anytime bestie']],
  [/kangen|miss u|rindu/i, ['kangen jugaa 🥺', 'ayo ketemu!']],
  [/main|nongkrong|jalan|hangout|ketemu|karaoke/i, ['gas kapan?', 'aku free weekend nih', 'skuy! dimana?']],
  [/sedih|capek|cape|lelah|stress|stres/i, ['peluk jauh 🫂', 'istirahat dulu yaa', 'semangat, kamu hebat kok 💗']],
  [/wkwk|haha|😂|🤣/i, ['wkwkwk', 'HAHAHAHA 💀', 'ngakak parah']],
  [/\?\s*$/, ['hmm bisa jadi', 'kayaknya iya deh', 'ga tau juga sih 😅', 'coba nanti aku cek ya']],
];
const STICKER_REPLIES = ['😂', '🥹', '🫶', '👍', '💀', '✨', '🫡', '😭'];
const ANIM_REPLIES = [{ sticker: '👋', anim: 'wave' }, { sticker: '💖', anim: 'beat' }, { sticker: '😂', anim: 'shake' }, { sticker: '🥳', anim: 'bounce' }];
const FOLLOWUPS = ['btw', 'eh iya', 'oiya lupa', '😂', 'hehe'];
const INCOMING = ['eh lagi apa?', 'liat ini deh 😭', 'nanti malem call yuk', 'udah makan belom?', 'gabut bgt sumpah', 'besok free ga?', 'AAAA aku lulus ujian 🥳', 'rekomen series dong', 'wkwk tadi aku liat kamu lewat', 'jangan lupa minum air putih ya 💧'];
const GROUP_INCOMING = ['siapa yg udah sampe?', 'guys liat ini wkwk', 'vote dong: pizza atau mie? 🍕🍜', 'info info 📢', 'gas nanti malem?'];
const BOT = ['Ini akun resmi (dummy) Onix 🤖 Coba chat teman kamu ya!', 'Fitur server belum aktif, tapi semua tampilan udah bisa kamu coba ✨', 'Tips: tahan pesan buat kasih reaksi 😆'];

function replyFor(msg) {
  if (msg.type === 'sticker') return Math.random() < 0.6 ? { type: 'sticker', ...(Math.random() < 0.5 ? pick(ANIM_REPLIES) : { sticker: pick(STICKER_REPLIES) }) } : { text: pick(['wkwk lucu stickernya', '😂😂', 'apaan sih wkwk']) };
  if (msg.type === 'image') return { text: pick(msg.album ? ['banyak bgt fotonya 😭', 'spam foto nih wkwk', 'yang ketiga bagus!', 'kirim lagi dong 📸'] : ['wih keren bgt 📸', 'aesthetic parah', 'save ah', 'dimana tuh?']) };
  if (msg.type === 'voice') return { text: pick(['bentar aku dengerin dulu 🎧', 'oke paham', 'wkwk suaranya lucu']) };
  if (msg.type === 'video') return { text: pick(['wkwk videonya 😭', 'bentar aku tonton dulu 🎬', 'LUCU BANGET']) };
  if (msg.type === 'file') return { text: pick(['oke aku download ya 📥', 'makasih filenya 🙏', 'sip udah masuk']) };
  if (msg.type === 'event') return { text: pick(['aku ikut! 🙋', 'catet ya tanggalnya 📅', 'gas, nanti ingetin ya']) };
  if (/hbd|ulang tahun|ultah|happy birthday/i.test(msg.text || '')) return { text: pick(['MAKASIHHH 🥹🫶', 'aaa makasih banyak!! 🎂', 'thank youuu 💖']) };
  if (msg.type === 'game') {
    if (msg.game === 'dice') return Math.random() < .6 ? { type: 'game', game: 'dice', result: 1 + Math.floor(Math.random() * 6) } : { text: msg.result >= 5 ? pick(['hoki bgt 😭', 'curang ih', 'wih gede']) : pick(['wkwk kecil', 'aku menang pasti', 'lagi lagi!']) };
    if (msg.game === 'coin') return { text: pick(['yaudah fix', 'best of 3?', 'wkwk takdir', 'oke deal 🤝']) };
  }
  if (msg.type === 'post') return { text: pick(['wkwk iya liat', 'LUCU 😭', 'udah aku like 💖', 'ih bener bgt']) };
  if (msg.type === 'poll') return { text: pick(['udah aku vote ya ✅', 'vote done 🗳️', 'aku pilih yg kedua wkwk']) };
  if (/@\w/.test(msg.text || '') && Math.random() < 0.5) return { text: pick(['kenapa manggil aku? 👀', 'iyaa kenapa?', 'hadir! 🙋']) };
  if (msg.type === 'location') return { text: pick(['oke otw kesana', 'deket dari aku tuh', 'share loc diterima 📍']) };
  const t = msg.text || '';
  for (const [re, arr] of RULES) if (re.test(t)) return { text: pick(arr) };
  if (Math.random() < 0.15) return { type: 'sticker', sticker: pick(STICKER_REPLIES) };
  return { text: pick(GENERIC) };
}

/* ---------- helpers internal ---------- */
function emitChat(chatId) { bus.emit('messages', chatId); bus.emit('chats'); save(); }

function newMsg(chatId, from, payload) {
  const m = { id: uid(), chatId, from, ts: Date.now(), type: 'text', reactions: {}, readBy: [], status: 'sent', ...payload };
  const ttl = db?.chats[chatId]?.ttl;
  if (ttl && m.type !== 'system') m.expires = m.ts + ttl * 1000;
  return m;
}
export const TTL_OPTS = [[0, 'Mati'], [30, '30 detik'], [300, '5 menit'], [3600, '1 jam'], [86400, '1 hari'], [604800, '7 hari']];
export const ttlLabel = s => (TTL_OPTS.find(x => x[0] === s) || [0, `${s} dtk`])[1];

function receive(chatId, from, payload) {
  const c = db.chats[chatId];
  if (!c || db.blocked.includes(from)) return;
  const m = newMsg(chatId, from, payload);
  db.messages[chatId].push(m);
  c.updatedAt = m.ts;
  c.hidden = false;
  if (db.users[from]) { db.users[from].online = true; db.users[from].lastSeen = Date.now(); }
  const mentionsMe = c.type === 'group' && mentionRe(db.me.name).test(m.text || '');
  if (activeChat !== chatId || document.hidden) {
    c.unread = (c.unread || 0) + 1;
    if (mentionsMe) { c.mention = true; addActivity('mention', from, { chatId }, m.text); }
    if (!c.secret && (!c.muted || mentionsMe)) bus.emit('notify', { chat: c, msg: m, mention: mentionsMe });
  }
  emitChat(chatId);
  return m;
}

export const mentionRe = name => new RegExp('@' + firstName(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');

function addActivity(type, from, ref = {}, text = '') {
  if (!db || db.blocked.includes(from)) return;
  db.activity.unshift({ id: uid('a'), type, from, ref, text, ts: Date.now(), read: false });
  db.activity = db.activity.slice(0, 100);
  save(); bus.emit('activity');
}

export function suitResult(a, b) {
  if (a === b) return 0;
  return (a === 'rock' && b === 'scissors') || (a === 'paper' && b === 'rock') || (a === 'scissors' && b === 'paper') ? 1 : -1;
}

function readAll(chatId, userId) {
  const list = db.messages[chatId] || [];
  let changed = false;
  list.forEach(m => {
    if (m.from === ME && m.type !== 'system' && !m.readBy.includes(userId)) { m.readBy.push(userId); changed = true; }
  });
  if (changed) emitChat(chatId);
}

function setTyping(chatId, userId, on) {
  const s = (typing[chatId] ||= new Set());
  on ? s.add(userId) : s.delete(userId);
  bus.emit('typing', chatId);
  bus.emit('chats');
}

function scheduleResponses(chatId, msg) {
  const c = db.chats[chatId];
  if (!c) return;
  const others = c.members.filter(m => m !== ME && !db.blocked.includes(m) && db.users[m]);
  if (!others.length) return;
  others.forEach(id => {
    if (c.type === 'group' && Math.random() < 0.25) return;
    setTimeout(() => readAll(chatId, id), rand(700, 2600));
  });
  if (msg.type === 'game' && msg.game === 'suit') return;
  clearTimeout(pendingReply[chatId]);
  pendingReply[chatId] = setTimeout(() => {
    const mentioned = others.filter(id => mentionRe(db.users[id].name).test(msg.text || ''));
    const responders = c.type === 'direct'
      ? (Math.random() < 0.92 ? others : [])
      : mentioned.length ? mentioned : shuffle(others).slice(0, Math.random() < 0.5 ? 1 : 2);
    responders.forEach((id, i) => {
      setTimeout(() => {
        readAll(chatId, id);
        setTyping(chatId, id, true);
        setTimeout(() => {
          setTyping(chatId, id, false);
          const official = db.users[id]?.official;
          receive(chatId, id, official ? { text: pick(BOT) } : replyFor(msg));
          if (!official && Math.random() < 0.2) {
            setTimeout(() => receive(chatId, id, { text: pick(FOLLOWUPS) }), rand(1200, 2500));
          }
        }, rand(1200, 2800));
      }, i * rand(1800, 3500));
    });
  }, rand(1500, 3200));
}

/* ---------- offline: antrian pesan ---------- */
const outbox = [];
window.addEventListener('online', () => {
  bus.emit('network', true);
  const q = outbox.splice(0);
  q.forEach(([chatId, m], i) => setTimeout(() => { m.status = 'sent'; emitChat(chatId); scheduleResponses(chatId, m); }, 300 + i * 150));
});
window.addEventListener('offline', () => bus.emit('network', false));

/* ---------- pesan sementara: hapus yang kedaluwarsa ---------- */
setInterval(() => {
  if (!db) return;
  const now = Date.now();
  for (const id in db.messages) {
    const list = db.messages[id];
    if (!list.some(m => m.expires && m.expires <= now)) continue;
    db.messages[id] = list.filter(m => !(m.expires && m.expires <= now));
    emitChat(id);
  }
}, 1000);

/* ---------- simulasi aktivitas ---------- */
let nextIncoming = Date.now() + rand(40e3, 70e3);
setInterval(() => {
  if (!db) return;
  const now = Date.now();
  const due = db.scheduled.filter(x => x.at <= now);
  if (due.length) {
    db.scheduled = db.scheduled.filter(x => x.at > now);
    due.forEach(x => { if (db.chats[x.chatId]) api.send(x.chatId, x.payload); });
    bus.emit('scheduled');
  }
}, 3000);

setInterval(() => {
  if (!db) return;
  // presence acak
  const ids = db.friends;
  for (let i = 0; i < 2; i++) {
    const u = db.users[pick(ids)];
    if (!u) continue;
    if (u.online) u.lastSeen = Date.now();
    u.online = Math.random() < 0.5;
  }
  bus.emit('presence');
  if (db.settings.simulate && Date.now() > nextIncoming && !document.hidden) {
    nextIncoming = Date.now() + rand(45e3, 95e3);
    api.simulateIncoming();
  }
}, 10e3);

/* ================================================================ */
export const api = {
  get ready() { return !!db?.me; },

  register({ name, id, phone = null, avatar = null, hue }) {
    db = migrate(buildSeed({ name, id, hue: hue ?? Math.floor(Math.random() * 360) }));
    Object.assign(db.me, { phone, avatar });
    flush();
  },
  idTaken(id) { return USERS.some(u => u.id === String(id).toLowerCase()); },
  reset() { db = null; localStorage.removeItem(KEY); },

  me() { return { ...db.me, id: db.me.id }; },
  updateMe(patch) { Object.assign(db.me, patch); save(); bus.emit('me'); bus.emit('chats'); },
  settings() { return db ? db.settings : { theme: 'system', accent: 'violet' }; },
  setSetting(k, v) { db.settings[k] = v; save(); bus.emit('settings'); },

  /* users & friends */
  user(id) {
    if (id === ME) return { ...db.me, uid: ME };
    return db.users[id];
  },
  friends() {
    return db.friends.filter(id => !db.blocked.includes(id)).map(id => db.users[id]).filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));
  },
  isFriend(id) { return db.friends.includes(id); },
  isFav(id) { return db.favorites.includes(id); },
  isBlocked(id) { return db.blocked.includes(id); },
  favorites() { return db.favorites.map(id => db.users[id]).filter(u => u && !db.blocked.includes(u.id)); },
  toggleFav(id) {
    const i = db.favorites.indexOf(id);
    i >= 0 ? db.favorites.splice(i, 1) : db.favorites.push(id);
    save(); bus.emit('friends');
  },
  searchUsers(q) {
    q = q.trim().toLowerCase().replace(/^@/, '');
    if (!q) return [];
    return Object.values(db.users).filter(u => !u.official && (u.id.includes(q) || u.name.toLowerCase().includes(q)));
  },
  recommended() { return Object.values(db.users).filter(u => !u.official && !db.friends.includes(u.id) && !db.blocked.includes(u.id)); },
  addFriend(id) {
    if (!db.friends.includes(id)) db.friends.push(id);
    db.blocked = db.blocked.filter(x => x !== id);
    save(); bus.emit('friends');
    setTimeout(() => {
      const c = api.directWith(id);
      receive(c.id, id, { text: pick(['makasih udah add aku! 😆', 'haii salam kenal ✨', 'yeay kita temenan 🫶']) });
    }, rand(2500, 5000));
  },
  removeFriend(id) {
    db.friends = db.friends.filter(x => x !== id);
    db.favorites = db.favorites.filter(x => x !== id);
    save(); bus.emit('friends'); bus.emit('chats');
  },
  block(id) {
    if (!db.blocked.includes(id)) db.blocked.push(id);
    db.favorites = db.favorites.filter(x => x !== id);
    save(); bus.emit('friends'); bus.emit('chats');
  },
  unblock(id) { db.blocked = db.blocked.filter(x => x !== id); save(); bus.emit('friends'); },

  /* chats */
  chats() {
    return Object.values(db.chats).filter(c => !c.hidden && !c.left && !c.archived && !c.secret)
      .sort((a, b) => (b.pinned - a.pinned) || (b.updatedAt - a.updatedAt));
  },
  archived() { return Object.values(db.chats).filter(c => !c.hidden && !c.left && c.archived && !c.secret).sort((a, b) => b.updatedAt - a.updatedAt); },
  secretChats() { return Object.values(db.chats).filter(c => !c.left && c.secret).sort((a, b) => b.updatedAt - a.updatedAt); },
  setSecret(chatId, v) { const c = db.chats[chatId]; c.secret = !!v; if (v) { c.pinned = false; c.archived = false; } save(); bus.emit('chats'); },
  unhideAllSecret() { Object.values(db.chats).forEach(c => { c.secret = false; }); save(); bus.emit('chats'); },
  setTTL(chatId, sec) {
    const c = db.chats[chatId];
    if ((c.ttl || 0) === sec) return;
    c.ttl = sec || 0;
    db.messages[chatId].push(newMsg(chatId, ME, { type: 'system', text: sec ? `⏱ Pesan sementara · ${ttlLabel(sec)}` : '⏱ Pesan sementara dimatikan' }));
    emitChat(chatId);
  },
  toggleArchive(chatId) { const c = db.chats[chatId]; c.archived = !c.archived; if (c.archived) c.pinned = false; save(); bus.emit('chats'); return c.archived; },
  setWallpaper(chatId, key) { db.chats[chatId].wallpaper = key; save(); bus.emit('chats'); bus.emit('wallpaper', chatId); },
  allChats() { return Object.values(db.chats).filter(c => !c.hidden && !c.left).sort((a, b) => b.updatedAt - a.updatedAt); },
  groups() { return Object.values(db.chats).filter(c => c.type === 'group' && !c.left); },
  chat(id) { return db.chats[id]; },
  peerOf(c) { return c.type === 'direct' ? db.users[c.members.find(m => m !== ME)] : null; },
  chatTitle(c) { return c.type === 'group' ? c.name : (api.peerOf(c)?.name || 'Pengguna'); },
  directWith(userId) {
    const id = 'd_' + userId;
    if (!db.chats[id]) {
      db.chats[id] = { id, type: 'direct', members: [ME, userId], pinned: false, muted: false, unread: 0, draft: '', createdAt: Date.now(), updatedAt: Date.now() };
      db.messages[id] = [];
      save();
    }
    db.chats[id].hidden = false;
    return db.chats[id];
  },
  createGroup(name, memberIds, emoji) {
    const id = uid('g');
    db.chats[id] = { id, type: 'group', name, emoji, hue: Math.floor(Math.random() * 360), members: [ME, ...memberIds], pinned: false, muted: false, unread: 0, draft: '', createdAt: Date.now(), updatedAt: Date.now() };
    db.messages[id] = [newMsg(id, ME, { type: 'system', text: `Kamu membuat grup "${name}"` })];
    emitChat(id);
    const m = pick(memberIds);
    setTimeout(() => {
      setTyping(id, m, true);
      setTimeout(() => { setTyping(id, m, false); receive(id, m, { text: pick(['wih grup baru 👀', 'halo semuaa 👋', 'ini grup buat apa nih wkwk']) }); }, 1800);
    }, 2500);
    return db.chats[id];
  },
  renameGroup(chatId, name) {
    const c = db.chats[chatId];
    c.name = name;
    db.messages[chatId].push(newMsg(chatId, ME, { type: 'system', text: `Kamu mengganti nama grup jadi "${name}"` }));
    emitChat(chatId);
  },
  addMembers(chatId, ids) {
    const c = db.chats[chatId];
    ids.forEach(id => { if (!c.members.includes(id)) c.members.push(id); });
    const names = ids.map(id => firstName(db.users[id]?.name)).join(', ');
    db.messages[chatId].push(newMsg(chatId, ME, { type: 'system', text: `Kamu menambahkan ${names}` }));
    c.updatedAt = Date.now();
    emitChat(chatId);
  },
  leaveGroup(chatId) { db.chats[chatId].left = true; save(); bus.emit('chats'); },

  messages(chatId) { return db.messages[chatId] || []; },
  lastMessage(chatId) { const l = db.messages[chatId]; return l?.[l.length - 1]; },
  typingIn(chatId) { return [...(typing[chatId] || [])]; },
  totalUnread(exceptId) { return Object.values(db.chats).filter(c => !c.left && !c.secret && c.id !== exceptId).reduce((s, c) => s + (c.unread || 0), 0); },
  setActive(chatId) { activeChat = chatId; },
  markRead(chatId) { const c = db.chats[chatId]; if (c && (c.unread || c.mention)) { c.unread = 0; c.mention = false; save(); bus.emit('chats'); } },
  markUnread(chatId) { const c = db.chats[chatId]; c.unread = Math.max(1, c.unread || 0); save(); bus.emit('chats'); },
  setDraft(chatId, text) { const c = db.chats[chatId]; if (c && c.draft !== text) { c.draft = text; save(); bus.emit('chats'); } },

  send(chatId, payload) {
    const c = db.chats[chatId];
    const m = newMsg(chatId, ME, { ...payload, status: 'sending' });
    db.messages[chatId].push(m);
    c.updatedAt = m.ts; c.hidden = false; c.draft = '';
    emitChat(chatId);
    if (!navigator.onLine) { outbox.push([chatId, m]); return m; }
    setTimeout(() => { m.status = 'sent'; emitChat(chatId); }, rand(250, 600));
    scheduleResponses(chatId, m);
    return m;
  },
  /* mini game */
  playGame(chatId, game, pickVal) {
    if (game === 'dice') return api.send(chatId, { type: 'game', game, result: 1 + Math.floor(Math.random() * 6) });
    if (game === 'coin') return api.send(chatId, { type: 'game', game, result: Math.random() < .5 ? 'A' : 'G' });
    const c = db.chats[chatId];
    const m = api.send(chatId, { type: 'game', game: 'suit', picks: { [ME]: pickVal } });
    const opp = c.members.find(id => id !== ME && db.users[id] && !db.users[id].official) || c.members.find(id => id !== ME);
    if (opp) setTimeout(() => {
      m.picks[opp] = pick(['rock', 'paper', 'scissors']);
      m.opp = opp;
      emitChat(chatId);
      setTimeout(() => {
        const r = suitResult(m.picks[ME], m.picks[opp]);
        receive(chatId, opp, { text: r === 1 ? pick(['yah kalah 😭', 'lagi dong, rematch!', 'hoki doang itu']) : r === -1 ? pick(['EZ 😎', 'wkwk menang', 'gampang']) : pick(['seri wkwk', 'jodoh nih 🤝', 'sama lagi']) });
      }, 1600);
    }, rand(1800, 3200));
    return m;
  },

  /* penyimpanan */
  storageStats() {
    const size = s => new Blob([s]).size;
    const per = Object.values(db.chats).filter(c => !c.left).map(c => {
      const list = db.messages[c.id] || [];
      let media = 0, text = 0, mediaIds = [], n = 0;
      list.forEach(m => {
        const imgs = m.type === 'image' ? (m.album?.length ? m.album : [m]) : [];
        imgs.forEach(x => { if (x.src) { media += x.src.length; n++; } });
        if (m.thumb) media += m.thumb.length;
        if (m.mediaId) { mediaIds.push(m.mediaId); n++; }
        if (m.type === 'voice' && m.src) { media += m.src.length; n++; }
        if (m.type === 'text') text += (m.text || '').length;
      });
      return { id: c.id, media, text, mediaIds, count: n };
    });
    const all = JSON.stringify(db);
    const posts = size(JSON.stringify(db.posts)) + size(JSON.stringify(db.myStory || null));
    return { total: size(all), per, posts };
  },
  clearChatMedia(chatId) {
    const ids = [];
    (db.messages[chatId] || []).forEach(m => {
      if (m.type === 'image') { m.src = null; m.album?.forEach(x => { x.src = null; }); m.cleared = true; }
      if (m.type === 'voice' && m.src) { m.src = null; m.cleared = true; }
      if (m.mediaId) { ids.push(m.mediaId); m.thumb = null; m.cleared = true; m.mediaId = null; }
    });
    emitChat(chatId);
    return ids;
  },
  react(chatId, msgId, emoji) {
    const m = db.messages[chatId].find(x => x.id === msgId);
    if (!m) return;
    const had = (m.reactions[emoji] || []).includes(ME);
    Object.keys(m.reactions).forEach(k => { m.reactions[k] = m.reactions[k].filter(x => x !== ME); if (!m.reactions[k].length) delete m.reactions[k]; });
    if (!had) (m.reactions[emoji] ||= []).push(ME);
    emitChat(chatId);
    // kadang teman ikut react pesan kamu
    if (!had && m.from === ME && Math.random() < 0.4) {
      const other = db.chats[chatId].members.find(x => x !== ME);
      setTimeout(() => { (m.reactions[emoji] ||= []).includes(other) || m.reactions[emoji].push(other); emitChat(chatId); }, rand(1500, 4000));
    }
  },
  unsend(chatId, msgId) {
    const m = db.messages[chatId].find(x => x.id === msgId);
    if (!m) return;
    Object.assign(m, { unsent: true, text: '', src: null, sticker: null, reactions: {}, replyTo: null });
    emitChat(chatId);
  },
  deleteMessage(chatId, msgId) {
    db.messages[chatId] = db.messages[chatId].filter(x => x.id !== msgId);
    emitChat(chatId);
  },
  editMessage(chatId, msgId, text) {
    const m = db.messages[chatId].find(x => x.id === msgId);
    if (!m || m.unsent) return;
    m.text = text; m.edited = true;
    emitChat(chatId);
  },
  forward(msg, chatIds) {
    const keys = ['type', 'text', 'sticker', 'anim', 'src', 'w', 'h', 'duration', 'title', 'address', 'mediaId', 'thumb', 'name', 'size', 'mime'];
    chatIds.forEach(cid => {
      const payload = { forwarded: true };
      keys.forEach(k => { if (msg[k] !== undefined && msg[k] !== null) payload[k] = msg[k]; });
      if (msg.type === 'poll') { payload.type = 'text'; payload.text = '📊 ' + msg.poll.q; }
      if (msg.type === 'note') payload.type = 'text';
      if (msg.type === 'event') { payload.type = 'text'; payload.text = '📅 ' + msg.event.title; }
      api.send(cid, payload);
    });
  },
  setAnnouncement(chatId, m) {
    const c = db.chats[chatId];
    if (!m) { c.announcement = null; emitChat(chatId); return; }
    const text = m.type === 'text' ? m.text : m.type === 'poll' ? '📊 ' + m.poll.q : m.type === 'image' ? '📷 Foto' : m.type === 'location' ? '📍 ' + m.title : 'Pesan';
    c.announcement = { mid: m.id, text, from: m.from };
    db.messages[chatId].push(newMsg(chatId, ME, { type: 'system', text: 'Kamu menjadikan pesan sebagai pengumuman 📌' }));
    emitChat(chatId);
  },
  createPoll(chatId, q, options, multi = false) {
    const m = api.send(chatId, { type: 'poll', poll: { q, multi, options: options.map((t, i) => ({ id: 'o' + i, text: t, votes: [] })) } });
    const others = db.chats[chatId].members.filter(id => id !== ME && db.users[id] && !db.users[id].official);
    others.forEach(id => {
      if (Math.random() < 0.15) return;
      setTimeout(() => {
        const o = pick(m.poll.options);
        if (!o.votes.includes(id)) o.votes.push(id);
        emitChat(chatId);
      }, rand(2500, 12000));
    });
    return m;
  },
  vote(chatId, msgId, optId) {
    const m = db.messages[chatId].find(x => x.id === msgId);
    if (!m?.poll) return;
    const o = m.poll.options.find(x => x.id === optId);
    const had = o.votes.includes(ME);
    if (!m.poll.multi) m.poll.options.forEach(x => { x.votes = x.votes.filter(v => v !== ME); });
    else o.votes = o.votes.filter(v => v !== ME);
    if (!had) o.votes.push(ME);
    emitChat(chatId);
  },

  /* Aktivitas / notifikasi */
  activity() { return db.activity.filter(a => db.users[a.from]); },
  unreadActivity() { return db.activity.filter(a => !a.read && db.users[a.from]).length; },
  markActivityRead() { let ch = false; db.activity.forEach(a => { if (!a.read) { a.read = true; ch = true; } }); if (ch) { save(); bus.emit('activity'); } },
  clearActivity() { db.activity = []; save(); bus.emit('activity'); },
  simulateFriendRequest() {
    const r = api.recommended();
    if (r.length) addActivity('friend', pick(r).id);
  },

  /* Event */
  createEvent(chatId, { title, at, place }) {
    const m = api.send(chatId, { type: 'event', event: { title, at, place, going: [ME], notGoing: [] } });
    db.chats[chatId].members.filter(id => id !== ME && db.users[id] && !db.users[id].official).forEach(id => {
      if (Math.random() < 0.15) return;
      setTimeout(() => { (Math.random() < 0.75 ? m.event.going : m.event.notGoing).push(id); emitChat(chatId); }, rand(2500, 10000));
    });
    return m;
  },
  rsvp(chatId, msgId, yes) {
    const m = db.messages[chatId].find(x => x.id === msgId);
    if (!m?.event) return;
    const e = m.event;
    const wasYes = e.going.includes(ME), wasNo = e.notGoing.includes(ME);
    e.going = e.going.filter(x => x !== ME); e.notGoing = e.notGoing.filter(x => x !== ME);
    if (yes && !wasYes) e.going.push(ME);
    if (!yes && !wasNo) e.notGoing.push(ME);
    emitChat(chatId);
  },

  /* Pesan terjadwal */
  schedule(chatId, payload, at) { db.scheduled.push({ id: uid('sc'), chatId, payload, at }); save(); bus.emit('scheduled'); },
  scheduledIn(chatId) { return db.scheduled.filter(x => x.chatId === chatId).sort((a, b) => a.at - b.at); },
  cancelScheduled(id) { db.scheduled = db.scheduled.filter(x => x.id !== id); save(); bus.emit('scheduled'); },
  sendScheduledNow(id) { const x = db.scheduled.find(s => s.id === id); if (!x) return; api.cancelScheduled(id); api.send(x.chatId, x.payload); },

  /* Catatan grup */
  notes(chatId) { return (db.notes[chatId] || []).slice().sort((a, b) => b.ts - a.ts); },
  addNote(chatId, text) {
    (db.notes[chatId] ||= []).push({ id: uid('n'), from: ME, ts: Date.now(), text });
    db.messages[chatId].push(newMsg(chatId, ME, { type: 'system', text: '📝 Kamu menambah catatan' }));
    emitChat(chatId); bus.emit('notes', chatId);
  },
  updateNote(chatId, id, text) { const n = (db.notes[chatId] || []).find(x => x.id === id); if (n) { n.text = text; n.ts = Date.now(); save(); bus.emit('notes', chatId); } },
  deleteNote(chatId, id) { db.notes[chatId] = (db.notes[chatId] || []).filter(x => x.id !== id); save(); bus.emit('notes', chatId); },

  /* Sticker */
  packs() { return db.packs; },
  storePacks() { return STORE_PACKS; },
  ownsPack(id) { return db.packs.includes(id); },
  addPack(id) { if (!db.packs.includes(id)) db.packs.push(id); save(); bus.emit('packs'); },
  removePack(id) { db.packs = db.packs.filter(x => x !== id); save(); bus.emit('packs'); },

  /* Ulang tahun */
  birthdays() {
    const t = new Date(); t.setHours(0, 0, 0, 0);
    return api.friends().filter(u => u.birthday).map(u => {
      const [mm, dd] = u.birthday.split('-').map(Number);
      let d = new Date(t.getFullYear(), mm - 1, dd);
      if (d < t) d = new Date(t.getFullYear() + 1, mm - 1, dd);
      return { user: u, days: Math.round((d - t) / 864e5) };
    }).filter(x => x.days <= 14).sort((a, b) => a.days - b.days);
  },
  wished(userId) { const y = new Date().getFullYear(); return db.me.wished?.[userId] === y; },
  markWished(userId) { (db.me.wished ||= {})[userId] = new Date().getFullYear(); save(); bus.emit('friends'); },

  /* Keep */
  keep() { return db.keep.slice().sort((a, b) => b.ts - a.ts); },
  keepAdd(item) { db.keep.push({ id: uid('k'), ts: Date.now(), ...item }); save(); bus.emit('keep'); },
  keepRemove(id) { db.keep = db.keep.filter(k => k.id !== id); save(); bus.emit('keep'); },
  keepUpdate(id, text) { const k = db.keep.find(x => x.id === id); if (k) { k.text = text; k.ts = Date.now(); save(); bus.emit('keep'); } },

  togglePin(chatId) { const c = db.chats[chatId]; c.pinned = !c.pinned; save(); bus.emit('chats'); return c.pinned; },
  toggleMute(chatId) { const c = db.chats[chatId]; c.muted = !c.muted; save(); bus.emit('chats'); return c.muted; },
  clearChat(chatId) { db.messages[chatId] = []; emitChat(chatId); },
  deleteChat(chatId) { const c = db.chats[chatId]; db.messages[chatId] = []; c.hidden = true; c.unread = 0; c.pinned = false; emitChat(chatId); },
  images(chatId) {
    return (db.messages[chatId] || []).filter(m => m.type === 'image' && !m.unsent)
      .flatMap(m => (m.album?.length ? m.album : [m]).map((x, i) => ({ id: i ? m.id + '~' + i : m.id, mid: m.id, i, src: x.src, w: x.w, h: x.h, from: m.from, ts: m.ts }))).filter(x => x.src);
  },
  randomPlace() { return pick(PLACES); },

  /* VOOM / posts */
  posts() { return db.posts.filter(p => !db.blocked.includes(p.userId)).sort((a, b) => b.ts - a.ts); },
  feed(tab = 'foryou') {
    const list = api.posts();
    if (tab === 'following') return list.filter(p => p.userId === ME || db.friends.includes(p.userId));
    const now = Date.now();
    const score = p => (p.likes.length * 2 + p.comments.length * 3 + 4) / Math.pow((now - p.ts) / 3600e3 + 2, 1.3) + (p.userId === ME && now - p.ts < 600e3 ? 100 : 0);
    return list.slice().sort((a, b) => score(b) - score(a));
  },
  post(id) { return db.posts.find(p => p.id === id); },
  createPost({ text, image, images }) {
    images = images?.length ? images : image ? [image] : [];
    const p = { id: uid('p'), userId: ME, ts: Date.now(), text, image: images[0] || null, images, likes: [], comments: [] };
    db.posts.unshift(p);
    save(); bus.emit('posts');
    const likers = shuffle(db.friends).slice(0, 2 + Math.floor(Math.random() * 4));
    likers.forEach((id, i) => setTimeout(() => { if (!p.likes.includes(id)) { p.likes.push(id); addActivity('like', id, { postId: p.id }); } save(); bus.emit('posts'); }, 3000 + i * rand(1500, 4000)));
    setTimeout(() => {
      const cm = { id: uid('c'), userId: pick(db.friends), text: pick(['keren bgt!! 🔥', 'wkwk valid', 'ih lucu 🥹', 'mantap', 'spill dong']), ts: Date.now() };
      p.comments.push(cm);
      addActivity('comment', cm.userId, { postId: p.id }, cm.text);
      save(); bus.emit('posts');
    }, rand(6000, 10000));
    return p;
  },
  toggleCommentLike(pid, cid) {
    const c = api.post(pid)?.comments.find(x => x.id === cid);
    if (!c) return;
    c.likes ||= [];
    const i = c.likes.indexOf(ME);
    i >= 0 ? c.likes.splice(i, 1) : c.likes.push(ME);
    save(); bus.emit('posts');
    return i < 0;
  },
  sharePost(pid, chatIds) { chatIds.forEach(id => api.send(id, { type: 'post', postId: pid })); },
  deletePost(id) { db.posts = db.posts.filter(p => p.id !== id); save(); bus.emit('posts'); },
  toggleLike(id) {
    const p = api.post(id);
    const i = p.likes.indexOf(ME);
    i >= 0 ? p.likes.splice(i, 1) : p.likes.push(ME);
    save(); bus.emit('posts');
    return i < 0;
  },
  comment(id, text) {
    const p = api.post(id);
    const mine = { id: uid('c'), userId: ME, text, ts: Date.now(), likes: [] };
    p.comments.push(mine);
    save(); bus.emit('posts');
    if (p.userId !== ME && Math.random() < .8) setTimeout(() => { mine.likes ||= []; if (!mine.likes.includes(p.userId)) mine.likes.push(p.userId); save(); bus.emit('posts'); }, rand(1500, 3000));
    if (p.userId !== ME) {
      setTimeout(() => {
        const txt = pick(['makasih 🫶', 'wkwk iya', 'hehe 🥹', 'bener bgt']);
        p.comments.push({ id: uid('c'), userId: p.userId, text: txt, ts: Date.now() });
        addActivity('reply', p.userId, { postId: p.id }, txt);
        save(); bus.emit('posts');
      }, rand(3000, 6000));
    }
  },

  /* stories */
  stories() { return db.stories.filter(s => db.users[s.userId] && !db.blocked.includes(s.userId)).sort((a, b) => a.seen - b.seen); },
  storyOf(userId) { return userId === ME ? db.myStory : db.stories.find(s => s.userId === userId); },
  markStorySeen(userId) { const s = db.stories.find(x => x.userId === userId); if (s && !s.seen) { s.seen = true; save(); bus.emit('stories'); } },
  addMyStory(item) {
    db.myStory ||= { userId: ME, seen: true, items: [], views: 0 };
    const it = { id: uid('st'), ts: Date.now(), viewers: [], ...item };
    db.myStory.items.push(it);
    save(); bus.emit('stories');
    // simulasi: teman-teman lihat & kasih reaksi
    const who = db.friends.filter(id => db.users[id] && !db.users[id].official).sort(() => Math.random() - .5).slice(0, rand(3, 7));
    who.forEach((id, i) => setTimeout(() => {
      if (!db.myStory?.items.includes(it)) return;
      const react = Math.random() < .4 ? pick(['❤️', '🔥', '😂', '😍', '👏']) : null;
      it.viewers.push({ id, ts: Date.now(), react });
      db.myStory.views = new Set(db.myStory.items.flatMap(x => (x.viewers || []).map(v => v.id))).size;
      if (react) addActivity('like', id, { story: it.id }, 'story');
      save(); bus.emit('stories');
    }, 2500 + i * rand(1200, 3500)));
  },
  reactStory(userId, itemId, emoji) {
    const s = api.storyOf(userId), it = s?.items.find(x => x.id === itemId);
    if (!it) return;
    it.myReact = it.myReact === emoji ? null : emoji;
    save(); bus.emit('stories');
    return it.myReact;
  },
  deleteMyStory() { db.myStory = null; save(); bus.emit('stories'); },

  /* calls */
  calls() { return db.calls.slice().sort((a, b) => b.ts - a.ts); },
  logCall({ chatId, video, dir, status, duration }) {
    const c = db.chats[chatId];
    const call = { id: uid('cl'), chatId, userId: c.type === 'direct' ? c.members.find(m => m !== ME) : null, video, dir, status, duration, ts: Date.now() };
    db.calls.push(call);
    if (dir === 'in' && status === 'missed' && call.userId) addActivity('missed', call.userId, { chatId }, video ? 'video' : 'suara');
    const kind = video ? 'Video call' : 'Panggilan suara';
    const mm = String(Math.floor(duration / 60)).padStart(2, '0'), ss = String(duration % 60).padStart(2, '0');
    const text = status === 'done' ? `${video ? '🎥' : '📞'} ${kind} · ${mm}:${ss}`
      : status === 'missed' ? `📵 ${kind} tak terjawab`
      : status === 'declined' ? `📵 ${kind} ditolak` : `📵 ${kind} tidak dijawab`;
    db.messages[chatId].push(newMsg(chatId, ME, { type: 'system', text }));
    c.updatedAt = Date.now(); c.hidden = false;
    emitChat(chatId);
    bus.emit('calls');
  },
  clearCalls() { db.calls = []; save(); bus.emit('calls'); },

  /* demo helpers */
  simulateIncoming() {
    const groups = api.groups();
    if (groups.length && Math.random() < 0.3) {
      const g = pick(groups);
      const from = pick(g.members.filter(m => m !== ME && db.users[m]));
      if (from) return receive(g.id, from, { text: Math.random() < 0.35 ? `@${firstName(db.me.name)} ${pick(['kamu ikut ga?', 'gimana menurutmu?', 'cek ini dong 👀'])}` : pick(GROUP_INCOMING) });
    }
    const id = pick(api.friends()).id;
    const c = api.directWith(id);
    setTyping(c.id, id, true);
    setTimeout(() => { setTyping(c.id, id, false); receive(c.id, id, { text: pick(INCOMING) }); }, 1500);
  },
  simulateIncomingCall(video = false, group = false) {
    const gs = api.groups();
    if (group && gs.length) return bus.emit('incoming-call', { chatId: pick(gs).id, video });
    const id = pick(api.friends()).id;
    const c = api.directWith(id);
    bus.emit('incoming-call', { chatId: c.id, video });
  },
};

export const allUsers = USERS;

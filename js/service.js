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
/* IndexedDB = gudang utama (muat besar), localStorage = salinan cepat kalau masih muat (~5 MB) */
const IDB = (() => {
  let p = null;
  const open = () => p ||= new Promise((res, rej) => {
    if (!window.indexedDB) return rej(new Error('no idb'));
    const r = indexedDB.open('onix-store', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  const run = (mode, fn) => open().then(d => new Promise((res, rej) => {
    const t = d.transaction('kv', mode), q = fn(t.objectStore('kv'));
    t.oncomplete = () => res(q.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
  }));
  return { get: k => run('readonly', s => s.get(k)), set: (k, v) => run('readwrite', s => s.put(v, k)), del: k => run('readwrite', s => s.delete(k)) };
})();
let idbOk = false;
function flush() {
  if (!db) return;
  db.savedAt = Date.now();
  const s = JSON.stringify(db);
  if (idbOk) IDB.set(KEY, s).catch(() => bus.emit('storage-full'));
  try { localStorage.setItem(KEY, s); }
  catch {
    try { localStorage.removeItem(KEY); } catch { /* */ } // kegedean: biar IndexedDB aja
    if (!idbOk) bus.emit('storage-full');
  }
}
window.addEventListener('pagehide', flush);
document.addEventListener('visibilitychange', () => document.hidden && flush());

{
  let lsRaw = null, idbRaw = null;
  try { lsRaw = localStorage.getItem(KEY); } catch { /* */ }
  try { idbRaw = await Promise.race([IDB.get(KEY), new Promise((_, rej) => setTimeout(() => rej(new Error('lama')), 2500))]); idbOk = true; } catch { /* nggak ada IndexedDB */ }
  let wiped = 0;
  try { wiped = +(localStorage.getItem(KEY + ':wiped') || 0); } catch { /* */ }
  const parse = r => { try { const x = r ? JSON.parse(r) : null; return x && x.v === 1 && x.me && (x.savedAt || 0) >= wiped ? x : null; } catch { return null; } };
  const a = parse(lsRaw), b = parse(idbRaw);
  // pakai salinan yang paling baru
  const d = b && (!a || (b.savedAt || 0) > (a.savedAt || 0)) ? b : a;
  if (d) try {
    db = migrate(d);
    Object.entries(db.messages).forEach(([cid, list]) => list.forEach(m => { if (m.status === 'sending' || m.status === 'hold') m.status = db.chats[cid]?.remote && !m.rid ? 'queued' : 'sent'; }));
  } catch { /* data rusak -> mulai baru */ }
}

/* ---------- migrasi data lama -> fitur baru ---------- */
function migrate(d) {
  d.keep ||= [];
  d.notes ||= {};
  d.scheduled ||= [];
  d.packs ||= DEFAULT_PACKS.slice();
  d.wallet ||= { balance: 250000, tx: [{ id: 'tx0', type: 'topup', amount: 250000, ts: Date.now() - 2 * 864e5 }] };
  if (!d.moods) {
    const t = Date.now();
    const seed = [['☕', 'butuh kopi'], ['🎧', 'lagi denger NIKI'], ['📚', 'deadline mode'], ['🏃‍♀️', 'otw gym'], ['😴', 'ngantuk parah']];
    d.moods = {};
    (d.friends || []).filter(id => d.users[id] && !d.users[id].official).slice(0, 5).forEach((id, i) => { d.moods[id] = { emoji: seed[i][0], text: seed[i][1], ts: t - (i * 3 + 1) * 3600e3 }; });
  }
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
  if (msg.type === 'nudge') return Math.random() < 0.4 ? { type: 'nudge' } : { text: pick(['apaa 😆', 'iyaa kenapaa', 'hadir 🙋', 'jangan colek colek ih']) };
  if (msg.type === 'challenge') return { text: pick(['gas bentar aku foto 📸', 'wkwk oke tunggu', 'susah amat tantangannya 😭']) };
  if (msg.type === 'fortune') return { text: pick(['wih hoki bgt', 'punyaku jelek masa 😭', 'percaya ga percaya wkwk 🔮']) };
  if (msg.type === 'spin') return { text: pick(['yaudah fix ' + (msg.opts?.[msg.pick] || '') + ' 🤝', 'takdir berkata lain wkwk', 'oke deal!', 'puter ulang dong 😭']) };
  if (msg.type === 'checkin') return { type: 'checkans', ref: msg.id, v: 1 + Math.floor(Math.random() * 4) };
  if (msg.type === 'quiz') { const n = msg.quiz?.qs?.length || 0; return { type: 'quizres', ref: msg.id, total: n, score: Math.floor(Math.random() * (n + 1)) }; }
  if (msg.type === 'countdown') return { text: pick(['gak sabar!! 🤩', 'yeay dikit lagi', 'catet 📌']) };
  if (msg.type === 'doodle') return { text: pick(['wkwk gambar apaan itu 😭', 'bagus bgt 🎨', 'seniman nih', 'aku bales pake gambar ya nanti']) };
  if (msg.type === 'capsule') return { text: pick(['penasaran bgt isinya 😭', 'kapsul apaan tuh 👀', 'oke aku tunggu ya ⏳']) };
  if (msg.type === 'scratch') return { text: pick(['wkwk apaan nih', 'udah aku gosok 🫣', 'HAH 😳']) };
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
  if (msg.type === 'pay') return { text: msg.kind === 'send' ? pick(['makasih banyak!! 🥹', 'wih udah masuk, thx 💸', 'aaa makasih 🫶']) : pick(['oke bentar ya', 'siap', 'otw bayar']) };
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

const holds = new Map();
function receive(chatId, from, payload) {
  const c = db.chats[chatId];
  if (!c || db.blocked.includes(from)) return;
  const m = newMsg(chatId, from, payload);
  db.messages[chatId].push(m);
  c.updatedAt = m.ts;
  c.hidden = false;
  if (db.users[from] && !db.users[from].remote) { db.users[from].online = true; db.users[from].lastSeen = Date.now(); }
  const mentionsMe = c.type === 'group' && mentionRe(db.me.name).test(m.text || '');
  const f = api.focus();
  if (f && c.type === 'direct' && !m.auto && m.type !== 'system' && !f.replied.includes(chatId)) {
    f.replied.push(chatId);
    const jam = new Date(f.until).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    setTimeout(() => api.send(chatId, { type: 'text', text: `🎧 Lagi fokus${f.note ? ' (' + f.note + ')' : ''} sampai ${jam}. Nanti aku bales ya!`, auto: true }), 900);
  }
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

function addTx(t) {
  db.wallet.tx.unshift({ id: uid('tx'), ts: Date.now(), ...t });
  db.wallet.tx = db.wallet.tx.slice(0, 200);
  save(); bus.emit('wallet');
}
export const rupiah = n => 'Rp' + Math.round(n || 0).toLocaleString('id-ID');

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

/* ---------- jembatan ke server (PocketBase) ---------- */
let remoteSend = null;
const hooks = {}; // diisi backend.js: read, typing, update, rename, addMembers, leave
const SKIP_KEYS = ['acts', 'capOpened', 'scratched', 'id', 'chatId', 'from', 'ts', 'status', 'reactions', 'readBy', 'rid', 'expires', 'type', 'text', 'unsent', 'edited', 'mediaId', 'fileUrl', 'credited'];
// ganti id 'me' <-> id server di field yang menyimpan id orang
function mapPayloadIds(p, fn) {
  const arr = a => (Array.isArray(a) ? a.map(fn) : a);
  if (p.to) p.to = fn(p.to);
  if (p.opp) p.opp = fn(p.opp);
  if (p.members) p.members = arr(p.members);
  if (p.paid) p.paid = arr(p.paid);
  if (p.picks) { const o = {}; for (const [k, v] of Object.entries(p.picks)) o[fn(k)] = v; p.picks = o; }
  if (p.poll?.options) p.poll = { ...p.poll, options: p.poll.options.map(o => ({ ...o, votes: arr(o.votes || []) })) };
  if (p.event) p.event = { ...p.event, going: arr(p.event.going || []), notGoing: arr(p.event.notGoing || []) };
  return p;
}
const mapReacts = (r, fn) => { const o = {}; for (const [k, v] of Object.entries(r || {})) { const a = (v || []).map(fn).filter(Boolean); if (a.length) o[k] = a; } return o; };
const remote = {
  hooks,
  reactionsOut(m) { return mapReacts(m.reactions, id => (id === ME ? db.remote?.uid : id)); },
  applyUpdate(rec) {
    const list = db.messages[rec.chat];
    const m = list?.find(x => x.rid === rec.id || x.id === rec.cid);
    if (!m) return;
    if (rec.unsent) Object.assign(m, { unsent: true, text: '', src: null, sticker: null, img: null, album: null, replyTo: null });
    else if (rec.edited && rec.text !== m.text) Object.assign(m, { text: rec.text, edited: true });
    m.reactions = mapReacts(rec.reactions, remote.mapId);
    emitChat(rec.chat);
  },
  applyAction(rec) {
    const list = db.messages[rec.chat];
    const m = list?.find(x => x.rid === rec.msg);
    if (!m) return false;
    const uid = remote.mapId(rec.user), v = rec.value;
    if (rec.kind === 'vote' && m.poll) {
      const chosen = Array.isArray(v) ? v : [];
      m.poll.options.forEach(o => { o.votes = (o.votes || []).filter(x => x !== uid); if (chosen.includes(o.id)) o.votes.push(uid); });
    } else if (rec.kind === 'rsvp' && m.event) {
      const e = m.event;
      e.going = e.going.filter(x => x !== uid); e.notGoing = e.notGoing.filter(x => x !== uid);
      if (v === 1) e.going.push(uid); else if (v === 0) e.notGoing.push(uid);
    } else if (rec.kind === 'pay' && m.type === 'pay') {
      m.paid ||= [];
      if (v && !m.paid.includes(uid)) {
        m.paid.push(uid);
        if (m.from === ME && uid !== ME) { db.wallet.balance += m.per || 0; addTx({ type: 'in', amount: m.per || 0, userId: uid, chatId: rec.chat, note: m.note }); }
      }
    } else if (rec.kind === 'fun') {
      (m.acts ||= {})[uid] = v;
    } else if (rec.kind === 'suit' && m.game === 'suit') {
      m.picks ||= {};
      if (!m.opp || m.opp === uid) { m.picks[uid] = v; m.opp = uid; }
    } else return false;
    emitChat(rec.chat);
    return true;
  },
  // state chat milikku dari HP lain (pin, bisu, arsip, hapus, sudah dibaca)
  applyOwnState(r) {
    const c = db.chats[r.chat];
    if (!c) return;
    c.pinned = !!r.pinned; c.muted = !!r.muted; c.archived = !!r.archived;
    if (r.clearedAt && r.clearedAt > (c.clearedAt || 0)) {
      c.clearedAt = r.clearedAt;
      db.messages[r.chat] = (db.messages[r.chat] || []).filter(m => m.ts > r.clearedAt);
      if (!db.messages[r.chat].length) c.hidden = true;
    }
    if (r.readAt && r.readAt > (c.readAt || 0)) c.readAt = r.readAt;
    if (activeChat !== r.chat) {
      const n = (db.messages[r.chat] || []).filter(m => m.from !== ME && m.type !== 'system' && m.ts > (c.readAt || 0)).length;
      if (n !== (c.unread || 0)) { c.unread = n; if (!n) c.mention = false; }
    }
    emitChat(r.chat);
  },
  applyRead(chatId, uid, readAt) {
    const list = db.messages[chatId];
    if (!list || uid === db.remote?.uid) return;
    let ch = false;
    for (const m of list) if (m.from === ME && m.ts <= readAt && !(m.readBy ||= []).includes(uid)) { m.readBy.push(uid); ch = true; }
    if (ch) emitChat(chatId);
  },
  typing(chatId, uid, on) { if (db.chats[chatId] && uid !== db.remote?.uid) setTyping(chatId, uid, on); },
  presence(r) {
    const u = db.users[r.id];
    if (!u) return;
    if (!api.seenVisible(r.id)) { u.online = false; bus.emit('presence'); return; }
    u.lastSeen = Math.max(u.lastSeen || 0, r.lastActive || 0);
    u.online = !!r.online && Date.now() - (r.lastActive || 0) < 120e3;
    bus.emit('presence');
  },
  staleCheck() {
    let ch = false;
    for (const u of Object.values(db.users)) if (u.remote && u.online && Date.now() - (u.lastSeen || 0) > 120e3) { u.online = false; ch = true; }
    if (ch) bus.emit('presence');
  },
  setSender(fn) { remoteSend = fn; },
  state() { return db?.remote || null; },
  setState(s) { db.remote = s; save(); bus.emit('remote'); },
  // story teman dari server: list = [{rid, user, ts, text, bg, font, image}]
  storiesIn(list, mine) {
    const old = new Map(db.stories.filter(s => s.remote).flatMap(s => s.items.map(i => [i.rid, i])));
    db.stories = db.stories.filter(s => !s.remote);
    const by = {};
    for (const r of list) {
      if (r.user === db.remote?.uid || !db.users[r.user]) continue;
      const prev = old.get(r.rid);
      (by[r.user] ||= []).push({ id: r.rid, rid: r.rid, ts: r.ts, text: r.text, bg: r.bg, font: r.font, image: r.image, viewed: prev?.viewed, myReact: prev?.myReact });
    }
    for (const [userId, items] of Object.entries(by)) db.stories.push({ userId, remote: true, seen: items.every(i => i.viewed), items: items.sort((a, b) => a.ts - b.ts) });
    // story sendiri yang belum ada di HP ini (login di HP baru)
    if (mine?.length) {
      db.myStory ||= { userId: ME, seen: true, items: [], views: 0 };
      for (const r of mine) if (!db.myStory.items.some(i => i.rid === r.rid)) db.myStory.items.push({ id: r.rid, rid: r.rid, ts: r.ts, text: r.text, bg: r.bg, font: r.font, image: r.image, viewers: [] });
      db.myStory.items.sort((a, b) => a.ts - b.ts);
    }
    save(); bus.emit('stories');
  },
  // post VOOM dari server: [{rid, user, ts, text, images, likes:[uid], comments:[{rid,cid,user,text,ts}]}]
  postsIn(list, first) {
    const old = new Map(db.posts.filter(p => p.remote).map(p => [p.rid || p.id, p]));
    const pending = db.posts.filter(p => p.remote && !p.rid); // lagi diupload
    db.posts = db.posts.filter(p => !p.remote);
    for (const r of list) {
      const userId = remote.mapId(r.user);
      const prev = old.get(r.rid);
      const likes = r.likes.map(remote.mapId);
      const comments = r.comments.map(c => ({ id: c.cid || c.rid, rid: c.rid, userId: remote.mapId(c.user), text: c.text, ts: c.ts, likes: [] }));
      if (!first && userId === ME && prev) {
        likes.filter(id => id !== ME && !prev.likes.includes(id)).forEach(id => addActivity('like', id, { postId: r.rid }));
        comments.filter(c => c.userId !== ME && !prev.comments.some(x => x.rid === c.rid || x.id === c.id)).forEach(c => addActivity('comment', c.userId, { postId: r.rid }, c.text));
      }
      // komentar lokal yang belum sampai server jangan hilang
      (prev?.comments || []).filter(c => !c.rid && c.userId === ME && !comments.some(x => x.id === c.id)).forEach(c => comments.push(c));
      db.posts.push({ id: r.rid, rid: r.rid, remote: true, userId, ts: r.ts, text: r.text, images: r.images, image: r.images[0] || null, likes, comments: comments.sort((a, b) => a.ts - b.ts) });
    }
    db.posts.push(...pending.filter(p => !list.some(r => r.cid === p.id)));
    db.posts.sort((a, b) => b.ts - a.ts);
    save(); bus.emit('posts');
  },
  chatGone(ids) { let ch = false; for (const c of Object.values(db.chats)) if (c.remote && !c.left && !ids.includes(c.id)) { c.left = true; ch = true; } if (ch) { save(); bus.emit('chats'); } },
  isAdmin(chatId, uid = ME) { const c = db.chats[chatId]; return !!c && (c.type === 'direct' || !c.owner || c.owner === uid || (c.admins || []).includes(uid)); },
  setHasMore(chatId, v) { const c = db.chats[chatId]; if (c && c.hasMore !== v) { c.hasMore = v; save(); } },
  postSaved(localId, rid) { const p = db.posts.find(x => x.id === localId); if (p) { p.rid = rid; p.id = rid; save(); bus.emit('posts'); } },
  storySaved(itemId, rid) { const it = db.myStory?.items.find(i => i.id === itemId); if (it) { it.rid = rid; save(); } },
  storyViewers(views) { // views: [{story, user, ts, react}]
    if (!db.myStory) return;
    for (const it of db.myStory.items) {
      if (!it.rid) continue;
      const vs = views.filter(v => v.story === it.rid && v.user !== db.remote?.uid);
      const local = (it.viewers || []).filter(v => !db.users[v.id]?.remote);
      it.viewers = [...local, ...vs.map(v => ({ id: v.user, ts: v.ts, react: v.react || null }))];
    }
    db.myStory.views = new Set(db.myStory.items.flatMap(x => (x.viewers || []).map(v => v.id))).size;
    save(); bus.emit('stories');
  },
  applyMe(r, avatarUrl) {
    Object.assign(db.me, { name: r.name || db.me.name, status: r.status ?? db.me.status, hue: r.hue ?? db.me.hue, ...(avatarUrl ? { avatar: avatarUrl } : {}) });
    if (r.mood?.ts) (db.moods ||= {})[ME] = r.mood;
    for (const b of r.blocked || []) if (!db.blocked.includes(b)) db.blocked.push(b);
    if (r.privacy && typeof r.privacy === 'object') db.privacy = { seen: r.privacy.seen !== false, read: r.privacy.read !== false };
    save(); bus.emit('me'); bus.emit('moods'); bus.emit('chats');
  },
  mapId(pid) { return pid === db.remote?.uid ? ME : pid; },
  payloadOf(m) {
    const p = {};
    for (const k in m) if (!SKIP_KEYS.includes(k) && m[k] !== undefined) p[k] = m[k];
    if (p.replyTo?.name === 'Kamu') p.replyTo = { ...p.replyTo, name: db.me.name };
    return mapPayloadIds(JSON.parse(JSON.stringify(p)), id => (id === ME ? db.remote?.uid : id));
  },
  user(r, avatarUrl) {
    if (!r || r.id === db.remote?.uid) return;
    const u = db.users[r.id] ||= { id: r.id, online: false, lastSeen: 0 };
    Object.assign(u, { name: r.name || r.handle, handle: r.handle, hue: r.hue ?? 260, status: r.status || '', avatar: avatarUrl || null, remote: true,
      hideSeen: r.privacy?.seen === false, hideRead: r.privacy?.read === false });
    db.moods ||= {};
    const had = JSON.stringify(db.moods[r.id] || null);
    if (r.mood?.ts) db.moods[r.id] = r.mood; else delete db.moods[r.id];
    if (had !== JSON.stringify(db.moods[r.id] || null)) bus.emit('moods');
  },
  chat(r) {
    const t = Date.parse(r.created) || Date.now();
    const c = db.chats[r.id] ||= { id: r.id, pinned: false, muted: false, unread: 0, draft: '', createdAt: t, updatedAt: t };
    Object.assign(c, { type: r.type, members: (r.members || []).map(remote.mapId), name: r.name || '', hue: r.hue ?? c.hue, emoji: r.emoji || c.emoji, remote: true, left: false,
      owner: r.owner ? remote.mapId(r.owner) : null, admins: (r.admins || []).map(remote.mapId), invite: r.invite || '' });
    db.messages[r.id] ||= [];
    return c;
  },
  message(rec, live) {
    const chatId = rec.chat, c = db.chats[chatId];
    if (!c) return;
    const list = db.messages[chatId];
    const cid = rec.cid || rec.id;
    if (c.clearedAt && (Date.parse(rec.created) || 0) <= c.clearedAt) return;
    const ex = list.find(m => m.id === cid || m.rid === rec.id);
    if (ex) { if (ex.status !== 'sent') { ex.status = 'sent'; ex.rid = rec.id; if (live) emitChat(chatId); } return; }
    const from = remote.mapId(rec.sender);
    if (from !== ME && db.blocked.includes(from)) return;
    const payload = { ...mapPayloadIds(JSON.parse(JSON.stringify(rec.data || {})), remote.mapId), type: rec.type || 'text', id: cid, rid: rec.id, ts: Date.parse(rec.created) || Date.now() };
    if (rec._fileUrl) payload.fileUrl = rec._fileUrl;
    if (rec.text) payload.text = rec.text;
    if (rec.unsent) Object.assign(payload, { unsent: true, text: '' });
    if (rec.edited) payload.edited = true;
    if (rec.reactions) payload.reactions = mapReacts(rec.reactions, remote.mapId);
    if (payload.type === 'system' && payload.text?.startsWith(db.me.name + ' ')) payload.text = 'Kamu ' + payload.text.slice(db.me.name.length + 1);
    if (payload.replyTo && payload.replyTo.name === db.me.name) payload.replyTo = { ...payload.replyTo, name: 'Kamu' };
    if (db.users[from]) db.users[from].lastSeen = Math.max(db.users[from].lastSeen || 0, payload.ts);
    if (payload.type === 'pay' && payload.kind === 'send' && payload.to === ME && from !== ME) {
      payload.credited = true;
      db.wallet.balance += payload.amount || 0;
      addTx({ type: 'in', amount: payload.amount || 0, userId: from, chatId, note: payload.note });
    }
    if (live && from !== ME) { receive(chatId, from, payload); return; }
    const m = newMsg(chatId, from, { ...payload, status: 'sent' });
    delete m.expires;
    list.push(m);
    if (from !== ME && m.ts > (c.readAt || 0) && activeChat !== chatId) c.unread = (c.unread || 0) + 1;
    c.updatedAt = Math.max(c.updatedAt || 0, m.ts);
    if (live) emitChat(chatId);
  },
  done() {
    for (const c of Object.values(db.chats)) if (c.remote) db.messages[c.id].sort((a, b) => a.ts - b.ts);
    save(); bus.emit('chats'); bus.emit('friends');
    for (const c of Object.values(db.chats)) if (c.remote) bus.emit('messages', c.id);
  },
  sent(chatId, cid, rid) { const m = db.messages[chatId]?.find(x => x.id === cid); if (m) { m.status = 'sent'; m.rid = rid; emitChat(chatId); } },
  failed(chatId, cid) { const m = db.messages[chatId]?.find(x => x.id === cid); if (m) { m.status = 'failed'; emitChat(chatId); } },
  retry(chatId, cid) { const m = db.messages[chatId]?.find(x => x.id === cid); if (m && remoteSend) { m.status = 'sending'; emitChat(chatId); return remoteSend(chatId, m, true); } },
  queued(chatId, cid) { const m = db.messages[chatId]?.find(x => x.id === cid); if (m) { m.status = 'queued'; save(); emitChat(chatId); } },
  outbox() {
    const out = [];
    for (const c of Object.values(db.chats)) if (c.remote && !c.left) for (const m of db.messages[c.id] || []) if (m.status === 'queued' && m.from === ME) out.push({ chatId: c.id, m });
    return out.sort((a, b) => a.m.ts - b.m.ts);
  },
  directChatWith(uid) { return Object.values(db.chats).find(c => c.remote && c.type === 'direct' && c.members.includes(uid))?.id || null; },
  purge() {
    for (const c of Object.values(db.chats)) if (c.remote) { delete db.chats[c.id]; delete db.messages[c.id]; }
    for (const u of Object.values(db.users)) if (u.remote) delete db.users[u.id];
    db.remote = null; remoteSend = null;
    save(); bus.emit('chats'); bus.emit('friends'); bus.emit('remote');
  },
};

/* ================================================================ */
export const api = {
  remote,
  get ready() { return !!db?.me; },

  // clean: akun beneran (online) -> tanpa teman/chat contoh, cuma Onix Team
  register({ name, id, phone = null, avatar = null, hue, clean = false }) {
    db = migrate(buildSeed({ name, id, hue: hue ?? Math.floor(Math.random() * 360) }));
    Object.assign(db.me, { phone, avatar });
    if (clean) {
      const keep = Object.keys(db.chats).filter(cid => db.chats[cid].members.some(m => db.users[m]?.official));
      db.chats = Object.fromEntries(keep.map(k => [k, db.chats[k]]));
      db.messages = Object.fromEntries(keep.map(k => [k, db.messages[k] || []]));
      const now = Date.now();
      for (const c of Object.values(db.chats)) {
        c.unread = 1; c.pinned = false; c.updatedAt = now;
        const bot = c.members.find(m => db.users[m]?.official);
        db.messages[c.id] = [newMsg(c.id, bot, { text: `Haii ${firstName(name)}! 👋 Selamat datang di Onix.\n\nCari teman: tab Chat → tombol ✏️ → ketik ID mereka.\nID kamu: @${id} — bagikan ke teman biar bisa langsung chat ✨`, ts: now })];
      }
      Object.assign(db, { friends: [], favorites: [], posts: [], stories: [], calls: [], moods: {}, activity: [], myStory: null });
      db.settings.simulate = false;
    }
    flush();
  },
  idTaken(id) { return USERS.some(u => u.id === String(id).toLowerCase()); },
  reset() {
    db = null;
    try { localStorage.removeItem(KEY); localStorage.setItem(KEY + ':wiped', String(Date.now())); } catch { /* */ }
    IDB.del(KEY).catch(() => {});
  },
  storageMode() { return idbOk ? 'IndexedDB' : 'localStorage'; },
  exportData() { return JSON.parse(JSON.stringify(db)); },
  importData(data) {
    if (!data || !data.me || !data.chats || !data.messages) throw new Error('bad');
    data.savedAt = Date.now() + 1;
    const s = JSON.stringify(data);
    try { localStorage.setItem(KEY, s); } catch { try { localStorage.removeItem(KEY); } catch { /* */ } }
    db = null; // cegah flush data lama saat reload
    return idbOk ? IDB.set(KEY, s) : Promise.resolve();
  },

  me() { return { ...db.me, id: db.me.id }; },
  updateMe(patch) { Object.assign(db.me, patch); save(); bus.emit('me'); bus.emit('chats'); if (db.remote) hooks.profile?.(patch); },
  settings() { return db ? db.settings : { theme: 'system', accent: 'violet' }; },
  setSetting(k, v) { db.settings[k] = v; save(); bus.emit('settings'); },

  /* users & friends */
  user(id) {
    if (id === ME) return { ...db.me, uid: ME };
    return db.users[id];
  },
  friends() {
    const remoteIds = Object.values(db.users).filter(u => u.remote).map(u => u.id);
    return [...db.friends, ...remoteIds].filter(id => !db.blocked.includes(id)).map(id => db.users[id]).filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));
  },
  isFriend(id) { return db.friends.includes(id) || !!db.users[id]?.remote; },
  isFav(id) { return db.favorites.includes(id); },
  isBlocked(id) { return db.blocked.includes(id); },
  /* privasi (akun online). true = ditampilkan. Timbal balik: kalau kamu sembunyiin, kamu juga nggak lihat punya orang */
  privacy() { return { seen: db.privacy?.seen !== false, read: db.privacy?.read !== false }; },
  setPrivacy(patch) {
    db.privacy = { ...api.privacy(), ...patch };
    if (db.privacy.seen === false) for (const u of Object.values(db.users)) if (u.remote) u.online = false;
    save(); bus.emit('presence'); bus.emit('remote');
    for (const id of Object.keys(db.messages)) if (db.chats[id]?.remote) bus.emit('messages', id);
    hooks.privacy?.(db.privacy);
  },
  seenVisible(id) { const u = db.users[id]; return !u?.remote || (api.privacy().seen && !u.hideSeen); },
  readVisible(id) { const u = db.users[id]; return !u?.remote || (api.privacy().read && !u.hideRead); },
  favorites() { return db.favorites.map(id => db.users[id]).filter(u => u && !db.blocked.includes(u.id)); },
  toggleFav(id) {
    const i = db.favorites.indexOf(id);
    i >= 0 ? db.favorites.splice(i, 1) : db.favorites.push(id);
    save(); bus.emit('friends');
  },
  /* Onix Pay (dummy) */
  wallet() { return db.wallet; },
  topUp(amount) { db.wallet.balance += amount; addTx({ type: 'topup', amount }); },
  paySend(chatId, amount, note = '') {
    if (amount > db.wallet.balance) return null;
    const c = db.chats[chatId];
    const to = c.type === 'direct' ? c.members.find(id => id !== ME) : null;
    db.wallet.balance -= amount;
    addTx({ type: 'out', amount, userId: to, chatId, note });
    const m = api.send(chatId, { type: 'pay', kind: 'send', amount, note, to });
    return m;
  },
  payRequest(chatId, amount, note = '') {
    const c = db.chats[chatId];
    const others = c.members.filter(id => id !== ME && db.users[id] && !db.users[id].official);
    const split = c.type === 'group';
    const per = split ? Math.ceil(amount / (others.length + 1) / 100) * 100 : amount;
    const m = api.send(chatId, { type: 'pay', kind: split ? 'split' : 'request', amount, per, note, from: ME, members: others, paid: [] });
    if (!c.remote) others.forEach((id, i) => {
      if (split && Math.random() < .25) return; // ada yang belum bayar
      setTimeout(() => {
        if (m.paid.includes(id)) return;
        m.paid.push(id);
        db.wallet.balance += per;
        addTx({ type: 'in', amount: per, userId: id, chatId, note });
        emitChat(chatId);
        if (i === 0) setTimeout(() => receive(chatId, id, { text: pick(['udah aku tf ya 💸', 'lunas! 🙏', 'done bayar', 'sip udah']) }), 900);
      }, 3500 + i * rand(2000, 4500));
    });
    return m;
  },
  payIncoming(chatId, mid) {
    const m = db.messages[chatId]?.find(x => x.id === mid);
    if (!m || !['request', 'split'].includes(m.kind) || m.from === ME || m.paid.includes(ME)) return false;
    if (m.kind === 'split' && !m.members?.includes(ME)) return false;
    if (m.per > db.wallet.balance) return null;
    db.wallet.balance -= m.per;
    m.paid.push(ME);
    addTx({ type: 'out', amount: m.per, userId: m.from, chatId, note: m.note });
    emitChat(chatId);
    if (db.chats[chatId].remote && m.rid) hooks.action?.(chatId, m, 'pay', true);
    return true;
  },
  simulatePayRequest() {
    const id = pick(db.friends.filter(f => !db.users[f]?.official));
    const c = api.directWith(id);
    const amount = pick([15000, 25000, 35000, 50000]);
    receive(c.id, id, { type: 'pay', kind: 'request', amount, per: amount, note: pick(['patungan kopi ☕', 'bayar ojol tadi', 'tiket nonton 🎬', 'pizza kemarin 🍕']), from: id, members: [ME], paid: [] });
  },

  /* status mood (24 jam) */
  moods() {
    const now = Date.now(), out = [];
    for (const [id, m] of Object.entries(db.moods || {})) {
      if (now - m.ts > 864e5 || (m.focus && m.focus < now)) continue;
      if (id !== ME && ((!db.friends.includes(id) && !db.users[id]?.remote) || db.blocked.includes(id))) continue;
      out.push({ userId: id, ...m });
    }
    return out.sort((a, b) => b.ts - a.ts);
  },
  moodOf(id) { const m = db.moods?.[id]; return m && Date.now() - m.ts < 864e5 && !(m.focus && m.focus < Date.now()) ? m : null; },
  /* mode fokus: notif diem, chat personal dibales otomatis sekali, teman lihat 🎧 */
  focus() { const f = db.focus; return f && f.until > Date.now() ? f : null; },
  setFocus(until, note) {
    if (!until) {
      const prev = db.focus?.prev || null;
      db.focus = null; save();
      api.setMood(prev && Date.now() - prev.ts < 864e5 ? prev : null);
    } else {
      const cur = db.moods?.[ME];
      db.focus = { until, note: note || '', prev: db.focus?.prev ?? (cur && !cur.focus ? cur : null), replied: [] };
      save();
      api.setMood({ emoji: '🎧', text: note || 'Lagi fokus', focus: until });
    }
    bus.emit('focus');
  },
  endFocusIfDone() { if (db.focus && db.focus.until <= Date.now()) api.setFocus(0); },
  setMood(m) {
    db.moods ||= {};
    if (m) db.moods[ME] = { emoji: m.emoji, text: m.text || '', ts: Date.now(), ...(m.focus ? { focus: m.focus } : {}) }; else delete db.moods[ME];
    save(); bus.emit('moods');
    if (db.remote) hooks.profile?.({ mood: db.moods[ME] || null });
    if (m && !m.focus) {
      const fans = shuffle(db.friends.filter(id => !db.users[id]?.official)).slice(0, 2);
      fans.forEach((id, i) => setTimeout(() => { if (db.moods[ME]) addActivity('mood', id, { userId: ME }, `${m.emoji} ${m.text || ''}`.trim()); }, 6000 + i * 5000));
    }
  },
  replyMood(userId, text) {
    const m = api.moodOf(userId), c = api.directWith(userId);
    api.send(c.id, { type: 'text', text, replyTo: { id: 'mood', name: 'Mood ' + firstName(db.users[userId]?.name || ''), text: `${m?.emoji || ''} ${m?.text || ''}`.trim() } });
    return c.id;
  },
  searchUsers(q) {
    q = q.trim().toLowerCase().replace(/^@/, '');
    if (!q) return [];
    return Object.values(db.users).filter(u => !u.official && (u.id.includes(q) || u.name.toLowerCase().includes(q)));
  },
  findPeople(q) { q = q.toLowerCase(); return Object.values(db.users).filter(u => u.id !== ME && !db.blocked.includes(u.id) && (u.name.toLowerCase().includes(q) || (u.id || '').toLowerCase().includes(q))).sort((a, b) => db.friends.includes(b.id) - db.friends.includes(a.id)); },
  recommended() { return Object.values(db.users).filter(u => !u.official && !db.friends.includes(u.id) && !db.blocked.includes(u.id)); },
  addFriend(id) {
    if (!db.friends.includes(id) && !db.users[id]?.remote) db.friends.push(id);
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
    save(); bus.emit('friends'); bus.emit('chats'); bus.emit('stories'); bus.emit('posts'); bus.emit('moods');
    if (db.users[id]?.remote) hooks.blocked?.(db.blocked.filter(x => db.users[x]?.remote));
  },
  unblock(id) {
    db.blocked = db.blocked.filter(x => x !== id); save(); bus.emit('friends'); bus.emit('chats'); bus.emit('stories'); bus.emit('posts');
    if (db.users[id]?.remote) hooks.blocked?.(db.blocked.filter(x => db.users[x]?.remote));
  },
  report(id, reason) { if (db.users[id]?.remote) hooks.report?.(id, reason); },

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
  toggleArchive(chatId) { const c = db.chats[chatId]; c.archived = !c.archived; if (c.archived) c.pinned = false; save(); bus.emit('chats'); if (c.remote) hooks.prefs?.(chatId, { archived: !!c.archived, pinned: !!c.pinned }); return c.archived; },
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
    if (c.remote) { emitChat(chatId); hooks.rename?.(chatId, name); return; }
    db.messages[chatId].push(newMsg(chatId, ME, { type: 'system', text: `Kamu mengganti nama grup jadi "${name}"` }));
    emitChat(chatId);
  },
  addMembers(chatId, ids) {
    const c = db.chats[chatId];
    if (c.remote) ids = ids.filter(id => db.users[id]?.remote);
    ids.forEach(id => { if (!c.members.includes(id)) c.members.push(id); });
    if (c.remote) { emitChat(chatId); hooks.addMembers?.(chatId, ids); return; }
    const names = ids.map(id => firstName(db.users[id]?.name)).join(', ');
    db.messages[chatId].push(newMsg(chatId, ME, { type: 'system', text: `Kamu menambahkan ${names}` }));
    c.updatedAt = Date.now();
    emitChat(chatId);
  },
  leaveGroup(chatId) { const c = db.chats[chatId]; c.left = true; save(); bus.emit('chats'); if (c.remote) hooks.leave?.(chatId); },

  messages(chatId) { return db.messages[chatId] || []; },
  lastMessage(chatId) { const l = db.messages[chatId]; return l?.[l.length - 1]; },
  typingNow(chatId) { if (db.chats[chatId]?.remote) hooks.typing?.(chatId); },
  typingIn(chatId) { return [...(typing[chatId] || [])]; },
  totalUnread(exceptId) { return Object.values(db.chats).filter(c => !c.left && !c.secret && c.id !== exceptId).reduce((s, c) => s + (c.unread || 0), 0); },
  setActive(chatId) { activeChat = chatId; },
  markRead(chatId) { const c = db.chats[chatId]; if (!c) return; c.readAt = Date.now(); if (c.remote) hooks.read?.(chatId); if (c.unread || c.mention) { c.unread = 0; c.mention = false; save(); bus.emit('chats'); } },
  markUnread(chatId) { const c = db.chats[chatId]; c.unread = Math.max(1, c.unread || 0); save(); bus.emit('chats'); },
  setDraft(chatId, text) { const c = db.chats[chatId]; if (c && c.draft !== text) { c.draft = text; save(); bus.emit('chats'); } },

  // hold (ms): pesan nunggu dulu, masih bisa dibatalin (api.cancelHold)
  send(chatId, payload, { hold = 0 } = {}) {
    const c = db.chats[chatId];
    const m = newMsg(chatId, ME, { ...payload, status: hold ? 'hold' : 'sending' });
    db.messages[chatId].push(m);
    c.updatedAt = m.ts; c.hidden = false; c.draft = '';
    emitChat(chatId);
    const go = () => {
      if (c.remote) { if (remoteSend) remoteSend(chatId, m); else m.status = 'failed'; return; }
      if (!navigator.onLine) { outbox.push([chatId, m]); return; }
      setTimeout(() => { m.status = 'sent'; emitChat(chatId); }, rand(250, 600));
      scheduleResponses(chatId, m);
    };
    if (!hold) { go(); return m; }
    holds.set(m.id, setTimeout(() => {
      holds.delete(m.id);
      if (!db.messages[chatId]?.includes(m)) return;
      m.ts = Date.now(); m.status = 'sending'; emitChat(chatId); go();
    }, hold));
    return m;
  },
  /* pengingat pesan ("Ingetin aku") — lokal di HP ini */
  reminders() { return db.reminders ||= []; },
  addReminder(r) { api.reminders().push({ id: uid('rm'), ...r }); save(); bus.emit('reminders'); bus.emit('messages', r.chatId); },
  removeReminder(id) { const r = api.reminders().find(x => x.id === id); db.reminders = api.reminders().filter(x => x.id !== id); save(); bus.emit('reminders'); if (r) bus.emit('messages', r.chatId); },
  reminderFor(mid) { return api.reminders().find(x => x.mid === mid); },
  /* aksi generik fitur khas (checklist, cerita, tebak gambar): tiap orang punya 1 nilai per pesan */
  funAct(chatId, mid, value) {
    const m = db.messages[chatId]?.find(x => x.id === mid);
    if (!m) return;
    (m.acts ||= {})[ME] = value;
    emitChat(chatId);
    if (db.chats[chatId].remote && m.rid) hooks.action?.(chatId, m, 'fun', value);
  },
  // simulasi teman (mode demo)
  funActAs(chatId, mid, uid, value) { const m = db.messages[chatId]?.find(x => x.id === mid); if (m && !db.chats[chatId].remote) { (m.acts ||= {})[uid] = value; emitChat(chatId); } },
  /* kirim pas dia online: pesan nunggu sampai teman online */
  waits() { return db.waits ||= []; },
  waitOnline(chatId, payload) { api.waits().push({ id: uid('wo'), chatId, payload, ts: Date.now() }); save(); bus.emit('waits'); },
  cancelWait(id) { db.waits = api.waits().filter(w => w.id !== id); save(); bus.emit('waits'); },
  flushWaits() {
    const sent = [];
    for (const w of api.waits().slice()) {
      const c = db.chats[w.chatId], peer = c && api.peerOf(c);
      if (!c || c.left) { api.cancelWait(w.id); continue; }
      if (peer?.online) { db.waits = api.waits().filter(x => x.id !== w.id); api.send(w.chatId, w.payload); sent.push(peer); }
    }
    if (sent.length) { save(); bus.emit('waits'); }
    return sent;
  },
  // status lokal (nggak dikirim ke server), mis. kapsul udah dibuka / pesan udah digosok
  setLocal(chatId, mid, patch) { const m = db.messages[chatId]?.find(x => x.id === mid); if (m) { Object.assign(m, patch); emitChat(chatId); } },
  cancelHold(chatId, mid) {
    const t = holds.get(mid);
    if (!t) return null;
    clearTimeout(t); holds.delete(mid);
    const m = db.messages[chatId]?.find(x => x.id === mid);
    if (m) { db.messages[chatId] = db.messages[chatId].filter(x => x !== m); emitChat(chatId); }
    return m;
  },
  suitPick(chatId, mid, val) {
    const m = db.messages[chatId]?.find(x => x.id === mid);
    if (!m || m.game !== 'suit' || m.from === ME || (m.opp && m.opp !== ME)) return;
    m.picks ||= {}; m.picks[ME] = val; m.opp = ME;
    emitChat(chatId);
    if (db.chats[chatId].remote && m.rid) hooks.action?.(chatId, m, 'suit', val);
  },
  /* mini game */
  playGame(chatId, game, pickVal) {
    if (game === 'dice') return api.send(chatId, { type: 'game', game, result: 1 + Math.floor(Math.random() * 6) });
    if (game === 'coin') return api.send(chatId, { type: 'game', game, result: Math.random() < .5 ? 'A' : 'G' });
    const c = db.chats[chatId];
    const m = api.send(chatId, { type: 'game', game: 'suit', picks: { [ME]: pickVal } });
    const opp = c.members.find(id => id !== ME && db.users[id] && !db.users[id].official) || c.members.find(id => id !== ME);
    if (opp && !c.remote) setTimeout(() => {
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
    if (db.chats[chatId].remote) { if (m.rid) hooks.update?.(chatId, m, { reactions: remote.reactionsOut(m) }); return; }
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
    if (db.chats[chatId].remote && m.rid) hooks.update?.(chatId, m, { unsent: true, text: '', data: {}, reactions: {} });
  },
  deleteMessage(chatId, msgId) {
    const m = db.messages[chatId].find(x => x.id === msgId);
    db.messages[chatId] = db.messages[chatId].filter(x => x.id !== msgId);
    if (m && m.type !== 'system') { api.trash().unshift({ id: uid('tr'), chatId, m, at: Date.now() }); db.trash = db.trash.slice(0, 300); bus.emit('trash'); }
    emitChat(chatId);
    return m;
  },
  /* tong sampah: pesan yang dihapus (buat saya) bisa dibalikin 7 hari */
  trash() { db.trash ||= []; const lim = Date.now() - 7 * 864e5; if (db.trash.some(t => t.at < lim)) db.trash = db.trash.filter(t => t.at >= lim); return db.trash; },
  restoreTrash(id) {
    const t = api.trash().find(x => x.id === id);
    if (!t || !db.messages[t.chatId]) return false;
    db.trash = db.trash.filter(x => x !== t);
    const list = db.messages[t.chatId];
    if (!list.some(x => x.id === t.m.id)) { list.push(t.m); list.sort((a, b) => a.ts - b.ts); }
    db.chats[t.chatId].hidden = false;
    emitChat(t.chatId); bus.emit('trash');
    return true;
  },
  emptyTrash() { db.trash = []; save(); bus.emit('trash'); },
  editMessage(chatId, msgId, text) {
    const m = db.messages[chatId].find(x => x.id === msgId);
    if (!m || m.unsent) return;
    m.text = text; m.edited = true;
    emitChat(chatId);
    if (db.chats[chatId].remote && m.rid) hooks.update?.(chatId, m, { text, edited: true });
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
    const others = db.chats[chatId].remote ? [] : db.chats[chatId].members.filter(id => id !== ME && db.users[id] && !db.users[id].official);
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
    if (db.chats[chatId].remote && m.rid) hooks.action?.(chatId, m, 'vote', m.poll.options.filter(x => x.votes.includes(ME)).map(x => x.id));
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
    if (!db.chats[chatId].remote) db.chats[chatId].members.filter(id => id !== ME && db.users[id] && !db.users[id].official).forEach(id => {
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
    if (db.chats[chatId].remote && m.rid) hooks.action?.(chatId, m, 'rsvp', e.going.includes(ME) ? 1 : e.notGoing.includes(ME) ? 0 : null);
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
  myStickers() { return db.myStickers ||= []; },
  addMySticker(src) { (db.myStickers ||= []).unshift({ id: uid('ms'), src, ts: Date.now() }); save(); bus.emit('packs'); },
  removeMySticker(id) { db.myStickers = (db.myStickers || []).filter(s => s.id !== id); save(); bus.emit('packs'); },
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

  togglePin(chatId) { const c = db.chats[chatId]; c.pinned = !c.pinned; save(); bus.emit('chats'); if (c.remote) hooks.prefs?.(chatId, { pinned: !!c.pinned }); return c.pinned; },
  toggleMute(chatId) { const c = db.chats[chatId]; c.muted = !c.muted; save(); bus.emit('chats'); if (c.remote) hooks.prefs?.(chatId, { muted: !!c.muted }); return c.muted; },
  clearChat(chatId) { const c = db.chats[chatId]; db.messages[chatId] = []; if (c.remote) { c.clearedAt = Date.now(); hooks.prefs?.(chatId, { clearedAt: c.clearedAt }); } emitChat(chatId); },
  deleteChat(chatId) { const c = db.chats[chatId]; db.messages[chatId] = []; c.hidden = true; c.unread = 0; c.pinned = false; if (c.remote) { c.clearedAt = Date.now(); hooks.prefs?.(chatId, { clearedAt: c.clearedAt, pinned: false }); } emitChat(chatId); },
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
    if (db.remote) { p.remote = true; hooks.post?.(p); return p; }
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
  deletePost(id) { const p = api.post(id); db.posts = db.posts.filter(p => p.id !== id); save(); bus.emit('posts'); if (p?.rid) hooks.postDelete?.(p.rid); },
  toggleLike(id) {
    const p = api.post(id);
    const i = p.likes.indexOf(ME);
    i >= 0 ? p.likes.splice(i, 1) : p.likes.push(ME);
    save(); bus.emit('posts');
    if (p.rid) hooks.postLike?.(p.rid, i < 0);
    return i < 0;
  },
  comment(id, text) {
    const p = api.post(id);
    const mine = { id: uid('c'), userId: ME, text, ts: Date.now(), likes: [] };
    p.comments.push(mine);
    save(); bus.emit('posts');
    if (p.remote) { if (p.rid) hooks.postComment?.(p.rid, text, mine.id); return; }
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
  stories() { return db.stories.filter(s => db.users[s.userId] && !db.blocked.includes(s.userId)).sort((a, b) => (a.seen - b.seen) || ((b.remote ? 1 : 0) - (a.remote ? 1 : 0)) || ((b.items.at(-1)?.ts || 0) - (a.items.at(-1)?.ts || 0))); },
  storyOf(userId) { return userId === ME ? db.myStory : db.stories.find(s => s.userId === userId); },
  markStorySeen(userId) {
    const s = db.stories.find(x => x.userId === userId);
    if (s?.remote) s.items.forEach(it => { if (it.rid && !it.viewed) { it.viewed = true; hooks.storyView?.(it.rid, it.myReact || ''); } });
    if (s && !s.seen) { s.seen = true; save(); bus.emit('stories'); }
  },
  addMyStory(item) {
    db.myStory ||= { userId: ME, seen: true, items: [], views: 0 };
    const it = { id: uid('st'), ts: Date.now(), viewers: [], ...item };
    db.myStory.items.push(it);
    save(); bus.emit('stories');
    if (db.remote) { hooks.story?.(it); return; }
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
    if (it.rid && s.remote) hooks.storyView?.(it.rid, it.myReact || '');
    return it.myReact;
  },
  deleteMyStory() { const rids = (db.myStory?.items || []).map(i => i.rid).filter(Boolean); db.myStory = null; save(); bus.emit('stories'); if (rids.length) hooks.storyDelete?.(rids); },

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
    const groups = api.groups().filter(g => !g.remote);
    if (groups.length && Math.random() < 0.3) {
      const g = pick(groups);
      const from = pick(g.members.filter(m => m !== ME && db.users[m]));
      if (from) return receive(g.id, from, { text: Math.random() < 0.35 ? `@${firstName(db.me.name)} ${pick(['kamu ikut ga?', 'gimana menurutmu?', 'cek ini dong 👀'])}` : pick(GROUP_INCOMING) });
    }
    const id = pick(api.friends().filter(u => !u.remote)).id;
    const c = api.directWith(id);
    setTyping(c.id, id, true);
    setTimeout(() => { setTyping(c.id, id, false); receive(c.id, id, { text: pick(INCOMING) }); }, 1500);
  },
  simulateIncomingCall(video = false, group = false) {
    const gs = api.groups().filter(g => !g.remote);
    if (group && gs.length) return bus.emit('incoming-call', { chatId: pick(gs).id, video });
    const id = pick(api.friends().filter(u => !u.remote)).id;
    const c = api.directWith(id);
    bus.emit('incoming-call', { chatId: c.id, video });
  },
};

export const allUsers = USERS;

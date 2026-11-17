// Koneksi ke server Onix (PocketBase): akun, sinkron chat, realtime.
// Data server dipetakan ke struktur lokal lewat api.remote (lihat service.js).
import PocketBase from './vendor/pocketbase.es.mjs';
import { api, bus, ME } from './service.js';
import { getMediaBlob } from './media.js';

export let pb = null;
let started = false, connected = false;

export const defaultUrl = () => (location.port === '8080' ? `${location.protocol}//${location.hostname}:8090` : location.origin);
export const serverUrl = () => api.remote.state()?.url || localStorage.getItem('onix:pbUrl') || defaultUrl();
export const isOnline = () => !!api.remote.state() && !!pb?.authStore.isValid;
export const isConnected = () => connected;
const myId = () => (pb.authStore.record || pb.authStore.model)?.id;

function client(url) {
  url = url.replace(/\/+$/, '');
  if (!pb || pb.baseURL !== url) { pb?.realtime.unsubscribe().catch(() => {}); pb = new PocketBase(url); pb.autoCancellation(false); }
  return pb;
}
const avatarUrl = r => (r?.avatar ? pb.files.getURL(r, r.avatar, { thumb: '200x200' }) : null);
const watched = new Set();
function ingestUser(u) {
  api.remote.user(u, avatarUrl(u));
  api.remote.presence(u);
  if (u.id !== myId() && !watched.has(u.id)) {
    watched.add(u.id);
    pb.collection('users').subscribe(u.id, e => { if (e.action === 'update') { api.remote.user(e.record, avatarUrl(e.record)); api.remote.presence(e.record); } }).catch(() => watched.delete(u.id));
  }
}
const ingestChat = r => { (r.expand?.members || []).forEach(ingestUser); return api.remote.chat(r); };

/* ---------- state per chat: dibaca & ngetik ---------- */
const myState = new Map(); // chatId -> record id
const typingOff = new Map();
function applyState(r) {
  if (r.user === myId()) { myState.set(r.chat, r.id); return; }
  if (r.readAt) api.remote.applyRead(r.chat, r.user, r.readAt);
  const k = r.chat + r.user, left = (r.typingAt || 0) + 6000 - Date.now();
  clearTimeout(typingOff.get(k));
  if (left > 0) { api.remote.typing(r.chat, r.user, true); typingOff.set(k, setTimeout(() => api.remote.typing(r.chat, r.user, false), left)); }
  else api.remote.typing(r.chat, r.user, false);
}
async function upsertState(chatId, patch) {
  const id = myState.get(chatId);
  try {
    if (id) return await pb.collection('chat_state').update(id, patch);
    const rec = await pb.collection('chat_state').create({ chat: chatId, user: myId(), ...patch });
    myState.set(chatId, rec.id);
  } catch (e) {
    if (!id) { // mungkin sudah ada di server
      try { const r = await pb.collection('chat_state').getFirstListItem(pb.filter('chat = {:c} && user = {:u}', { c: chatId, u: myId() })); myState.set(chatId, r.id); await pb.collection('chat_state').update(r.id, patch); } catch { /* */ }
    }
  }
}
const readT = new Map(), typingSent = new Map();
api.remote.hooks.read = chatId => { clearTimeout(readT.get(chatId)); readT.set(chatId, setTimeout(() => upsertState(chatId, { readAt: Date.now() }), 700)); };
api.remote.hooks.typing = chatId => {
  const now = Date.now();
  if (now - (typingSent.get(chatId) || 0) < 3000) return;
  typingSent.set(chatId, now);
  upsertState(chatId, { typingAt: now });
};
api.remote.hooks.update = async (chatId, m, patch) => {
  try { await pb.collection('messages').update(m.rid, patch); } catch (e) { console.warn('update gagal', e); }
};

/* ---------- aksi interaktif (vote, rsvp, bayar, suit) ---------- */
const actionIds = new Map(); // msgRid|kind -> record id
const pendingActions = [];
function applyAction(r) {
  if (r.user === myId()) actionIds.set(r.msg + '|' + r.kind, r.id);
  if (!api.remote.applyAction(r)) pendingActions.push(r); // pesannya belum ada, coba lagi nanti
}
function flushPendingActions() { pendingActions.splice(0).forEach(applyAction); }
api.remote.hooks.action = async (chatId, m, kind, value) => {
  const key = m.rid + '|' + kind, id = actionIds.get(key);
  try {
    if (id) return await pb.collection('msg_actions').update(id, { value });
    const rec = await pb.collection('msg_actions').create({ msg: m.rid, chat: chatId, user: myId(), kind, value });
    actionIds.set(key, rec.id);
  } catch (e) {
    try {
      const r = await pb.collection('msg_actions').getFirstListItem(pb.filter('msg = {:m} && user = {:u} && kind = {:k}', { m: m.rid, u: myId(), k: kind }));
      actionIds.set(key, r.id);
      await pb.collection('msg_actions').update(r.id, { value });
    } catch { console.warn('aksi gagal', e); }
  }
};
const withFile = r => { if (r.file) r._fileUrl = pb.files.getURL(r, r.file); return r; };

/* ---------- panggilan WebRTC ---------- */
const ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }, { urls: 'stun:stun.cloudflare.com:3478' }];
const sessions = new Map(), earlyIce = new Map();
export const canCall = () => !!navigator.mediaDevices?.getUserMedia && !!window.RTCPeerConnection;
const signal = (s, kind, data = {}) => pb.collection('call_signals').create({ chat: s.chatId, sender: myId(), target: s.peer, call: s.id, kind, data });

function makeSession({ chatId, peer, video, id, incoming, offer }) {
  const s = { id, chatId, peer, video, incoming, pc: null, local: null, ended: false, handlers: {}, pending: earlyIce.get(id) || [], offerSent: false, outIce: [] };
  earlyIce.delete(id);
  const emit = (ev, x) => s.handlers[ev]?.(x);
  s.on = (ev, fn) => { s.handlers[ev] = fn; if (ev === 'local' && s.local) fn(s.local); };
  async function media() {
    s.local = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: video ? { facingMode: 'user', width: { ideal: 720 } } : false });
    emit('local', s.local);
  }
  function makePc() {
    const pc = s.pc = new RTCPeerConnection({ iceServers: ICE });
    s.local.getTracks().forEach(t => pc.addTrack(t, s.local));
    pc.onicecandidate = e => {
      if (!e.candidate) return;
      const c = e.candidate.toJSON();
      if (s.incoming || s.offerSent) signal(s, 'ice', c).catch(() => {}); else s.outIce.push(c);
    };
    pc.ontrack = e => emit('remote', e.streams[0] || new MediaStream([e.track]));
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') emit('connected');
      if (pc.connectionState === 'failed') s.fail('failed');
    };
  }
  async function flushIce() { for (const c of s.pending.splice(0)) await s.pc.addIceCandidate(c).catch(() => {}); }
  function cleanup() {
    if (s.ended) return;
    s.ended = true;
    try { s.pc?.close(); } catch { /* */ }
    s.local?.getTracks().forEach(t => t.stop());
    sessions.delete(s.id);
  }
  s.fail = r => { if (s.ended) return; cleanup(); emit('ended', r); };
  s.start = async () => {
    try { await media(); } catch { return s.fail('nomedia'); }
    if (s.ended) return cleanup();
    makePc();
    const o = await s.pc.createOffer();
    await s.pc.setLocalDescription(o);
    try { await signal(s, 'offer', { sdp: { type: o.type, sdp: o.sdp }, video }); } catch { return s.fail('failed'); }
    s.offerSent = true;
    s.outIce.splice(0).forEach(c => signal(s, 'ice', c).catch(() => {}));
  };
  s.accept = async () => {
    try { await media(); } catch { signal(s, 'reject').catch(() => {}); return s.fail('nomedia'); }
    makePc();
    await s.pc.setRemoteDescription(offer);
    await flushIce();
    const a = await s.pc.createAnswer();
    await s.pc.setLocalDescription(a);
    await signal(s, 'answer', { sdp: { type: a.type, sdp: a.sdp } }).catch(() => s.fail('failed'));
  };
  s.onSignal = async (kind, data) => {
    if (s.ended) return;
    if (kind === 'answer') { await s.pc.setRemoteDescription(data.sdp); await flushIce(); }
    else if (kind === 'ice') { if (s.pc?.remoteDescription) await s.pc.addIceCandidate(data).catch(() => {}); else s.pending.push(data); }
    else if (kind === 'end' || kind === 'reject' || kind === 'busy') { cleanup(); emit('ended', kind); }
  };
  s.hangup = () => { if (!s.ended) signal(s, 'end').catch(() => {}); cleanup(); };
  s.reject = () => { if (!s.ended) signal(s, 'reject').catch(() => {}); cleanup(); };
  s.setMute = m => s.local?.getAudioTracks().forEach(t => { t.enabled = !m; });
  s.setCam = on => s.local?.getVideoTracks().forEach(t => { t.enabled = on; });
  s.hasVideo = () => !!s.local?.getVideoTracks().length;
  sessions.set(id, s);
  return s;
}

export function callSession(chatId, video) {
  const c = api.chat(chatId);
  const peer = c?.members.find(x => x !== ME);
  if (!peer) return null;
  return makeSession({ chatId, peer, video, id: 'call' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), incoming: false });
}

async function onSignal(r) {
  if (r.target !== myId() || r.sender === myId()) return;
  if (r.kind === 'offer') {
    if (Date.now() - Date.parse(r.created) > 45000) return;
    if (sessions.size) { pb.collection('call_signals').create({ chat: r.chat, sender: myId(), target: r.sender, call: r.call, kind: 'busy', data: {} }).catch(() => {}); return; }
    if (!api.chat(r.chat)) { try { ingestChat(await pb.collection('chats').getOne(r.chat, { expand: 'members' })); api.remote.done(); } catch { return; } }
    const s = makeSession({ chatId: r.chat, peer: r.sender, video: !!r.data?.video, id: r.call, incoming: true, offer: r.data.sdp });
    bus.emit('incoming-call', { chatId: r.chat, video: !!r.data?.video, rtc: s });
    return;
  }
  const s = sessions.get(r.call);
  if (s) s.onSignal(r.kind, r.data);
  else if (r.kind === 'ice') { const a = earlyIce.get(r.call) || []; a.push(r.data); earlyIce.set(r.call, a); setTimeout(() => earlyIce.delete(r.call), 60000); }
}

/* ---------- grup ---------- */
async function systemMsg(chatId, text) {
  try { await pb.collection('messages').create({ chat: chatId, sender: myId(), cid: 'sys' + Date.now().toString(36), type: 'system', text, data: {} }); } catch { /* */ }
}
export async function createGroup(name, ids, emoji) {
  const rec = await pb.collection('chats').create({ type: 'group', name, emoji, hue: Math.floor(Math.random() * 360), members: [myId(), ...ids] }, { expand: 'members' });
  const c = ingestChat(rec);
  api.remote.done();
  await systemMsg(rec.id, `${api.me().name} membuat grup "${name}"`);
  return c;
}
api.remote.hooks.rename = async (chatId, name) => {
  try { await pb.collection('chats').update(chatId, { name }); await systemMsg(chatId, `${api.me().name} mengganti nama grup jadi "${name}"`); } catch (e) { console.warn(e); }
};
api.remote.hooks.addMembers = async (chatId, ids) => {
  if (!ids.length) return;
  try {
    await pb.collection('chats').update(chatId, { 'members+': ids });
    await systemMsg(chatId, `${api.me().name} menambahkan ${ids.map(id => api.user(id)?.name?.split(' ')[0]).join(', ')}`);
  } catch (e) { console.warn(e); }
};
api.remote.hooks.leave = async chatId => {
  try { await systemMsg(chatId, `${api.me().name} keluar dari grup`); await pb.collection('chats').update(chatId, { 'members-': [myId()] }); } catch (e) { console.warn(e); }
};

/* ---------- presence (heartbeat) ---------- */
let beatT = null;
async function beat(online = !document.hidden) {
  if (!started || !pb?.authStore.isValid) return;
  profileQ = profileQ.then(() => pb.collection('users').update(myId(), { online, lastActive: Date.now() })).catch(() => {});
  return profileQ;
}
function startBeat() {
  clearInterval(beatT);
  beat();
  beatT = setInterval(() => { if (!document.hidden) beat(true); api.remote.staleCheck(); }, 45000);
}
document.addEventListener('visibilitychange', () => beat(!document.hidden));
window.addEventListener('pagehide', () => beat(false));

function setConn(v) { if (connected !== v) { connected = v; bus.emit('remote'); } }

export function errText(e) {
  if (!e?.status) return 'Server nggak bisa dihubungi';
  const d = e.response?.data || {};
  if (d.handle) return d.handle.code === 'validation_not_unique' ? 'ID udah dipakai' : 'ID cuma huruf kecil, angka, titik, _';
  if (d.password) return 'Password minimal 8 karakter';
  if (d.email) return 'ID udah dipakai';
  if (e.status === 400 && /auth/i.test(e.url || '')) return 'ID atau password salah';
  return e.response?.message || 'Gagal (' + e.status + ')';
}

function dataURLtoBlob(u) {
  const [h, b] = u.split(','), mime = h.match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bin = atob(b), arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export async function signUp({ handle, password, url }) {
  client(url);
  const me = api.me();
  const fd = new FormData();
  fd.append('email', `${handle}@onix.local`);
  fd.append('handle', handle);
  fd.append('password', password);
  fd.append('passwordConfirm', password);
  fd.append('name', me.name || handle);
  fd.append('hue', String(me.hue ?? 260));
  fd.append('status', me.status || '');
  if (me.avatar?.startsWith('data:')) fd.append('avatar', dataURLtoBlob(me.avatar), 'avatar.jpg');
  await pb.collection('users').create(fd);
  return signIn({ handle, password, url });
}

export async function signIn({ handle, password, url }) {
  client(url);
  const auth = await pb.collection('users').authWithPassword(handle, password);
  api.remote.setState({ url: pb.baseURL, uid: auth.record.id, handle: auth.record.handle });
  localStorage.setItem('onix:pbUrl', pb.baseURL);
  api.remote.applyMe(auth.record, avatarUrl(auth.record));
  await start();
}

/* ---------- story ---------- */
const storyRow = r => ({ rid: r.id, user: r.user, ts: Date.parse(r.created) || Date.now(), text: r.text, bg: r.bg, font: r.font, image: r.image ? pb.files.getURL(r, r.image) : null });
async function syncStories() {
  try {
    const now = Date.now();
    const list = await pb.collection('stories').getFullList({ filter: pb.filter('expires > {:n}', { n: now }), sort: 'created' });
    const mine = list.filter(r => r.user === myId()).map(storyRow);
    api.remote.storiesIn(list.filter(r => r.user !== myId()).map(storyRow), mine);
    await syncViews();
  } catch (e) { console.warn('story gagal', e); }
}
async function syncViews() {
  const vs = await pb.collection('story_views').getFullList({ filter: pb.filter('story.user = {:me}', { me: myId() }) });
  api.remote.storyViewers(vs.map(v => ({ story: v.story, user: v.user, ts: Date.parse(v.created) || Date.now(), react: v.react })));
}
api.remote.hooks.story = async it => {
  const body = { user: myId(), text: it.text || '', bg: it.bg ?? null, font: it.font || '', expires: Date.now() + 864e5 };
  if (it.image?.startsWith('data:')) body.image = new File([dataURLtoBlob(it.image)], 'story.jpg', { type: 'image/jpeg' });
  try { const r = await pb.collection('stories').create(body); api.remote.storySaved(it.id, r.id); } catch (e) { console.warn('upload story gagal', e); }
};
api.remote.hooks.storyDelete = rids => rids.forEach(id => pb.collection('stories').delete(id).catch(() => {}));
const viewIds = new Map();
api.remote.hooks.storyView = async (rid, react) => {
  try {
    const id = viewIds.get(rid);
    if (id) return await pb.collection('story_views').update(id, { react });
    const r = await pb.collection('story_views').create({ story: rid, user: myId(), react });
    viewIds.set(rid, r.id);
  } catch {
    try { const r = await pb.collection('story_views').getFirstListItem(pb.filter('story = {:s} && user = {:u}', { s: rid, u: myId() })); viewIds.set(rid, r.id); if (react !== undefined) await pb.collection('story_views').update(r.id, { react }); } catch { /* */ }
  }
};

/* ---------- VOOM ---------- */
let postsFirst = true;
async function syncPosts() {
  try {
    const ids = [myId(), ...Object.values(api.friends()).filter(u => u.remote).map(u => u.id)];
    const filter = ids.map((_, i) => `user = {:u${i}}`).join(' || ');
    const params = Object.fromEntries(ids.map((id, i) => ['u' + i, id]));
    const res = await pb.collection('posts').getList(1, 60, { filter: pb.filter(filter, params), sort: '-created' });
    const pids = res.items.map(p => p.id);
    let likes = [], comments = [];
    if (pids.length) {
      const pf = pids.map((_, i) => `post = {:p${i}}`).join(' || '), pp = Object.fromEntries(pids.map((id, i) => ['p' + i, id]));
      likes = await pb.collection('post_likes').getFullList({ filter: pb.filter(pf, pp) });
      comments = await pb.collection('post_comments').getFullList({ filter: pb.filter(pf, pp), sort: 'created' });
    }
    api.remote.postsIn(res.items.map(p => ({
      rid: p.id, cid: p.cid, user: p.user, ts: Date.parse(p.created) || Date.now(), text: p.text,
      images: (p.images || []).map(f => pb.files.getURL(p, f)),
      likes: likes.filter(l => l.post === p.id).map(l => l.user),
      comments: comments.filter(c => c.post === p.id).map(c => ({ rid: c.id, cid: c.cid, user: c.user, text: c.text, ts: Date.parse(c.created) || Date.now() })),
    })), postsFirst);
    postsFirst = false;
  } catch (e) { console.warn('VOOM gagal', e); }
}
api.remote.hooks.post = async p => {
  const body = { user: myId(), cid: p.id, text: p.text || '' };
  const files = (p.images || []).filter(s => s?.startsWith('data:')).map((s, i) => new File([dataURLtoBlob(s)], `foto${i}.jpg`, { type: 'image/jpeg' }));
  if (files.length) body.images = files;
  try { const r = await pb.collection('posts').create(body); api.remote.postSaved(p.id, r.id); } catch (e) { console.warn('post gagal', e); bus.emit('toast', 'Post gagal diupload'); }
};
api.remote.hooks.postDelete = rid => pb.collection('posts').delete(rid).catch(() => {});
api.remote.hooks.postLike = async (rid, on) => {
  try {
    if (on) await pb.collection('post_likes').create({ post: rid, user: myId() });
    else { const r = await pb.collection('post_likes').getFirstListItem(pb.filter('post = {:p} && user = {:u}', { p: rid, u: myId() })); await pb.collection('post_likes').delete(r.id); }
  } catch { /* udah like / udah unlike */ }
};
api.remote.hooks.postComment = (rid, text, cid) => pb.collection('post_comments').create({ post: rid, user: myId(), text, cid }).catch(e => console.warn('komentar gagal', e));

/* ---------- profil ---------- */
api.remote.hooks.profile = async patch => {
  if (!pb?.authStore.isValid) return;
  const body = {};
  for (const k of ['name', 'status', 'hue', 'mood']) if (k in patch) body[k] = patch[k];
  if ('avatar' in patch) {
    if (!patch.avatar) body.avatar = null;
    else if (patch.avatar.startsWith('data:')) body.avatar = new File([dataURLtoBlob(patch.avatar)], 'avatar.jpg', { type: 'image/jpeg' });
  }
  if (!Object.keys(body).length) return;
  // antre: update profil dikirim satu per satu biar nggak saling timpa
  profileQ = profileQ.then(() => pb.collection('users').update(myId(), body)).catch(e => console.warn('profil gagal', e));
  return profileQ;
};
let profileQ = Promise.resolve();

export async function signOut() {
  await beat(false);
  clearInterval(beatT);
  started = false; setConn(false); watched.clear(); myState.clear();
  try { await pb?.realtime.unsubscribe(); } catch { /* */ }
  pb?.authStore.clear();
  api.remote.purge();
}

async function start() {
  api.remote.setSender(sendRemote);
  if (started) return sync();
  started = true;
  await sync();
  await pb.collection('messages').subscribe('*', e => { if (e.action === 'create') onMessage(e.record); else if (e.action === 'update') api.remote.applyUpdate(e.record); });
  await pb.collection('chat_state').subscribe('*', e => { if (e.action !== 'delete') applyState(e.record); });
  await pb.collection('msg_actions').subscribe('*', e => { if (e.action !== 'delete') applyAction(e.record); });
  await pb.collection('call_signals').subscribe('*', e => { if (e.action === 'create') onSignal(e.record); });
  let stT = null;
  await pb.collection('stories').subscribe('*', () => { clearTimeout(stT); stT = setTimeout(syncStories, 400); });
  await pb.collection('story_views').subscribe('*', () => { clearTimeout(stT); stT = setTimeout(syncStories, 400); });
  let poT = null;
  const resyncPosts = () => { clearTimeout(poT); poT = setTimeout(syncPosts, 400); };
  for (const c of ['posts', 'post_likes', 'post_comments']) await pb.collection(c).subscribe('*', resyncPosts);
  await pb.collection('chats').subscribe('*', e => { if (e.action !== 'delete') { ingestChat(e.record); api.remote.done(); } }, { expand: 'members' });
  let first = true;
  await pb.realtime.subscribe('PB_CONNECT', () => { setConn(true); if (!first) sync(); first = false; });
  pb.realtime.onDisconnect = () => setConn(false);
  setConn(true);
  startBeat();
}

let syncing = null;
export function sync() {
  if (syncing) return syncing;
  syncing = (async () => {
    try {
      const chats = await pb.collection('chats').getFullList({ expand: 'members', sort: '-updated' });
      chats.forEach(ingestChat);
      for (const c of chats) {
        const res = await pb.collection('messages').getList(1, 300, { filter: pb.filter('chat = {:c}', { c: c.id }), sort: '-created' });
        res.items.reverse().forEach(r => api.remote.message(withFile(r), false));
      }
      api.remote.done();
      (await pb.collection('chat_state').getFullList()).forEach(applyState);
      (await pb.collection('msg_actions').getFullList()).forEach(applyAction);
      await syncStories();
      await syncPosts();
    } catch (e) { console.warn('sync gagal', e); }
    finally { syncing = null; }
  })();
  return syncing;
}

async function onMessage(r) {
  if (!api.chat(r.chat)) {
    try { ingestChat(await pb.collection('chats').getOne(r.chat, { expand: 'members' })); api.remote.done(); } catch { return; }
  }
  api.remote.message(withFile(r), true);
  if (pendingActions.length) flushPendingActions();
}

async function sendRemote(chatId, m) {
  const type = m.type, text = m.text || '', data = api.remote.payloadOf(m);
  const body = { chat: chatId, sender: myId(), cid: m.id, type, text, data };
  if (m.mediaId) { // video & file: upload ke server
    const blob = await getMediaBlob(m.mediaId);
    if (!blob) return api.remote.failed(chatId, m.id);
    if (blob.size > 50 * 1048576) { bus.emit('toast', 'File maks 50 MB'); return api.remote.failed(chatId, m.id); }
    body.file = new File([blob], m.name || (m.type === 'video' ? 'video.mp4' : 'file'), { type: m.mime || blob.type || 'application/octet-stream' });
  }
  try {
    const rec = await pb.collection('messages').create(body);
    api.remote.sent(chatId, m.id, rec.id);
    if (typingSent.get(chatId)) { typingSent.set(chatId, 0); upsertState(chatId, { typingAt: 0 }); }
  } catch (e) {
    console.warn('kirim gagal', e);
    api.remote.failed(chatId, m.id);
  }
}

export async function findUsers(q) {
  q = q.trim().toLowerCase().replace(/^@/, '');
  if (q.length < 2) return [];
  const res = await pb.collection('users').getList(1, 20, { filter: pb.filter('id != {:me} && (handle ~ {:q} || name ~ {:q})', { me: myId(), q }) });
  return res.items.map(u => ({ id: u.id, handle: u.handle, name: u.name || u.handle, hue: u.hue, avatar: avatarUrl(u), _rec: u }));
}

export async function startChatWith(u) {
  const existing = api.remote.directChatWith(u.id);
  if (existing) return existing;
  const me = myId(), dkey = [me, u.id].sort().join('_');
  let rec;
  try { rec = await pb.collection('chats').getFirstListItem(pb.filter('dkey = {:k}', { k: dkey }), { expand: 'members' }); }
  catch { rec = await pb.collection('chats').create({ type: 'direct', members: [me, u.id], dkey }, { expand: 'members' }); }
  ingestChat(rec);
  api.remote.done();
  return rec.id;
}

export async function init() {
  const st = api.remote.state();
  if (!st) return;
  client(st.url);
  api.remote.setSender(sendRemote);
  if (!pb.authStore.isValid) return;
  try {
    await pb.collection('users').authRefresh();
    await start();
  } catch (e) {
    if (e?.status === 401 || e?.status === 403) { await signOut(); return; }
    // server mati: coba lagi nanti
    setTimeout(init, 15000);
  }
}
window.addEventListener('online', () => { if (started) sync(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && started) sync(); });
export { ME };

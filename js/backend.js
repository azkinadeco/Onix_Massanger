// Koneksi ke server Onix (PocketBase): akun, sinkron chat, realtime.
// Data server dipetakan ke struktur lokal lewat api.remote (lihat service.js).
import PocketBase from './vendor/pocketbase.es.mjs';
import { api, bus, ME } from './service.js';

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
const ingestChat = r => { (r.expand?.members || []).forEach(u => api.remote.user(u, avatarUrl(u))); return api.remote.chat(r); };

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
  await start();
}

export async function signOut() {
  started = false; setConn(false);
  try { await pb?.realtime.unsubscribe(); } catch { /* */ }
  pb?.authStore.clear();
  api.remote.purge();
}

async function start() {
  api.remote.setSender(sendRemote);
  if (started) return sync();
  started = true;
  await sync();
  await pb.collection('messages').subscribe('*', e => { if (e.action === 'create' || e.action === 'update') onMessage(e.record); });
  await pb.collection('chats').subscribe('*', e => { if (e.action !== 'delete') { ingestChat(e.record); api.remote.done(); } }, { expand: 'members' });
  let first = true;
  await pb.realtime.subscribe('PB_CONNECT', () => { setConn(true); if (!first) sync(); first = false; });
  pb.realtime.onDisconnect = () => setConn(false);
  setConn(true);
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
        res.items.reverse().forEach(r => api.remote.message(r, false));
      }
      api.remote.done();
    } catch (e) { console.warn('sync gagal', e); }
    finally { syncing = null; }
  })();
  return syncing;
}

async function onMessage(r) {
  if (!api.chat(r.chat)) {
    try { ingestChat(await pb.collection('chats').getOne(r.chat, { expand: 'members' })); api.remote.done(); } catch { return; }
  }
  api.remote.message(r, true);
}

async function sendRemote(chatId, m) {
  let type = m.type, text = m.text || '', data = api.remote.payloadOf(m);
  if (m.mediaId) { // video & file belum diupload ke server
    type = 'text'; data = {};
    text = m.type === 'video' ? '🎬 Video (belum bisa dikirim online)' : `📎 ${m.name || 'File'} (belum bisa dikirim online)`;
  }
  try {
    const rec = await pb.collection('messages').create({ chat: chatId, sender: myId(), cid: m.id, type, text, data });
    api.remote.sent(chatId, m.id, rec.id);
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

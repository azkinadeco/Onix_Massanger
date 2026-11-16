// Fitur tambahan: teruskan pesan, Keep, polling, arsip, wallpaper, kunci PIN
import { api, bus, ME, firstName } from './service.js';
import { $, $$, h, esc, avatar, ago, listTime, vibrate, pickFile, compressImage, copyText } from './util.js';
import { icon } from './icons.js';
import { router, bindActs, navbar, toast, sheet, confirmBox, promptBox, onLongPress } from './ui.js';
import { chatAvatar, chatRow, empty } from './views.js';
import { openChat } from './chat.js';
import { openImage } from './screens.js';

/* ================= WALLPAPER ================= */
export const WALLPAPERS = [
  ['default', 'Default'], ['plain', 'Polos'], ['sunset', 'Sunset'], ['ocean', 'Ocean'],
  ['mint', 'Mint'], ['grape', 'Grape'], ['peach', 'Peach'], ['night', 'Night'],
];
export function wallpaperSheet(chatId) {
  const cur = api.chat(chatId).wallpaper || 'default';
  sheet({
    title: 'Wallpaper chat',
    top: `<div class="wall-grid">${WALLPAPERS.map(([k, l]) => `<button class="wall-opt ${k === cur ? 'on' : ''}" data-w="${k}"><span class="wall-prev" data-wall="${k}"><i></i><i></i></span><small>${l}</small></button>`).join('')}</div>`,
    onMount: (el, close) => el.querySelectorAll('[data-w]').forEach(b => b.addEventListener('click', () => {
      api.setWallpaper(chatId, b.dataset.w); vibrate(6); close();
    })),
  });
}

/* ================= CHAT PICKER (teruskan) ================= */
export function ChatPicker({ title = 'Teruskan ke…', onDone }) {
  const sel = new Set();
  let q = '';
  const el = h(`<div class="sub-screen">
    ${navbar(esc(title), `<button class="text-btn" data-act="done" disabled>Kirim</button>`)}
    <div class="af-search"><div class="search">${icon('search')}<input placeholder="Cari chat"></div></div>
    <div class="content picker-body"></div>
  </div>`);
  const body = $('.picker-body', el);
  function render() {
    const list = api.allChats().filter(c => api.chatTitle(c).toLowerCase().includes(q.toLowerCase()));
    body.innerHTML = (list.map(c => `<div class="list-item" data-act="pick" data-id="${c.id}">${chatAvatar(c, 44, { online: false })}<div class="li-main"><div class="li-name">${esc(api.chatTitle(c))}</div><div class="li-sub">${c.type === 'group' ? c.members.length + ' anggota' : 'Personal'}</div></div><span class="check ${sel.has(c.id) ? 'on' : ''}">${icon('check')}</span></div>`).join('') || empty('🔍', 'Nggak ada chat'));
    const d = $('[data-act=done]', el);
    d.disabled = !sel.size; d.textContent = sel.size ? `Kirim (${sel.size})` : 'Kirim';
  }
  $('input', el).addEventListener('input', e => { q = e.target.value; render(); });
  bindActs(el, {
    pick: t => { const id = t.dataset.id; sel.has(id) ? sel.delete(id) : sel.add(id); vibrate(5); render(); },
    done: () => { if (sel.size) onDone([...sel]); },
  });
  render();
  return { el };
}

export function forwardMessage(m) {
  router.push(ChatPicker({
    onDone: ids => {
      api.forward(m, ids);
      history.back();
      toast(ids.length > 1 ? `Diteruskan ke ${ids.length} chat ✈️` : 'Pesan diteruskan ✈️');
    },
  }));
}

/* ================= KEEP ================= */
export function keepFromMessage(m, chat) {
  const who = m.from === ME ? 'Kamu' : api.user(m.from)?.name;
  const item = { source: `${api.chatTitle(chat)} · ${who}` };
  if (m.type === 'text') Object.assign(item, { type: 'text', text: m.text });
  else if (m.type === 'image') Object.assign(item, { type: 'image', src: m.src, w: m.w, h: m.h });
  else if (m.type === 'sticker') Object.assign(item, { type: 'text', text: m.sticker });
  else if (m.type === 'location') Object.assign(item, { type: 'location', title: m.title, address: m.address });
  else if (m.type === 'poll') Object.assign(item, { type: 'text', text: '📊 ' + m.poll.q + '\n' + m.poll.options.map(o => `• ${o.text} (${o.votes.length})`).join('\n') });
  else if (m.type === 'video') Object.assign(item, m.thumb ? { type: 'image', src: m.thumb, w: m.w, h: m.h } : { type: 'text', text: '🎬 Video' });
  else if (m.type === 'file') Object.assign(item, { type: 'text', text: '📎 ' + m.name });
  else if (m.type === 'voice') Object.assign(item, { type: 'text', text: '🎤 Voice note ' + (m.duration || 0) + ' detik' });
  api.keepAdd(item);
  toast('Disimpan 🔖');
}

export function KeepScreen() {
  let filter = 'all';
  const el = h(`<div class="sub-screen">
    ${navbar('Keep', `<button class="icon-btn" data-act="new-note">${icon('plus')}</button>`)}
    <div class="keep-filters chips scroll-x"></div>
    <div class="content keep-body"></div>
  </div>`);
  const body = $('.keep-body', el), chips = $('.keep-filters', el);
  const FILTERS = [['all', 'Semua'], ['text', 'Teks'], ['image', 'Foto'], ['note', 'Catatan'], ['location', 'Lokasi']];
  function render() {
    chips.innerHTML = FILTERS.map(([k, l]) => `<button class="chip ${k === filter ? 'on' : ''}" data-act="filter" data-f="${k}">${l}</button>`).join('');
    const items = api.keep().filter(k => filter === 'all' || k.type === filter);
    if (!items.length) { body.innerHTML = empty('🔖', 'Kosong'); return; }
    body.innerHTML = `<div class="keep-list">${items.map(k => {
      let inner;
      if (k.type === 'image') inner = `<img src="${k.src}" alt="" loading="lazy">`;
      else if (k.type === 'location') inner = `<div class="keep-loc">${icon('location')}<div><b>${esc(k.title)}</b><small>${esc(k.address)}</small></div></div>`;
      else inner = `<p>${esc(k.text)}</p>`;
      return `<button class="keep-item ${k.type}" data-act="item" data-id="${k.id}">
        ${k.type === 'note' ? `<span class="keep-tag">${icon('edit', 'tiny')} Catatan</span>` : ''}
        ${inner}
        <small>${k.source ? esc(k.source) + ' · ' : ''}${listTime(k.ts)}</small>
      </button>`;
    }).join('')}</div>`;
  }
  async function newNote(existing) {
    const v = await promptBox({ title: existing ? 'Edit catatan' : 'Catatan baru', value: existing?.text || '', placeholder: 'tulis apa aja…', max: 500, ok: 'Simpan' });
    if (!v) return;
    existing ? api.keepUpdate(existing.id, v) : api.keepAdd({ type: 'note', text: v });
    
  }
  bindActs(el, {
    filter: t => { filter = t.dataset.f; render(); },
    'new-note': () => newNote(),
    item: t => {
      const k = api.keep().find(x => x.id === t.dataset.id);
      if (!k) return;
      if (k.type === 'image') return openImage(k.src, k.source);
      const acts = [];
      if (k.type === 'note') acts.push({ label: 'Edit catatan', icon: 'edit', run: () => newNote(k) });
      if (k.text) acts.push({ label: 'Salin', icon: 'copy', run: async () => { await copyText(k.text); toast('Disalin'); } });
      acts.push({ label: 'Kirim ke chat', icon: 'send', run: () => forwardMessage(k) });
      acts.push({ label: 'Hapus', icon: 'trash', danger: true, run: () => { api.keepRemove(k.id); toast('Dihapus dari Keep'); } });
      sheet({ title: k.type === 'note' ? 'Catatan' : 'Item Keep', actions: acts });
    },
  });
  onLongPress(body, '.keep-item', t => {
    const k = api.keep().find(x => x.id === t.dataset.id);
    sheet({ actions: [
      { label: 'Kirim ke chat', icon: 'send', run: () => forwardMessage(k) },
      { label: 'Hapus', icon: 'trash', danger: true, run: () => api.keepRemove(k.id) },
    ] });
  });
  const off = bus.on('keep', render);
  render();
  return { el, destroy: off };
}

/* ================= POLL ================= */
export function PollComposeScreen(chatId) {
  let opts = ['', ''], multi = false;
  const el = h(`<div class="sub-screen">
    ${navbar('Polling baru', `<button class="text-btn" data-act="send" disabled>Kirim</button>`)}
    <div class="content pad">
      <label class="lbl">Pertanyaan</label>
      <input class="field" name="q" maxlength="120" placeholder="mis. Nonton film apa malam ini?">
      <label class="lbl">Pilihan</label>
      <div class="poll-opts"></div>
      <button class="add-opt" data-act="add">${icon('plus')} Tambah pilihan</button>
      <label class="set-group poll-multi"><div class="set-row">${icon('check')}<div class="set-txt"><span>Boleh pilih lebih dari satu</span></div><input type="checkbox" class="switch" name="multi"></div></label>
    </div>
  </div>`);
  const q = $('[name=q]', el), box = $('.poll-opts', el), sendBtn = $('[data-act=send]', el), addBtn = $('[data-act=add]', el);
  const valid = () => q.value.trim() && opts.filter(o => o.trim()).length >= 2;
  function render() {
    box.innerHTML = opts.map((o, i) => `<div class="poll-opt-row"><input class="field" data-i="${i}" maxlength="60" placeholder="Pilihan ${i + 1}" value="${esc(o)}">${opts.length > 2 ? `<button class="icon-btn sm" data-act="rm" data-i="${i}">${icon('x')}</button>` : ''}</div>`).join('');
    addBtn.hidden = opts.length >= 6;
    sendBtn.disabled = !valid();
  }
  box.addEventListener('input', e => { const i = e.target.dataset.i; if (i != null) { opts[+i] = e.target.value; sendBtn.disabled = !valid(); } });
  q.addEventListener('input', () => { sendBtn.disabled = !valid(); });
  $('[name=multi]', el).addEventListener('change', e => { multi = e.target.checked; });
  bindActs(el, {
    add: () => { opts.push(''); render(); box.querySelector(`[data-i="${opts.length - 1}"]`)?.focus(); },
    rm: t => { opts.splice(+t.dataset.i, 1); render(); },
    send: () => {
      if (!valid()) return;
      api.createPoll(chatId, q.value.trim(), opts.map(o => o.trim()).filter(Boolean), multi);
      
      router.back();
    },
  });
  render();
  setTimeout(() => q.focus(), 350);
  return { el };
}

/* ================= ARCHIVE ================= */
export function ArchivedScreen() {
  const el = h(`<div class="sub-screen">${navbar('Arsip')}<div class="content arc-body"></div></div>`);
  const body = $('.arc-body', el);
  function render() {
    const list = api.archived();
    body.innerHTML = list.length ? list.map(chatRow).join('') : empty('🗂️', 'Arsip kosong', 'Tahan chat di daftar lalu pilih "Arsipkan".');
  }
  bindActs(el, { 'open-chat': t => openChat(t.dataset.id) });
  onLongPress(body, '.chat-item', item => {
    const c = api.chat(item.dataset.id);
    sheet({ title: api.chatTitle(c), actions: [{ label: 'Batal arsip', icon: 'undo', run: () => { api.toggleArchive(c.id); toast('Dikeluarkan dari arsip'); } }] });
  });
  const off = bus.on('chats', render);
  render();
  return { el, destroy: off };
}

/* ================= PIN / LOCK ================= */
function pinPad({ title, sub = '', canCancel = true, extra = '' }) {
  return new Promise(resolve => {
    let val = '';
    const el = h(`<div class="lock">
      <div class="lock-top"><img src="icons/icon.svg" alt=""><h2>${esc(title)}</h2><p>${esc(sub)}</p><div class="pin-dots">${'<i></i>'.repeat(4)}</div></div>
      <div class="pin-pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-n="${n}">${n}</button>`).join('')}<button data-x class="pin-sub">${canCancel ? 'Batal' : ''}</button><button data-n="0">0</button><button data-del class="pin-sub">${icon('back')}</button></div>
      ${extra}
    </div>`);
    document.getElementById('app').appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    const dots = $$('.pin-dots i', el);
    const close = v => { el.classList.remove('show'); setTimeout(() => el.remove(), 250); resolve(v); };
    const paint = () => dots.forEach((d, i) => d.classList.toggle('on', i < val.length));
    el.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      vibrate(4);
      if (b.dataset.n != null && val.length < 4) {
        val += b.dataset.n; paint();
        if (val.length === 4) setTimeout(() => {
          const res = { pin: val, el, fail: () => { el.classList.add('shake'); vibrate([30, 40, 30]); setTimeout(() => { el.classList.remove('shake'); val = ''; paint(); }, 450); }, done: () => close(val) };
          el._onPin ? el._onPin(res) : close(val);
        }, 120);
      } else if (b.hasAttribute('data-del')) { val = val.slice(0, -1); paint(); }
      else if (b.hasAttribute('data-x') && canCancel) close(null);
      else if (b.hasAttribute('data-reset')) el._onReset?.();
    });
    el._resolve = close;
    resolve.el = el;
    pinPad.last = el;
  });
}

export async function setupPasscode() {
  const a = await pinPad({ title: 'Bikin PIN' });
  if (!a) return false;
  const b = await pinPad({ title: 'Ulangi PIN' });
  if (!b) return false;
  if (a !== b) { toast('PIN nggak sama'); return false; }
  api.setSetting('passcode', a);
  
  return true;
}

let locked = false;
export function lockApp() {
  const pin = api.settings().passcode;
  if (!pin || locked) return;
  locked = true;
  document.activeElement?.blur?.();
  const p = pinPad({ title: 'Masukkan PIN', canCancel: false, extra: `<button class="lock-forgot" data-reset>Lupa PIN?</button>` });
  const el = pinPad.last;
  el.classList.add('instant');
  el._onPin = res => { if (res.pin === pin) { locked = false; res.done(); } else res.fail(); };
  el._onReset = async () => {
    if (await confirmBox({ title: 'Lupa PIN?', text: 'Di versi demo, satu-satunya cara adalah reset semua data.', ok: 'Reset data', danger: true })) {
      api.reset(); location.reload();
    }
  };
  return p;
}

let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (!api.ready) return;
  if (document.hidden) hiddenAt = Date.now();
  else if (hiddenAt && Date.now() - hiddenAt > 30e3) lockApp();
});

/* ================= WAKTU ================= */
export function fmtWhen(ts) {
  const d = new Date(ts), now = new Date();
  const t = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(':', '.');
  const day0 = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day0(d) - day0(now)) / 864e5);
  if (diff === 0) return `Hari ini ${t}`;
  if (diff === 1) return `Besok ${t}`;
  if (diff === -1) return `Kemarin ${t}`;
  return `${d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })} ${t}`;
}
const toLocalInput = ts => { const d = new Date(ts - new Date().getTimezoneOffset() * 60e3); return d.toISOString().slice(0, 16); };

/* ================= PESAN TERJADWAL ================= */
export function scheduleSheet(onPick, onEffect) {
  const FX = [['confetti', '🎉'], ['hearts', '💖'], ['fireworks', '🎆'], ['balloons', '🎈'], ['snow', '❄️']];
  const now = Date.now();
  const tomorrow8 = new Date(); tomorrow8.setDate(tomorrow8.getDate() + 1); tomorrow8.setHours(8, 0, 0, 0);
  const opts = [['1 menit', now + 60e3], ['1 jam', now + 3600e3], ['Besok 08.00', tomorrow8.getTime()]];
  sheet({
    top: `<div class="sched-pick">
      ${onEffect ? `<div class="sp-head">${icon('sparkle')} Efek</div><div class="sp-fx">${FX.map(([k, e]) => `<button data-fx="${k}">${e}</button>`).join('')}</div>` : ''}
      <div class="sp-head">${icon('clock')} Kirim nanti</div>
      <div class="sp-opts">${opts.map(([l, t], i) => `<button data-i="${i}" class="sp-opt">${l}</button>`).join('')}</div>
      <div class="sp-custom"><input type="datetime-local" class="field" min="${toLocalInput(now)}" value="${toLocalInput(now + 30 * 60e3)}"><button class="btn primary sm" data-custom>${icon('check')}</button></div>
    </div>`,
    onMount: (s, close) => {
      s.querySelectorAll('[data-fx]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); close(); onEffect(b.dataset.fx); }));
      s.querySelectorAll('.sp-opt').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); onPick(opts[+b.dataset.i][1]); close(); toast('Dijadwalkan ⏰'); }));
      s.querySelector('[data-custom]').addEventListener('click', e => {
        e.stopPropagation();
        const v = new Date(s.querySelector('input').value).getTime();
        if (!v || v < Date.now()) return toast('Pilih waktu nanti');
        onPick(v); close(); toast('Dijadwalkan ⏰');
      });
    },
  });
}

/* ================= EVENT ================= */
export function EventComposeScreen(chatId) {
  const def = new Date(); def.setDate(def.getDate() + 1); def.setHours(19, 0, 0, 0);
  const EMO = ['📅', '🎉', '🍕', '🎤', '📚', '⚽', '🎬', '☕'];
  let emo = EMO[0];
  const el = h(`<div class="sub-screen">
    ${navbar('Event', `<button class="text-btn" data-act="send" disabled>Kirim</button>`)}
    <div class="content pad">
      <div class="ng-row"><button class="ng-emoji" data-act="emo">${emo}</button><input class="field" name="title" maxlength="60" placeholder="Nama event"></div>
      <label class="lbl">${icon('clock', 'tiny')}</label>
      <input class="field" type="datetime-local" name="at" value="${toLocalInput(def.getTime())}">
      <label class="lbl">${icon('location', 'tiny')}</label>
      <input class="field" name="place" maxlength="60" placeholder="Tempat (opsional)">
    </div>
  </div>`);
  const title = $('[name=title]', el), btn = $('[data-act=send]', el);
  title.addEventListener('input', () => { btn.disabled = !title.value.trim(); });
  bindActs(el, {
    emo: t => { emo = EMO[(EMO.indexOf(emo) + 1) % EMO.length]; t.textContent = emo; vibrate(5); },
    send: () => {
      const at = new Date($('[name=at]', el).value).getTime();
      if (!title.value.trim() || !at) return;
      api.createEvent(chatId, { title: `${emo} ${title.value.trim()}`, at, place: $('[name=place]', el).value.trim() });
      router.back();
    },
  });
  setTimeout(() => title.focus(), 350);
  return { el };
}

/* ================= CATATAN GRUP ================= */
export function NotesScreen(chatId) {
  const el = h(`<div class="sub-screen">${navbar('Catatan', `<button class="icon-btn" data-act="new">${icon('plus')}</button>`)}<div class="content notes-body"></div></div>`);
  const body = $('.notes-body', el);
  function render() {
    const list = api.notes(chatId);
    body.innerHTML = list.length ? list.map(n => { const u = api.user(n.from); return `<button class="note-card" data-act="open" data-id="${n.id}">
      <div class="note-head">${avatar(u, 28)}<b>${esc(n.from === ME ? 'Kamu' : u?.name)}</b><small>${ago(n.ts)}</small></div>
      <p>${esc(n.text)}</p></button>`; }).join('') : empty('📝', 'Belum ada catatan');
  }
  async function editNote(n) {
    const v = await promptBox({ title: n ? 'Edit catatan' : 'Catatan baru', value: n?.text || '', max: 1000 });
    if (!v) return;
    n ? api.updateNote(chatId, n.id, v) : api.addNote(chatId, v);
  }
  bindActs(el, {
    new: () => editNote(),
    open: t => {
      const n = api.notes(chatId).find(x => x.id === t.dataset.id);
      if (!n) return;
      const acts = [{ label: 'Salin', icon: 'copy', run: async () => { await copyText(n.text); toast('Disalin'); } },
        { label: 'Keep', icon: 'bookmark', run: () => { api.keepAdd({ type: 'note', text: n.text, source: api.chatTitle(api.chat(chatId)) }); toast('Disimpan 🔖'); } }];
      if (n.from === ME) acts.push({ label: 'Edit', icon: 'edit', run: () => editNote(n) }, { label: 'Hapus', icon: 'trash', danger: true, run: () => api.deleteNote(chatId, n.id) });
      sheet({ top: `<p class="sheet-note">${esc(n.text)}</p>`, actions: acts });
    },
  });
  const off = bus.on('notes', id => id === chatId && render());
  render();
  return { el, destroy: off };
}

/* ================= TOKO STICKER ================= */
export function StickerStoreScreen() {
  const el = h(`<div class="sub-screen">${navbar('Sticker')}<div class="content store-body"></div></div>`);
  const body = $('.store-body', el);
  const items = p => p.stickers.map(s => (Array.isArray(s) ? s : [s]));
  function render() {
    body.innerHTML = `<div class="store-grid">${api.storePacks().map(p => {
      const own = api.ownsPack(p.id);
      return `<div class="pack-card" style="--h:${p.hue}">
        <button class="pack-cover" data-act="preview" data-id="${p.id}"><span class="${p.anim ? 'anim-bounce' : ''}">${p.cover}</span>${p.anim ? `<i class="pack-tag">${icon('sparkle', 'tiny')}</i>` : ''}</button>
        <b>${esc(p.name)}</b>
        <button class="pack-btn ${own ? 'owned' : ''}" data-act="${own ? 'remove' : 'get'}" data-id="${p.id}">${own ? icon('check') : icon('download')}</button>
      </div>`;
    }).join('')}</div>`;
  }
  function preview(p) {
    const own = api.ownsPack(p.id);
    sheet({
      title: p.name,
      top: `<div class="sticker-grid preview">${items(p).map(([s, a]) => `<div>${a ? `<span class="anim-${a}">${s}</span>` : s}</div>`).join('')}</div>`,
      actions: own ? [] : [{ label: 'Download gratis', icon: 'download', run: () => get(p.id) }],
    });
  }
  function get(id) {
    const btn = body.querySelector(`.pack-btn[data-id="${id}"]`);
    if (btn) { btn.classList.add('loading'); btn.innerHTML = '<i class="spin"></i>'; }
    setTimeout(() => { api.addPack(id); vibrate(10); toast('Sticker siap dipakai ✨'); }, 900);
  }
  bindActs(el, {
    preview: t => preview(api.storePacks().find(p => p.id === t.dataset.id)),
    get: t => get(t.dataset.id),
    remove: async t => { if (await confirmBox({ title: 'Hapus paket ini?', ok: 'Hapus', danger: true })) api.removePack(t.dataset.id); },
  });
  const off = bus.on('packs', render);
  render();
  return { el, destroy: off };
}

/* ================= NOTIFIKASI / AKTIVITAS ================= */
const ACT = {
  like: ['heart', '#FF3D6E', a => a.text === 'story' ? 'suka story kamu' : 'suka post kamu'],
  comment: ['comment', '#2E7BFF', a => `komentar: ${a.text}`],
  reply: ['comment', '#2E7BFF', a => `balas: ${a.text}`],
  mention: ['chat', '#7C5CFF', a => `nyebut kamu: ${a.text}`],
  friend: ['userPlus', '#0FB46C', () => 'nambahin kamu jadi teman'],
  missed: ['phoneOff', '#FF3B5C', a => `panggilan ${a.text || ''} tak terjawab`],
  story: ['voom', '#FF7A1A', a => `bales story: ${a.text}`],
};
export function ActivityScreen() {
  const el = h(`<div class="sub-screen">${navbar('Notifikasi', `<button class="icon-btn" data-act="clear" aria-label="Hapus semua">${icon('trash')}</button>`)}<div class="content act-body"></div></div>`);
  const body = $('.act-body', el);
  let firstUnread = new Set(api.activity().filter(a => !a.read).map(a => a.id));
  function row(a) {
    const u = api.user(a.from);
    const [ic, col, txt] = ACT[a.type] || ACT.like;
    const right = a.type === 'friend'
      ? (api.isFriend(a.from) ? `<span class="pill">Teman</span>` : `<button class="btn primary sm" data-act="add" data-id="${a.from}">Tambah</button>`)
      : '';
    return `<div class="list-item act ${firstUnread.has(a.id) ? 'new' : ''}" data-act="go" data-id="${a.id}">
      <div class="act-av">${avatar(u, 46)}<span class="act-ic" style="--c:${col}">${icon(ic)}</span></div>
      <div class="li-main"><div class="act-txt"><b>${esc(firstName(u.name))}</b> ${esc(txt(a))}</div><div class="li-sub">${ago(a.ts)}</div></div>
      ${right}
    </div>`;
  }
  function render() {
    const list = api.activity();
    if (!list.length) { body.innerHTML = empty('🔔', 'Belum ada notifikasi'); return; }
    const fresh = list.filter(a => firstUnread.has(a.id)), old = list.filter(a => !firstUnread.has(a.id));
    body.innerHTML = (fresh.length ? `<div class="section-h">Baru</div>${fresh.map(row).join('')}` : '')
      + (old.length ? `<div class="section-h">Sebelumnya</div>${old.map(row).join('')}` : '');
  }
  bindActs(el, {
    add: (t, e) => { e.stopPropagation(); api.addFriend(t.dataset.id); vibrate(8); toast('Ditambahkan 🎉'); render(); },
    clear: async () => { if (await confirmBox({ title: 'Hapus semua notifikasi?', ok: 'Hapus', danger: true })) api.clearActivity(); },
    go: async t => {
      const a = api.activity().find(x => x.id === t.dataset.id);
      if (!a) return;
      const scr = await import('./screens.js');
      if (a.ref?.postId && api.post(a.ref.postId)) router.push(scr.PostDetailScreen(a.ref.postId));
      else if (a.ref?.chatId && api.chat(a.ref.chatId)) openChat(a.ref.chatId);
      else router.push(scr.ProfileScreen(a.from));
    },
  });
  const off = bus.on('activity', render);
  render();
  setTimeout(() => api.markActivityRead(), 600);
  return { el, destroy: off };
}

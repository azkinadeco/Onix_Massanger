import { api, bus, ME, firstName } from './service.js';
import { $, $$, h, esc, avatar, listTime, playPop, vibrate, dur } from './util.js';
import { icon } from './icons.js';
import { router, bindActs, onLongPress, toast, sheet, confirmBox, banner, initViewport } from './ui.js';
import { userAvatar, chatAvatar, chatRow, userRow, postCard, empty, preview } from './views.js';
import { openChat, startCall } from './chat.js';
import { clearMedia } from './media.js';
import { KeepScreen, ArchivedScreen, setupPasscode, lockApp } from './features.js';
import {
  OnboardingScreen, ProfileScreen, EditProfileScreen, AddFriendScreen, NewGroupScreen, FriendPicker,
  PostComposeScreen, postActions, openStories, addStoryFlow,
} from './screens.js';

/* ---------- theme ---------- */
const mq = matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
  const s = api.settings();
  const root = document.documentElement;
  root.dataset.accent = s.accent || 'violet';
  root.dataset.font = s.fontSize || 'm';
  const dark = s.theme === 'dark' || (s.theme !== 'light' && mq.matches);
  root.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#0B0B10' : '#F7F7F9');
  try { localStorage.setItem('onix:theme', JSON.stringify({ theme: root.dataset.theme, accent: root.dataset.accent })); } catch { /* */ }
}
mq.addEventListener?.('change', applyTheme);

/* ================= TABS ================= */
const TABS = [
  { id: 'home', icon: 'home', label: 'Home' },
  { id: 'chats', icon: 'chat', label: 'Chat' },
  { id: 'voom', icon: 'voom', label: 'VOOM' },
  { id: 'calls', icon: 'phone', label: 'Panggilan' },
  { id: 'me', icon: 'user', label: 'Kamu' },
];

function TabsScreen() {
  const el = h(`<div class="tabs-screen">
    <div class="tab-head"></div>
    <div class="content tab-body"></div>
    <nav class="tabbar">${TABS.map(t => `<button class="tab" data-tab="${t.id}" aria-label="${t.label}">${icon(t.icon)}<b class="badge" hidden></b></button>`).join('')}</nav>
  </div>`);
  const head = $('.tab-head', el), body = $('.tab-body', el);
  let cur = 'chats';
  const st = { homeQ: '', chatQ: '', filter: 'all' };
  const scrollPos = {};
  const title = (t, actions = '') => `<div class="th-row"><h1>${t}</h1><div class="th-actions">${actions}</div></div>`;
  const searchBox = (k, ph) => `<div class="search">${icon('search')}<input data-q="${k}" placeholder="${ph}" value="${esc(st[k])}"></div>`;

  /* ----- HOME ----- */
  const home = {
    head: () => title('Home', `<button class="icon-btn" data-act="add-friend" aria-label="Tambah teman">${icon('userPlus')}</button>`) + searchBox('homeQ', 'Cari'),
    body: () => {
      const q = st.homeQ.trim().toLowerCase();
      const friends = api.friends().filter(u => !q || u.name.toLowerCase().includes(q) || u.id.includes(q));
      const groups = api.groups().filter(g => !q || g.name.toLowerCase().includes(q));
      const favs = q ? [] : api.favorites();
      const me = api.me();
      const my = api.storyOf(ME);
      const row = u => `<div class="list-item slim" data-act="profile" data-id="${u.id}">${userAvatar(u, 42, { online: true })}<div class="li-main"><div class="li-name">${esc(u.name)}</div></div></div>`;
      return `${q ? '' : `
        <div class="stories">
          <button class="story-item" data-act="${my ? 'my-story' : 'add-story'}"><div class="story-av ${my ? 'has seen' : ''}">${avatar(me, 58)}${my ? '' : `<span class="plus">${icon('plus')}</span>`}</div><small>Kamu</small></button>
          ${api.stories().map(s => { const u = api.user(s.userId); return `<button class="story-item" data-act="story" data-id="${u.id}"><div class="story-av has ${s.seen ? 'seen' : ''}">${avatar(u, 58)}</div><small>${esc(firstName(u.name))}</small></button>`; }).join('')}
        </div>`}
        ${favs.length ? `<div class="section-h">Favorit</div><div class="fav-row">${favs.map(u => `<button data-act="profile" data-id="${u.id}">${userAvatar(u, 52, { online: true })}<small>${esc(firstName(u.name))}</small></button>`).join('')}</div>` : ''}
        ${groups.length ? `<div class="section-h">Grup</div>${groups.map(g => `<div class="list-item slim" data-act="open-chat" data-id="${g.id}">${chatAvatar(g, 42)}<div class="li-main"><div class="li-name">${esc(g.name)}</div></div><span class="count">${g.members.length}</span></div>`).join('')}` : ''}
        <div class="section-h">Teman <span class="n">${friends.length}</span></div>
        ${friends.map(row).join('') || empty('🔍', 'Nggak ketemu')}`;
    },
  };

  /* ----- CHATS ----- */
  const FILTERS = [['all', 'Semua'], ['unread', 'Belum dibaca'], ['groups', 'Grup']];
  const chats = {
    head: () => title('Chat', `<button class="icon-btn" data-act="compose-menu" aria-label="Baru">${icon('compose')}</button>`) + searchBox('chatQ', 'Cari')
      + `<div class="chips scroll-x">${FILTERS.map(([k, l]) => `<button class="chip ${st.filter === k ? 'on' : ''}" data-act="filter" data-f="${k}">${l}</button>`).join('')}</div>`,
    body: () => {
      const q = st.chatQ.trim().toLowerCase();
      let list = api.chats();
      if (st.filter === 'unread') list = list.filter(c => c.unread);
      if (st.filter === 'groups') list = list.filter(c => c.type === 'group');
      if (q) {
        const byName = list.filter(c => api.chatTitle(c).toLowerCase().includes(q));
        const hits = [];
        api.chats().forEach(c => api.messages(c.id).forEach(m => { if (m.type === 'text' && !m.unsent && m.text.toLowerCase().includes(q)) hits.push({ c, m }); }));
        return byName.map(chatRow).join('')
          + (hits.length ? `<div class="section-h">Pesan</div>${hits.slice(-30).reverse().map(({ c, m }) => `<div class="list-item" data-act="open-chat" data-id="${c.id}">${chatAvatar(c, 46)}<div class="li-main"><div class="li-top"><span class="li-name">${esc(api.chatTitle(c))}</span><span class="li-time">${listTime(m.ts)}</span></div><div class="li-sub">${hl(preview(m, c), q)}</div></div></div>`).join('')}` : '')
          + (!byName.length && !hits.length ? empty('🔍', 'Nggak ada hasil') : '');
      }
      const arc = st.filter === 'all' ? api.archived() : [];
      const arcRow = arc.length ? `<div class="list-item arc-row" data-act="archived"><span class="round-ic">${icon('archive')}</span><div class="li-main"><div class="li-name">Arsip</div></div><span class="count">${arc.length}</span>${arc.some(c => c.unread) ? '<i class="arc-dot"></i>' : ''}</div>` : '';
      if (!list.length) return arcRow + (st.filter === 'unread' ? empty('✅', 'Semua udah kebaca') : empty('💬', 'Belum ada chat'));
      return arcRow + list.map(chatRow).join('');
    },
  };
  const hl = (text, q) => { const t = esc(text); const i = t.toLowerCase().indexOf(esc(q)); return i < 0 ? t : t.slice(0, i) + '<mark>' + t.slice(i, i + esc(q).length) + '</mark>' + t.slice(i + esc(q).length); };

  /* ----- VOOM ----- */
  const voom = {
    head: () => title('VOOM', `<button class="icon-btn" data-act="compose-post" aria-label="Post baru">${icon('plus')}</button>`),
    body: () => `<button class="composer-card" data-act="compose-post">${avatar(api.me(), 36)}<span>Bagikan sesuatu…</span>${icon('image')}</button>`
      + api.posts().map(p => postCard(p)).join(''),
  };

  /* ----- CALLS ----- */
  const calls = {
    head: () => title('Panggilan', `<button class="icon-btn" data-act="new-call" aria-label="Telepon">${icon('plus')}</button>`),
    body: () => {
      const list = api.calls();
      const favs = api.favorites();
      const quick = favs.length ? `<div class="fav-row calls">${favs.map(u => `<button data-act="qcall" data-id="${u.id}">${userAvatar(u, 52, { online: true })}<small>${esc(firstName(u.name))}</small></button>`).join('')}</div>` : '';
      if (!list.length) return quick + empty('📞', 'Belum ada panggilan');
      return quick + `<div class="section-h">Terbaru <button class="icon-btn sm link-ic" data-act="clear-calls" aria-label="Hapus">${icon('trash')}</button></div>` + list.map(cl => {
        const c = api.chat(cl.chatId);
        if (!c) return '';
        const missed = cl.status !== 'done';
        return `<div class="list-item" data-act="open-chat" data-id="${c.id}">${chatAvatar(c, 46, { online: false })}
          <div class="li-main"><div class="li-name ${missed && cl.dir === 'in' ? 'danger-txt' : ''}">${esc(api.chatTitle(c))}</div><div class="li-sub call-sub">${icon(cl.dir === 'in' ? 'inArrow' : 'outArrow', 'tiny ' + (missed ? 'danger-txt' : 'ok-txt'))}${listTime(cl.ts)}${cl.status === 'done' ? ' · ' + dur(cl.duration) : ''}</div></div>
          <button class="icon-btn accent-txt" data-act="recall" data-id="${c.id}" data-v="${cl.video ? 1 : 0}">${icon(cl.video ? 'video' : 'phone')}</button></div>`;
      }).join('');
    },
  };

  /* ----- ME ----- */
  const ACCENTS = [['violet', '#7C5CFF'], ['blue', '#2E7BFF'], ['pink', '#FF3D81'], ['green', '#0FB46C'], ['orange', '#FF6B1A']];
  const meTab = {
    head: () => title('Kamu'),
    body: () => {
      const me = api.me(), s = api.settings();
      const toggle = (k, label, ic) => `<label class="set-row">${icon(ic)}<div class="set-txt"><span>${label}</span></div><input type="checkbox" class="switch" data-set="${k}" ${s[k] ? 'checked' : ''}></label>`;
      const link = (act, ic, label, extra = '') => `<button class="set-row" data-act="${act}">${icon(ic)}<div class="set-txt"><span>${label}</span></div>${extra}${icon('chevronRight', 'tiny')}</button>`;
      return `<div class="me-hero" style="--h:${me.hue}">
          <button data-act="open-me">${avatar(me, 84)}</button>
          <h2>${esc(me.name)}</h2><span>@${esc(me.id)}</span>
          <div class="me-btns">
            <button class="round-btn" data-act="edit-profile" aria-label="Edit profil">${icon('edit')}</button>
            <button class="round-btn" data-act="my-qr" aria-label="QR">${icon('qr')}</button>
            <button class="round-btn" data-act="add-story" aria-label="Story">${icon('plus')}</button>
          </div>
        </div>
        <div class="set-group">
          <div class="set-row">${icon('moon')}<div class="set-txt"><span>Tema</span></div>
            <div class="seg sm icons">${[['system', 'sparkle'], ['light', 'sun'], ['dark', 'moon']].map(([k, ic]) => `<button class="${s.theme === k ? 'on' : ''}" data-act="theme" data-v="${k}" aria-label="${k}">${icon(ic)}</button>`).join('')}</div></div>
          <div class="set-row">${icon('palette')}<div class="set-txt"><span>Aksen</span></div>
            <div class="swatches">${ACCENTS.map(([k, c]) => `<button class="${s.accent === k ? 'on' : ''}" style="--c:${c}" data-act="accent" data-v="${k}" aria-label="${k}"></button>`).join('')}</div></div>
          <div class="set-row">${icon('type')}<div class="set-txt"><span>Teks</span></div>
            <div class="seg sm fs">${[['s', 13], ['m', 16], ['l', 19]].map(([k, px]) => `<button class="${s.fontSize === k ? 'on' : ''}" data-act="font" data-v="${k}" style="font-size:${px}px">A</button>`).join('')}</div></div>
        </div>
        <div class="set-group">
          ${link('keep', 'bookmark', 'Keep', `<span class="count">${api.keep().length || ''}</span>`)}
          ${link('archived', 'archive', 'Arsip', `<span class="count">${api.archived().length || ''}</span>`)}
        </div>
        <div class="set-group">
          <label class="set-row">${icon('lock')}<div class="set-txt"><span>Kunci PIN</span></div><input type="checkbox" class="switch" data-lock ${s.passcode ? 'checked' : ''}></label>
          ${toggle('notif', 'Notifikasi', 'bell')}
          ${toggle('sound', 'Suara', 'volume')}
        </div>
        <div class="set-group">
          ${link('demo', 'sparkle', 'Demo')}
          <button class="set-row danger-txt" data-act="logout">${icon('logout')}<div class="set-txt"><span>Keluar</span></div></button>
        </div>
        <div class="tab-end"></div>`;
    },
  };

  const VIEWS = { home, chats, voom, calls, me: meTab };

  function renderHead() { head.innerHTML = VIEWS[cur].head(); }
  function renderBody() { body.innerHTML = VIEWS[cur].body(); }
  function renderBadges() {
    const n = api.totalUnread();
    const b = $('.tab[data-tab=chats] .badge', el);
    b.hidden = !n; b.textContent = n > 99 ? '99+' : n;
    const missed = 0;
    $('.tab[data-tab=calls] .badge', el).hidden = !missed;
  }
  function switchTab(id) {
    if (id === cur) { body.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    scrollPos[cur] = body.scrollTop;
    cur = id;
    $$('.tab', el).forEach(t => t.classList.toggle('active', t.dataset.tab === id));
    el.dataset.tab = id;
    renderHead(); renderBody();
    body.scrollTop = scrollPos[id] || 0;
    vibrate(4);
  }

  let rq = 0;
  const schedule = () => { cancelAnimationFrame(rq); rq = requestAnimationFrame(() => { renderBody(); renderBadges(); }); };
  const watch = {
    home: ['friends', 'chats', 'stories', 'me', 'presence'],
    chats: ['chats', 'presence'],
    voom: ['posts', 'me'],
    calls: ['calls', 'friends'],
    me: ['me', 'settings', 'keep', 'chats'],
  };
  const offs = ['friends', 'chats', 'stories', 'me', 'presence', 'posts', 'calls', 'settings', 'keep'].map(ev => bus.on(ev, () => {
    if (ev === 'chats') renderBadges();
    if (watch[cur].includes(ev)) schedule();
    if (ev === 'me' && (cur === 'home' || cur === 'voom')) renderHead();
  }));

  head.addEventListener('input', e => {
    const k = e.target.dataset.q;
    if (k) { st[k] = e.target.value; renderBody(); }
  });
  body.addEventListener('change', async e => {
    if (e.target.hasAttribute('data-lock')) {
      if (e.target.checked) { const ok = await setupPasscode(); if (!ok) e.target.checked = false; }
      else if (await confirmBox({ title: 'Matikan kunci aplikasi?', ok: 'Matikan', danger: true })) { api.setSetting('passcode', null); }
      else e.target.checked = true;
      return;
    }
    const k = e.target.dataset.set;
    if (!k) return;
    api.setSetting(k, e.target.checked);
    vibrate(5);
  });
  $('.tabbar', el).addEventListener('click', e => { const t = e.target.closest('.tab'); if (t) switchTab(t.dataset.tab); });

  const handlers = {
    'open-me': () => router.push(ProfileScreen(ME)),
    'add-friend': () => router.push(AddFriendScreen()),
    'new-group': () => router.push(NewGroupScreen()),
    'new-chat': () => router.push(FriendPicker({ title: 'Chat baru', onDone: ([id]) => { history.back(); setTimeout(() => openChat(api.directWith(id).id), 350); } })),
    'new-call': () => router.push(FriendPicker({ title: 'Telepon siapa?', onDone: ([id]) => { history.back(); setTimeout(() => startCall(api.directWith(id).id, false), 350); } })),
    'open-chat': t => openChat(t.dataset.id),
    profile: t => router.push(ProfileScreen(t.dataset.id)),
    'compose-menu': () => sheet({ actions: [
      { label: 'Chat baru', icon: 'chat', run: handlers['new-chat'] },
      { label: 'Grup baru', icon: 'users', run: handlers['new-group'] },
    ] }),
    demo: () => {
      const s = api.settings();
      sheet({ actions: [
        { label: 'Pesan masuk', icon: 'chat', run: () => setTimeout(() => api.simulateIncoming(), 800) },
        { label: 'Telepon masuk', icon: 'phone', run: () => setTimeout(() => api.simulateIncomingCall(false), 1500) },
        { label: 'Video call masuk', icon: 'video', run: () => setTimeout(() => api.simulateIncomingCall(true), 1500) },
        { label: 'Grup call masuk', icon: 'users', run: () => setTimeout(() => api.simulateIncomingCall(false, true), 1500) },
        { label: s.simulate ? 'Matikan pesan otomatis' : 'Nyalakan pesan otomatis', icon: 'refresh', run: () => api.setSetting('simulate', !s.simulate) },
        { label: 'Reset data', icon: 'trash', danger: true, run: handlers.reset },
      ] });
    },
    story: t => { const ids = api.stories().map(s => s.userId); openStories(ids, Math.max(0, ids.indexOf(t.dataset.id))); },
    'my-story': () => sheet({ actions: [{ label: 'Lihat', icon: 'voom', run: () => openStories([ME]) }, { label: 'Tambah', icon: 'plus', run: addStoryFlow }] }),
    'add-story': addStoryFlow,
    filter: t => { st.filter = t.dataset.f; renderHead(); renderBody(); },
    'compose-post': () => router.push(PostComposeScreen()),
    qcall: t => startCall(api.directWith(t.dataset.id).id, false),
    recall: (t, e) => { e.stopPropagation(); startCall(t.dataset.id, t.dataset.v === '1'); },
    'clear-calls': async () => { if (await confirmBox({ title: 'Hapus riwayat panggilan?', ok: 'Hapus', danger: true })) api.clearCalls(); },
    'edit-profile': () => router.push(EditProfileScreen()),
    keep: () => router.push(KeepScreen()),
    archived: () => router.push(ArchivedScreen()),
    font: t => { api.setSetting('fontSize', t.dataset.v); applyTheme(); vibrate(5); },
    'my-qr': () => router.push(AddFriendScreen('qr')),
    theme: t => { api.setSetting('theme', t.dataset.v); applyTheme(); },
    accent: t => { api.setSetting('accent', t.dataset.v); applyTheme(); vibrate(6); },
    reset: async () => {
      if (!(await confirmBox({ title: 'Reset semua data?', ok: 'Reset', danger: true }))) return;
      clearMedia();
      const me = api.me();
      api.reset(); api.register({ name: me.name, id: me.id });
      location.reload();
    },
    logout: async () => {
      if (!(await confirmBox({ title: 'Keluar?', text: 'Data demo di HP ini akan dihapus.', ok: 'Keluar', danger: true }))) return;
      clearMedia();
      api.reset(); location.reload();
    },
    ...postActions(),
  };
  bindActs(el, handlers);

  onLongPress(body, '.chat-item', item => {
    const c = api.chat(item.dataset.id);
    sheet({
      actions: [
        { label: c.pinned ? 'Lepas pin' : 'Pin', icon: 'pin', run: () => api.togglePin(c.id) },
        { label: c.muted ? 'Bunyikan' : 'Bisukan', icon: c.muted ? 'bell' : 'bellOff', run: () => api.toggleMute(c.id) },
        { label: 'Arsipkan', icon: 'archive', run: () => api.toggleArchive(c.id) },
        c.unread ? { label: 'Tandai dibaca', icon: 'check', run: () => api.markRead(c.id) } : { label: 'Tandai belum dibaca', icon: 'chat', run: () => api.markUnread(c.id) },
        { label: 'Hapus', icon: 'trash', danger: true, run: async () => { if (await confirmBox({ title: 'Hapus chat ini?', ok: 'Hapus', danger: true })) api.deleteChat(c.id); } },
      ],
    });
  });

  // render awal
  $$('.tab', el).forEach(t => t.classList.toggle('active', t.dataset.tab === cur));
  el.dataset.tab = cur;
  renderHead(); renderBody(); renderBadges();

  return {
    el,
    show() { renderBody(); renderBadges(); },
    destroy() { offs.forEach(f => f()); },
  };
}

/* ================= BOOT ================= */
function startApp() {
  applyTheme();
  router.setRoot(TabsScreen());
  lockApp();
}

bus.on('settings', applyTheme);
bus.on('notify', ({ chat, msg, mention }) => {
  const s = api.settings();
  if (router.top()?.chatId === chat.id) return;
  if (s.sound) playPop();
  vibrate(10);
  if (!s.notif) return;
  const u = api.user(msg.from);
  const title = chat.type === 'group' ? `${mention ? '@ ' : ''}${chat.name}` : u?.name;
  const text = (chat.type === 'group' ? firstName(u?.name) + ': ' : '') + preview(msg, chat).replace(/^Kamu: /, '');
  banner({ title, text, avatarHtml: chatAvatar(chat, 40, { online: false }), onTap: () => openChat(chat.id) });
});
bus.on('incoming-call', ({ chatId, video }) => startCall(chatId, video, true));
bus.on('storage-full', () => toast('Memori penuh'));

initViewport();
history.replaceState({ depth: 1 }, '');
if (api.ready) startApp();
else {
  applyTheme();
  router.setRoot(OnboardingScreen(startApp));
}
document.getElementById('splash')?.remove();

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

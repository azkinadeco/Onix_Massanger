import { api, bus, ME, firstName } from './service.js';
import { $, $$, h, esc, avatar, listTime, playPop, vibrate, dur } from './util.js';
import { icon } from './icons.js';
import { router, bindActs, onLongPress, toast, sheet, confirmBox, banner, initViewport } from './ui.js';
import { userAvatar, chatAvatar, chatRow, userRow, postCard, empty, preview } from './views.js';
import { openChat, startCall } from './chat.js';
import { clearMedia } from './media.js';
import { OnlineScreen, handleJoinLink } from './online.js';
import * as backend from './backend.js';
import * as fun from './fun.js';
import { KeepScreen, ArchivedScreen, setupPasscode, lockApp, StickerStoreScreen, ActivityScreen, hideChat, openHiddenChats, StorageScreen, moodRow, setMoodSheet, viewMoodSheet, WalletScreen, BackupScreen } from './features.js';
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
  if (s.skin && s.skin !== 'onix') root.dataset.skin = s.skin; else delete root.dataset.skin;
  root.dataset.font = s.fontSize || 'm';
  const dark = s.theme === 'dark' || (s.theme !== 'light' && mq.matches);
  root.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#0B0B10' : '#F7F7F9');
  try { localStorage.setItem('onix:theme', JSON.stringify({ theme: root.dataset.theme, accent: root.dataset.accent, skin: root.dataset.skin || '' })); } catch { /* */ }
}
mq.addEventListener?.('change', applyTheme);

/* ---------- gaya (skin) ala tema LINE ---------- */
const SKINS = [['onix', 'Onix', '#7C5CFF', '#7C5CFF'], ['matcha', 'Matcha', '#3FA672', '#EEF5EC'], ['sakura', 'Sakura', 'linear-gradient(135deg,#FF8FB8,#FF6FA5)', '#FFF0F5'], ['ocean', 'Laut', 'linear-gradient(135deg,#3BA0FF,#5B6CFF)', '#EAF3FF'], ['mono', 'Mono', '#15151C', '#F2F2F2'], ['retro', 'Retro', '#E86A33', '#FBF3E4'], ['neon', 'Neon', 'linear-gradient(135deg,#FF2BD6,#7C3BFF)', '#14102A']];
function skinSheet() {
  const cur = api.settings().skin || 'onix';
  sheet({
    title: 'Gaya',
    top: `<div class="skin-grid">${SKINS.map(([k, l, me, bg]) => `<button class="skin-card ${k === cur ? 'on' : ''}" data-k="${k}" data-skin-prev="${k}"><span class="sk-bg" style="background:${bg}"><i class="sk-them"></i><i class="sk-me" style="background:${me}"></i><i class="sk-them s"></i></span><small>${l}</small></button>`).join('')}</div>`,
    onMount: (s, close) => s.querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); api.setSetting('skin', b.dataset.k); vibrate(6); close(); toast('Gaya ' + b.querySelector('small').textContent + ' ✨'); })),
  });
}

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
    <button class="fab" data-act="fab" aria-label="Baru"><span class="fab-ic" data-for="chats">${icon('compose')}</span><span class="fab-ic" data-for="calls">${icon('phone')}</span><span class="fab-ic" data-for="voom">${icon('plus')}</span></button>
    <nav class="tabbar"><i class="tab-pill"></i>${TABS.map(t => `<button class="tab" data-tab="${t.id}" aria-label="${t.label}">${icon(t.icon)}<b class="badge" hidden></b></button>`).join('')}</nav>
  </div>`);
  const head = $('.tab-head', el), body = $('.tab-body', el);
  let cur = 'chats';
  const st = { homeQ: '', chatQ: '', filter: 'all', feed: 'foryou' };
  const scrollPos = {};
  const title = (t, actions = '') => `<div class="th-row"><h1>${t}</h1><div class="th-actions">${actions}</div></div>`;
  const searchBox = (k, ph) => `<div class="search">${icon('search')}<input data-q="${k}" placeholder="${ph}" value="${esc(st[k])}"></div>`;

  /* ----- HOME ----- */
  const home = {
    head: () => title('Home', `<button class="icon-btn bell" data-act="activity" aria-label="Notifikasi">${icon('bell')}<i class="bell-dot" ${api.unreadActivity() ? '' : 'hidden'}>${api.unreadActivity() || ''}</i></button><button class="icon-btn" data-act="add-friend" aria-label="Tambah teman">${icon('userPlus')}</button>`) + searchBox('homeQ', 'Cari'),
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
        ${q ? '' : bdays()}
        ${favs.length ? `<div class="section-h">Favorit</div><div class="fav-row">${favs.map(u => `<button data-act="profile" data-id="${u.id}">${userAvatar(u, 52, { online: true })}<small>${esc(firstName(u.name))}</small></button>`).join('')}</div>` : ''}
        ${groups.length ? `<div class="section-h">Grup</div>${groups.map(g => `<div class="list-item slim" data-act="open-chat" data-id="${g.id}">${chatAvatar(g, 42)}<div class="li-main"><div class="li-name">${esc(g.name)}</div></div><span class="count">${g.members.length}</span></div>`).join('')}` : ''}
        <div class="section-h">Teman <span class="n">${friends.length}</span></div>
        ${friends.map(row).join('') || empty('🔍', 'Nggak ketemu')}`;
    },
  };

  function bdays() {
    const list = api.birthdays();
    if (!list.length) return '';
    return `<div class="bday-row">${list.map(({ user: u, days }) => {
      const today = days === 0, done = api.wished(u.id);
      return `<div class="bday ${today ? 'today' : ''}">
        <button data-act="profile" data-id="${u.id}">${avatar(u, 40)}</button>
        <div class="bd-txt"><b>${esc(firstName(u.name))}</b><small>${today ? '🎂 Hari ini' : `🎂 ${days} hari lagi`}</small></div>
        ${today ? `<button class="bd-btn ${done ? 'done' : ''}" data-act="wish" data-id="${u.id}" ${done ? 'disabled' : ''} aria-label="Kirim ucapan">${icon(done ? 'check' : 'gift')}</button>` : ''}
      </div>`;
    }).join('')}</div>`;
  }

  /* ----- CHATS ----- */
  const FILTERS = [['all', 'Semua'], ['unread', 'Belum dibaca'], ['groups', 'Grup']];
  const chats = {
    head: () => title('Chat') + searchBox('chatQ', 'Cari')
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
        hits.sort((a, b) => b.m.ts - a.m.ts);
        if (api.remote.state() && q.length >= 3) { clearTimeout(srvT); srvT = setTimeout(() => backend.searchMessages(q), 400); }
        const people = api.findPeople(q).filter(u => !byName.some(c => c.type === 'direct' && api.peerOf(c)?.id === u.id)).slice(0, 6);
        const posts = api.posts().filter(p => (p.text || '').toLowerCase().includes(q)).slice(0, 5);
        const sec = (label, n, html) => n ? `<div class="section-h">${label}<span class="sh-n">${n}</span></div>${html}` : '';
        const out = sec('Chat', byName.length, byName.map(chatRow).join(''))
          + sec('Orang', people.length, people.map(u => userRow(u)).join(''))
          + sec('Pesan', hits.length, hits.slice(0, 40).map(({ c, m }) => `<div class="list-item" data-act="open-hit" data-id="${c.id}" data-mid="${m.id}">${chatAvatar(c, 46)}<div class="li-main"><div class="li-top"><span class="li-name">${esc(api.chatTitle(c))}</span><span class="li-time">${listTime(m.ts)}</span></div><div class="li-sub">${m.from === ME ? 'Kamu: ' : ''}${hl(snip(m.text, q), q)}</div></div></div>`).join(''))
          + sec('VOOM', posts.length, posts.map(p => { const u = api.user(p.userId); return `<div class="list-item" data-act="post" data-id="${p.id}">${userAvatar(u, 46)}<div class="li-main"><div class="li-name">${esc(u?.name || '')}</div><div class="li-sub">${hl(snip(p.text, q), q)}</div></div>${p.images?.[0] || p.image ? `<img class="sr-thumb" src="${p.images?.[0] || p.image}" alt="">` : ''}</div>`; }).join(''));
        return out || empty('🔍', 'Nggak ada hasil');
      }
      const arc = st.filter === 'all' ? api.archived() : [];
      const arcRow = arc.length ? `<div class="list-item arc-row" data-act="archived"><span class="round-ic">${icon('archive')}</span><div class="li-main"><div class="li-name">Arsip</div></div><span class="count">${arc.length}</span>${arc.some(c => c.unread) ? '<i class="arc-dot"></i>' : ''}</div>` : '';
      const moods = st.filter === 'all' ? moodRow() : '';
      if (!list.length) return moods + arcRow + (st.filter === 'unread' ? empty('✅', 'Semua udah kebaca') : empty('💬', 'Belum ada chat'));
      return moods + arcRow + list.map(chatRow).join('');
    },
  };
  let srvT = null;
  const snip = (text, q) => { const t = String(text || '').replace(/\s+/g, ' '); const i = t.toLowerCase().indexOf(q); return i > 28 ? '…' + t.slice(i - 20) : t; };
  const hl = (text, q) => { const t = esc(text); const i = t.toLowerCase().indexOf(esc(q)); return i < 0 ? t : t.slice(0, i) + '<mark>' + t.slice(i, i + esc(q).length) + '</mark>' + t.slice(i + esc(q).length); };

  /* ----- VOOM ----- */
  const voom = {
    head: () => title('VOOM', `<button class="icon-btn" data-act="compose-post" aria-label="Post baru">${icon('plus')}</button>`),
    body: () => `<div class="seg voom-tabs">${[['foryou', 'Untukmu'], ['following', 'Mengikuti']].map(([k, l]) => `<button class="${st.feed === k ? 'on' : ''}" data-act="feed" data-v="${k}">${l}</button>`).join('')}</div>`
      + `<button class="composer-card" data-act="compose-post">${avatar(api.me(), 36)}<span>Bagikan sesuatu…</span>${icon('image')}</button>`
      + (api.feed(st.feed).map(p => postCard(p)).join('') || empty('🌱', 'Belum ada post')),
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
      const DEF = { calm: true, undoSend: true, smart: true };
      const toggle = (k, label, ic) => `<label class="set-row">${icon(ic)}<div class="set-txt"><span>${label}</span></div><input type="checkbox" class="switch" data-set="${k}" ${(s[k] ?? DEF[k]) ? 'checked' : ''}></label>`;
      const link = (act, ic, label, extra = '') => `<button class="set-row" data-act="${act}">${icon(ic)}<div class="set-txt"><span>${label}</span></div>${extra}${icon('chevronRight', 'tiny')}</button>`;
      return `<div class="me-hero" style="--h:${me.hue}">
          <button data-act="open-me">${avatar(me, 84)}</button>
          <h2>${esc(me.name)}</h2><span>@${esc(me.id)}</span>
          ${(() => { const b = fun.myBadges().filter(x => x.got); return `<button class="me-badges" data-act="badges">${b.length ? b.slice(0, 6).map(x => `<span title="${esc(x.n)}">${x.e}</span>`).join('') + (b.length > 6 ? `<small>+${b.length - 6}</small>` : '') : '<small>🏅 Kumpulin lencana</small>'}</button>`; })()}
          <div class="me-btns">
            <button class="round-btn" data-act="edit-profile" aria-label="Edit profil">${icon('edit')}</button>
            <button class="round-btn" data-act="my-qr" aria-label="QR">${icon('qr')}</button>
            <button class="round-btn" data-act="add-story" aria-label="Story">${icon('plus')}</button>
          </div>
        </div>
        <div class="set-group">
          <div class="set-row">${icon('moon')}<div class="set-txt"><span>Tema</span></div>
            <div class="seg sm icons">${[['system', 'sparkle'], ['light', 'sun'], ['dark', 'moon']].map(([k, ic]) => `<button class="${s.theme === k ? 'on' : ''}" data-act="theme" data-v="${k}" aria-label="${k}">${icon(ic)}</button>`).join('')}</div></div>
          <button class="set-row" data-act="skins">${icon('sparkle')}<div class="set-txt"><span>Gaya</span></div><span class="count">${esc((SKINS.find(k => k[0] === (s.skin || 'onix')) || SKINS[0])[1])}</span>${icon('chevronRight', 'tiny')}</button>
          ${s.skin && s.skin !== 'onix' ? '' : `<div class="set-row">${icon('palette')}<div class="set-txt"><span>Aksen</span></div>
            <div class="swatches">${ACCENTS.map(([k, c]) => `<button class="${s.accent === k ? 'on' : ''}" style="--c:${c}" data-act="accent" data-v="${k}" aria-label="${k}"></button>`).join('')}</div></div>`}
          <div class="set-row">${icon('type')}<div class="set-txt"><span>Teks</span></div>
            <div class="seg sm fs">${[['s', 13], ['m', 16], ['l', 19]].map(([k, px]) => `<button class="${s.fontSize === k ? 'on' : ''}" data-act="font" data-v="${k}" style="font-size:${px}px">A</button>`).join('')}</div></div>
        </div>
        <div class="set-group">
          ${link('online', 'globe', 'Onix Online', api.remote.state() ? `<span class="on-pill">@${esc(api.remote.state().handle)}</span>` : '')}
          ${link('wallet', 'wallet', 'Onix Pay', `<span class="count">${(api.wallet().balance / 1000).toLocaleString('id-ID')}rb</span>`)}
          ${link('fungal', 'sparkle', 'Khas Onix', '<span class="count">✨</span>')}
          ${link('focus', 'headphones', 'Mode fokus', api.focus() ? `<span class="on-pill">🎧 s/d ${new Date(api.focus().until).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>` : '')}
          ${link('keep', 'bookmark', 'Keep', `<span class="count">${api.keep().length || ''}</span>`)}
          ${link('trash', 'trash', 'Sampah', `<span class="count">${api.trash().length || ''}</span>`)}
          ${link('archived', 'archive', 'Arsip', `<span class="count">${api.archived().length || ''}</span>`)}
          ${s.passcode ? link('hidden-chats', 'lock', 'Tersembunyi', '') : ''}
          ${link('store', 'store', 'Sticker', `<span class="count">${api.packs().length}</span>`)}
          ${link('storage', 'database', 'Penyimpanan')}
          ${link('backup', 'cloud', 'Backup')}
        </div>
        <div class="set-group">
          <label class="set-row">${icon('lock')}<div class="set-txt"><span>Kunci PIN</span></div><input type="checkbox" class="switch" data-lock ${s.passcode ? 'checked' : ''}></label>
          ${toggle('notif', 'Notifikasi', 'bell')}
          ${toggle('sound', 'Suara', 'volume')}
          ${toggle('calm', 'Mode kalem', 'wind')}
          ${toggle('undoSend', 'Batal kirim', 'undo')}
          ${toggle('saver', 'Hemat kuota', 'database')}
          ${toggle('smart', 'Saran balasan', 'sparkle')}
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
    const hb = $('.tab[data-tab=home] .badge', el), na = api.unreadActivity();
    hb.hidden = !na; hb.textContent = na > 99 ? '99+' : na;
    const missed = 0;
    $('.tab[data-tab=calls] .badge', el).hidden = !missed;
  }
  function switchTab(id) {
    if (id === cur) { body.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    scrollPos[cur] = body.scrollTop;
    cur = id;
    $$('.tab', el).forEach(t => t.classList.toggle('active', t.dataset.tab === id));
    el.dataset.tab = id;
    movePill();
    renderHead(); renderBody();
    body.scrollTop = scrollPos[id] || 0;
    onScroll();
    body.classList.remove('tb-in'); void body.offsetWidth; body.classList.add('tb-in');
    vibrate(4);
  }

  let rq = 0;
  const schedule = () => { cancelAnimationFrame(rq); rq = requestAnimationFrame(() => { renderBody(); renderBadges(); }); };
  const watch = {
    home: ['friends', 'chats', 'stories', 'me', 'presence'],
    chats: ['chats', 'presence', 'moods'],
    voom: ['posts', 'me'],
    calls: ['calls', 'friends'],
    me: ['me', 'settings', 'keep', 'chats', 'packs', 'wallet', 'remote'],
  };
  const offs = ['friends', 'chats', 'stories', 'me', 'presence', 'posts', 'calls', 'settings', 'keep', 'packs', 'activity', 'moods', 'wallet', 'remote'].map(ev => bus.on(ev, () => {
    if (ev === 'chats') renderBadges();
    if (watch[cur].includes(ev)) schedule();
    if (ev === 'me' && (cur === 'home' || cur === 'voom')) renderHead();
    if (ev === 'activity') { renderBadges(); if (cur === 'home') { const d = head.querySelector('.bell-dot'); if (d) { const n = api.unreadActivity(); d.hidden = !n; d.textContent = n || ''; } } }
  }));

  head.addEventListener('input', e => {
    const k = e.target.dataset.q;
    if (k) { st[k] = e.target.value; renderBody(); }
  });
  body.addEventListener('change', async e => {
    if (e.target.hasAttribute('data-lock')) {
      if (e.target.checked) { const ok = await setupPasscode(); if (!ok) e.target.checked = false; }
      else if (await confirmBox({ title: 'Matikan kunci aplikasi?', text: api.secretChats().length ? 'Chat tersembunyi bakal ditampilkan lagi.' : '', ok: 'Matikan', danger: true })) { api.setSetting('passcode', null); api.unhideAllSecret(); renderBody(); }
      else e.target.checked = true;
      return;
    }
    const k = e.target.dataset.set;
    if (!k) return;
    api.setSetting(k, e.target.checked);
    vibrate(5);
    if (k === 'notif' && e.target.checked) askNotifPermission();
  });
  $('.tabbar', el).addEventListener('click', e => { const t = e.target.closest('.tab'); if (t) switchTab(t.dataset.tab); });

  const handlers = {
    'open-me': () => router.push(ProfileScreen(ME)),
    'add-friend': () => router.push(AddFriendScreen()),
    'new-group': () => router.push(NewGroupScreen()),
    'new-chat': () => router.push(FriendPicker({ title: 'Chat baru', onDone: ([id]) => { history.back(); setTimeout(() => openChat(api.directWith(id).id), 350); } })),
    'new-call': () => router.push(FriendPicker({ title: 'Telepon siapa?', onDone: ([id]) => { history.back(); setTimeout(() => startCall(api.directWith(id).id, false), 350); } })),
    'open-chat': t => openChat(t.dataset.id),
    'mood-me': () => setMoodSheet(),
    'mood-view': t => viewMoodSheet(t.dataset.id),
    'open-hit': t => openChat(t.dataset.id, { mid: t.dataset.mid }),
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
        { label: 'Permintaan teman', icon: 'userPlus', run: () => setTimeout(() => api.simulateFriendRequest(), 800) },
        { label: s.simulate ? 'Matikan pesan otomatis' : 'Nyalakan pesan otomatis', icon: 'refresh', run: () => api.setSetting('simulate', !s.simulate) },
        { label: 'Reset data', icon: 'trash', danger: true, run: handlers.reset },
      ] });
    },
    story: t => { const ids = api.stories().map(s => s.userId); openStories(ids, Math.max(0, ids.indexOf(t.dataset.id))); },
    'my-story': () => sheet({ actions: [{ label: 'Lihat', icon: 'voom', run: () => openStories([ME]) }, { label: 'Tambah', icon: 'plus', run: addStoryFlow }] }),
    'add-story': addStoryFlow,
    filter: t => { st.filter = t.dataset.f; renderHead(); renderBody(); },
    'compose-post': () => router.push(PostComposeScreen()),
    fab: () => { vibrate(6); handlers[cur === 'calls' ? 'new-call' : cur === 'voom' ? 'compose-post' : 'compose-menu'](); },
    qcall: t => startCall(api.directWith(t.dataset.id).id, false),
    recall: (t, e) => { e.stopPropagation(); startCall(t.dataset.id, t.dataset.v === '1'); },
    'clear-calls': async () => { if (await confirmBox({ title: 'Hapus riwayat panggilan?', ok: 'Hapus', danger: true })) api.clearCalls(); },
    'edit-profile': () => router.push(EditProfileScreen()),
    keep: () => router.push(KeepScreen()),
    badges: () => router.push(fun.BadgesScreen()),
    fungal: async () => router.push((await import('./fun.js')).FunGalleryScreen()),
    skins: () => skinSheet(),
    focus: async () => (await import('./fun.js')).focusSheet(),
    feed: t => { if (st.feed === t.dataset.v) return; st.feed = t.dataset.v; renderBody(); body.scrollTo({ top: 0 }); },
    'hidden-chats': () => openHiddenChats(),
    storage: () => router.push(StorageScreen()),
    wallet: () => router.push(WalletScreen()),
    online: () => router.push(OnlineScreen()),
    backup: () => router.push(BackupScreen()),
    activity: () => router.push(ActivityScreen()),
    store: () => router.push(StickerStoreScreen()),
    wish: t => {
      const u = api.user(t.dataset.id);
      const c = api.directWith(u.id);
      api.send(c.id, { type: 'sticker', sticker: '🎂', anim: 'beat' });
      setTimeout(() => api.send(c.id, { type: 'text', text: `HBD ${firstName(u.name)}!! 🎉🥳 wish you all the best 💖` }), 400);
      api.markWished(u.id);
      vibrate(15);
      openChat(c.id);
    },
    archived: () => router.push(ArchivedScreen()),
    trash: () => router.push(fun.TrashScreen()),
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
        { label: 'Sembunyikan', icon: 'lock', run: () => hideChat(c.id) },
        c.unread ? { label: 'Tandai dibaca', icon: 'check', run: () => api.markRead(c.id) } : { label: 'Tandai belum dibaca', icon: 'chat', run: () => api.markUnread(c.id) },
        { label: 'Hapus', icon: 'trash', danger: true, run: async () => { if (await confirmBox({ title: 'Hapus chat ini?', ok: 'Hapus', danger: true })) api.deleteChat(c.id); } },
      ],
    });
  });

  // tahan judul "Chat" = buka chat tersembunyi
  onLongPress(head, '.th-row h1', () => { if (cur === 'chats') openHiddenChats(); });

  /* ---------- geser chat: kiri = aksi, kanan = tandai dibaca ---------- */
  let sw = null, openItem = null;
  const ACT_W = 74;
  const closeOpen = () => { if (openItem) { openItem.style.setProperty('--sx', '0px'); const o = openItem; setTimeout(() => o.querySelector('.swipe-actions')?.remove(), 250); openItem.classList.remove('sw-open'); openItem = null; } };
  function actionsFor(c) {
    return [
      ['pin', c.pinned ? 'pin' : 'pin', '#8E8E9C', c.pinned ? 'Lepas' : 'Pin'],
      ['mute', c.muted ? 'bell' : 'bellOff', '#7C5CFF', c.muted ? 'Bunyi' : 'Bisu'],
      ['arc', 'archive', '#FF9F1A', 'Arsip'],
      ['del', 'trash', '#FF3B5C', 'Hapus'],
    ];
  }
  body.addEventListener('touchstart', e => {
    const it = e.target.closest('.chat-item');
    if (e.target.closest('.swipe-actions')) return;
    if (openItem && openItem !== it) closeOpen();
    if (!it || cur !== 'chats') return;
    const t = e.touches[0];
    sw = { it, x: t.clientX, y: t.clientY, dx: 0, active: false, base: it === openItem ? -ACT_W * 4 : 0 };
  }, { passive: true });
  body.addEventListener('touchmove', e => {
    if (!sw) return;
    const t = e.touches[0];
    const dx = t.clientX - sw.x, dy = t.clientY - sw.y;
    if (!sw.active) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        sw.active = true;
        sw.it.classList.add('swiping');
        if (!sw.it.querySelector('.swipe-actions')) {
          const c = api.chat(sw.it.dataset.id);
          sw.it.insertAdjacentHTML('beforeend', `<div class="swipe-actions">${actionsFor(c).map(([k, ic, col, l]) => `<button data-sw="${k}" style="--c:${col}">${icon(ic)}<small>${l}</small></button>`).join('')}</div><div class="swipe-left"><span>${icon(c.unread ? 'check' : 'chat')}</span></div>`);
        }
      } else if (Math.abs(dy) > 10) { sw = null; return; }
    }
    if (sw.active) {
      sw.dx = Math.max(-ACT_W * 4 - 30, Math.min(110, sw.base + dx));
      sw.it.style.setProperty('--sx', sw.dx + 'px');
      sw.it.classList.toggle('sw-right-hit', sw.dx > 80);
    }
  }, { passive: true });
  const endSw = () => {
    if (!sw) return;
    const s = sw; sw = null;
    if (!s.active) return;
    s.it.classList.remove('swiping');
    s.it._swiped = Date.now();
    if (s.dx > 80) {
      const c = api.chat(s.it.dataset.id);
      vibrate(10);
      c.unread || c.mention ? api.markRead(c.id) : api.markUnread(c.id);
      s.it.style.setProperty('--sx', '0px');
      return;
    }
    if (s.dx < -70) { s.it.style.setProperty('--sx', -ACT_W * 4 + 'px'); s.it.classList.add('sw-open'); openItem = s.it; vibrate(6); }
    else { s.it.style.setProperty('--sx', '0px'); if (openItem === s.it) openItem = null; setTimeout(() => !s.it.classList.contains('sw-open') && s.it.querySelector('.swipe-actions')?.remove(), 250); }
  };
  body.addEventListener('touchend', endSw);
  body.addEventListener('touchcancel', endSw);
  body.addEventListener('click', async e => {
    const b = e.target.closest('[data-sw]');
    const it = e.target.closest('.chat-item');
    if (b) {
      e.stopPropagation(); e.preventDefault();
      const id = it.dataset.id, k = b.dataset.sw;
      closeOpen();
      if (k === 'pin') api.togglePin(id);
      if (k === 'mute') api.toggleMute(id);
      if (k === 'arc') api.toggleArchive(id);
      if (k === 'del' && await confirmBox({ title: 'Hapus chat ini?', ok: 'Hapus', danger: true })) api.deleteChat(id);
      return;
    }
    if (it && (it._swiped && Date.now() - it._swiped < 350 || it === openItem)) { e.stopPropagation(); e.preventDefault(); closeOpen(); }
  }, true);

  // pill tab aktif + header pas discroll
  function movePill() { el.style.setProperty('--ti', TABS.findIndex(t => t.id === cur)); }
  function onScroll() { head.classList.toggle('scrolled', body.scrollTop > 6); el.classList.toggle('fab-mini', body.scrollTop > 120); }
  body.addEventListener('scroll', onScroll, { passive: true });
  // render awal
  $$('.tab', el).forEach(t => t.classList.toggle('active', t.dataset.tab === cur));
  el.dataset.tab = cur;
  movePill();
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
  backend.init().then(() => setTimeout(() => { handleJoinLink(); handleChatLink(); }, 500));
  updateAppBadge();
}
window.addEventListener('hashchange', () => { if (!api.ready) return; if (/join=/.test(location.hash)) handleJoinLink(); else if (/chat=/.test(location.hash)) handleChatLink(); });

bus.on('settings', applyTheme);
/* ---------- notifikasi sistem & badge ikon ---------- */
const canNotify = () => 'Notification' in window;
async function askNotifPermission() {
  if (!canNotify()) return toast(/iPhone|iPad/.test(navigator.userAgent) ? 'Tambah ke Layar Utama dulu biar bisa notif' : 'Browser ini nggak dukung notif');
  if (Notification.permission === 'default') {
    const r = await Notification.requestPermission().catch(() => 'denied');
    if (r === 'granted') toast('Notif aktif 🔔');
  } else if (Notification.permission === 'denied') toast('Notif diblokir di pengaturan browser');
}
async function sysNotify(title, body, chatId) {
  if (!canNotify() || Notification.permission !== 'granted') return false;
  const opt = { body, tag: 'chat-' + chatId, renotify: true, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: { chatId } };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) { await reg.showNotification(title || 'Onix', opt); return true; }
    const n = new Notification(title || 'Onix', opt);
    n.onclick = () => { focus(); openChat(chatId); n.close(); };
    return true;
  } catch { return false; }
}
let badgeT = null;
function updateAppBadge() {
  clearTimeout(badgeT);
  badgeT = setTimeout(() => {
    if (!('setAppBadge' in navigator)) return;
    const n = api.ready ? api.totalUnread() : 0;
    (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => {});
  }, 300);
}
bus.on('chats', updateAppBadge);
bus.on('messages', updateAppBadge);
// tap notif -> buka chat
navigator.serviceWorker?.addEventListener('message', e => { if (e.data?.type === 'open-chat' && api.chat(e.data.chatId)) openChat(e.data.chatId); });
function handleChatLink() {
  const m = location.hash.match(/chat=([\w-]+)/);
  if (!m) return;
  history.replaceState(history.state, '', location.pathname);
  if (api.chat(m[1])) openChat(m[1]);
}

/* ---------- pengingat pesan ---------- */
async function checkReminders() {
  if (!api.ready) return;
  const { dueReminders } = await import('./fun.js');
  for (const r of dueReminders()) {
    const chat = api.chat(r.chatId), title = '🔔 ' + api.chatTitle(chat), text = (r.who ? r.who + ': ' : '') + (r.text || 'Pesan yang kamu tandai');
    if (document.hidden && await sysNotify(title, text, r.chatId)) continue;
    banner({ title, text, avatarHtml: chatAvatar(chat, 40, { online: false }), onTap: () => openChat(r.chatId, { mid: r.mid }) });
    vibrate([20, 40, 20]);
  }
}
setInterval(checkReminders, 15e3);
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkReminders(); });

setInterval(() => api.ready && api.endFocusIfDone(), 15e3);
/* hemat kuota: foto dikirim lebih kecil, efek layar dimatiin, gambar VOOM dari server ditap dulu */
const applySaver = () => { window.__onixSaver = !!api.settings().saver; document.documentElement.classList.toggle('saver', window.__onixSaver); };
bus.on('settings', applySaver); applySaver();
document.addEventListener('click', async e => {
  const b = e.target.closest('.saver-img');
  if (!b) return;
  e.stopPropagation();
  const { loadedPosts } = await import('./views.js');
  loadedPosts.add(b.dataset.post); bus.emit('posts');
}, true);
// kirim pas dia online
const flushWaits = () => { if (!api.ready || !api.waits().length) return; for (const u of api.flushWaits()) toast(`Kekirim, ${firstName(u.name)} udah online 🟢`); };
bus.on('presence', flushWaits); bus.on('chats', () => setTimeout(flushWaits, 0)); setInterval(flushWaits, 20e3);
bus.on('notify', ({ chat, msg, mention }) => {
  if (api.focus() && !mention) return; // lagi fokus: diem
  const s = api.settings();
  if (router.top()?.chatId === chat.id && !document.hidden) return;
  if (s.sound) playPop();
  vibrate(10);
  if (!s.notif) return;
  const u = api.user(msg.from);
  const title = chat.type === 'group' ? `${mention ? '@ ' : ''}${chat.name}` : u?.name;
  const text = msg.type === 'system' ? msg.text : (chat.type === 'group' ? firstName(u?.name) + ': ' : '') + preview(msg, chat).replace(/^Kamu: /, '');
  if (document.hidden) { sysNotify(title, text, chat.id); return; }
  banner({ title, text, avatarHtml: chatAvatar(chat, 40, { online: false }), onTap: () => openChat(chat.id) });
});
bus.on('incoming-call', ({ chatId, video, rtc }) => startCall(chatId, video, true, rtc));
bus.on('incoming-gcall', async ({ chatId, video, roomId, from }) => { const { startGroupCall } = await import('./chat.js'); startGroupCall(chatId, video, { roomId, from }); });
bus.on('storage-full', () => toast('Memori penuh'));
bus.on('toast', t => toast(t));

initViewport();
history.replaceState({ depth: 1 }, '');
if (api.ready) startApp();
else {
  applyTheme();
  router.setRoot(OnboardingScreen(startApp));
}
document.getElementById('splash')?.remove();

// banner offline
(() => {
  const b = document.createElement('div');
  b.className = 'net-banner';
  let bad = false, waitT = null, backT = null;
  const show = (st, text, ic) => { clearTimeout(backT); b.innerHTML = `${icon(ic)}<span>${text}</span>`; b.classList.toggle('back', st === 'back'); b.classList.toggle('wait', st === 'wait'); b.classList.add('show'); };
  const set = () => {
    const st = backend.connState();
    document.documentElement.classList.toggle('is-offline', st === 'offline');
    clearTimeout(waitT);
    if (st === 'offline') { bad = true; show('offline', 'Offline', 'wifiOff'); }
    else if (st === 'wait') waitT = setTimeout(() => { if (backend.connState() === 'wait') { bad = true; show('wait', 'Menyambungkan…', 'cloud'); } }, 2500);
    else if (bad) { bad = false; show('back', 'Online lagi', 'check'); backT = setTimeout(() => b.classList.remove('show', 'back'), 1600); }
    else b.classList.remove('show');
  };
  const mount = () => { document.getElementById('app')?.appendChild(b); set(); };
  document.readyState === 'loading' ? addEventListener('DOMContentLoaded', mount) : mount();
  bus.on('network', set); bus.on('conn', set);
})();

// carousel post: update titik & nomor saat digeser
document.addEventListener('scroll', e => {
  const tr = e.target;
  if (!tr.classList?.contains('pc-track')) return;
  const i = Math.round(tr.scrollLeft / tr.clientWidth), car = tr.parentElement;
  car.querySelectorAll('.pc-dots i').forEach((d, k) => d.classList.toggle('on', k === i));
  const c = car.querySelector('.pc-count'); if (c) c.textContent = `${i + 1}/${car.dataset.n}`;
}, true);

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

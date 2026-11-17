// Layar "Onix Online": daftar/masuk ke server, cari teman beneran, mulai chat.
import { api, bus } from './service.js';
import { $, h, esc, avatar, vibrate } from './util.js';
import { icon } from './icons.js';
import { router, bindActs, navbar, toast, confirmBox } from './ui.js';
import { empty } from './views.js';
import { openChat } from './chat.js';
import * as be from './backend.js';

// buka link undangan (#join=KODE)
export async function handleJoinLink() {
  const m = location.hash.match(/join=([a-z0-9]+)/i);
  const code = m?.[1] || sessionStorage.getItem('onix:join');
  if (!code) return;
  if (m) { history.replaceState(history.state, '', location.pathname); sessionStorage.setItem('onix:join', code); }
  if (!api.remote.state()) { toast('Masuk Onix Online dulu buat gabung grup 🌐'); return; }
  sessionStorage.removeItem('onix:join');
  if (!(await confirmBox({ title: 'Gabung grup?', text: 'Kamu diundang lewat link.', ok: 'Gabung' }))) return;
  try { const id = await be.joinGroup(code); toast('Kamu gabung 🎉'); openChat(id); }
  catch (e) { toast(e?.response?.message || be.errText(e)); }
}

export function OnlineScreen() {
  const el = h(`<div class="sub-screen">${navbar('Onix Online')}<div class="content on-body"></div></div>`);
  const body = $('.on-body', el);
  let mode = 'up', busy = false, q = '', results = null, qT = null;

  function renderAuth() {
    const me = api.me();
    body.innerHTML = `
      <div class="on-hero"><div class="on-ic">${icon('globe')}</div><b>Chat beneran</b></div>
      <div class="seg on-mode"><button data-act="mode" data-v="up" class="${mode === 'up' ? 'on' : ''}">Daftar</button><button data-act="mode" data-v="in" class="${mode === 'in' ? 'on' : ''}">Masuk</button></div>
      <div class="on-form">
        <div class="on-field"><span>@</span><input name="handle" autocapitalize="none" autocomplete="username" spellcheck="false" maxlength="20" placeholder="id" value="${esc(mode === 'up' ? (me.id || '') : '')}"></div>
        <input class="field" name="password" type="password" autocomplete="${mode === 'up' ? 'new-password' : 'current-password'}" placeholder="Password">
        <details class="on-adv"><summary>${icon('settings', 'tiny')} Server</summary><input class="field" name="url" inputmode="url" autocapitalize="none" spellcheck="false" value="${esc(be.serverUrl())}"></details>
        <button class="btn primary wide" data-act="submit" ${busy ? 'disabled' : ''}>${busy ? '…' : mode === 'up' ? 'Daftar' : 'Masuk'}</button>
      </div>`;
  }

  function renderIn() {
    const st = api.remote.state(), me = api.me(), on = be.isConnected();
    const chats = Object.values(api.allChats()).filter(c => c.remote);
    body.innerHTML = `
      <div class="on-card">${avatar(me, 54)}<div class="on-who"><b>${esc(me.name)}</b><small>@${esc(st.handle)}</small></div><span class="on-dot ${on ? 'ok' : ''}">${on ? 'Online' : 'Nyambung…'}</span></div>
      <div class="af-search on-search"><div class="search">${icon('search')}<input placeholder="Cari ID teman" autocapitalize="none" spellcheck="false" value="${esc(q)}"></div></div>
      <div class="on-results">${resultsHtml()}</div>
      ${!q && chats.length ? `<div class="section-h">Chat online</div>${chats.map(c => `<div class="list-item" data-act="open" data-id="${c.id}">${avatar(api.peerOf(c) || { name: c.name }, 44)}<div class="li-main"><div class="li-name">${esc(api.chatTitle(c))}</div><div class="li-sub">${esc(api.peerOf(c) ? '@' + api.peerOf(c).handle : '')}</div></div>${icon('chevronRight', 'tiny')}</div>`).join('')}` : ''}
      <div class="section-h">Privasi</div>
      <div class="set-group on-priv">
        <label class="set-row">${icon('eye')}<div class="set-txt"><span>Terakhir dilihat</span></div><input type="checkbox" class="switch" data-priv="seen" ${api.privacy().seen ? 'checked' : ''}></label>
        <label class="set-row">${icon('checks')}<div class="set-txt"><span>Centang dibaca</span></div><input type="checkbox" class="switch" data-priv="read" ${api.privacy().read ? 'checked' : ''}></label>
      </div>
      <div class="pad"><button class="btn danger-ghost wide" data-act="logout">${icon('logout')} Keluar akun online</button></div>`;
    const inp = $('.on-search input', body);
    inp.addEventListener('input', () => { q = inp.value; clearTimeout(qT); qT = setTimeout(search, 300); });
  }
  function resultsHtml() {
    if (!q) return '';
    if (!results) return `<div class="on-loading"></div>`;
    if (!results.length) return empty('🔍', 'Nggak ketemu');
    return results.map(u => `<div class="list-item">${avatar(u, 44)}<div class="li-main"><div class="li-name">${esc(u.name)}</div><div class="li-sub">@${esc(u.handle)}</div></div><button class="btn primary sm" data-act="chat" data-id="${u.id}">Chat</button></div>`).join('');
  }
  async function search() {
    results = null; $('.on-results', body).innerHTML = resultsHtml();
    if (q.trim().length < 2) { results = []; $('.on-results', body).innerHTML = q ? '' : ''; return; }
    try { results = await be.findUsers(q); } catch (e) { results = []; toast(be.errText(e)); }
    const box = $('.on-results', body); if (box) box.innerHTML = resultsHtml();
  }
  const render = () => (api.remote.state() ? renderIn() : renderAuth());

  bindActs(el, {
    mode: t => { mode = t.dataset.v; render(); },
    submit: async () => {
      const handle = $('[name=handle]', body).value.trim().toLowerCase().replace(/^@/, '');
      const password = $('[name=password]', body).value;
      const url = $('[name=url]', body).value.trim() || be.defaultUrl();
      if (!/^[a-z0-9._]{3,20}$/.test(handle)) return toast('ID 3–20 huruf kecil/angka');
      if (password.length < 8) return toast('Password minimal 8 karakter');
      busy = true; render();
      try {
        mode === 'up' ? await be.signUp({ handle, password, url }) : await be.signIn({ handle, password, url });
        vibrate(10); toast('Kamu online 🌐');
        setTimeout(handleJoinLink, 600);
      } catch (e) { toast(be.errText(e)); }
      busy = false; render();
    },
    chat: async t => {
      const u = results?.find(x => x.id === t.dataset.id);
      if (!u) return;
      try { const id = await be.startChatWith(u); openChat(id); } catch (e) { toast(be.errText(e)); }
    },
    open: t => openChat(t.dataset.id),
    logout: async () => {
      if (!(await confirmBox({ title: 'Keluar akun online?', text: 'Chat online dihapus dari HP ini (tetap aman di server).', ok: 'Keluar', danger: true }))) return;
      await be.signOut(); q = ''; results = null; render();
    },
  });
  body.addEventListener('change', e => { const k = e.target.dataset?.priv; if (k) { api.setPrivacy({ [k]: e.target.checked }); vibrate(5); } });
  const offs = [bus.on('remote', () => { if (!$('.on-search input:focus', body)) render(); }), bus.on('chats', () => { if (api.remote.state() && !q) render(); })];
  render();
  return { el, destroy: () => offs.forEach(f => f()) };
}

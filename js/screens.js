import { api, bus, ME, firstName } from './service.js';
import { $, $$, h, esc, avatar, ago, hash, vibrate, pickFile, compressImage, copyText } from './util.js';
import { icon } from './icons.js';
import { router, bindActs, navbar, toast, sheet, confirmBox, promptBox, banner } from './ui.js';
import { userAvatar, chatAvatar, presence, verified, userRow, postCard, empty } from './views.js';
import { openChat, startCall } from './chat.js';
import { NotesScreen, ChatPicker } from './features.js';
import { pickFiles } from './util.js';

/* ================= ONBOARDING ================= */
export function OnboardingScreen(onDone) {
  // langkah: welcome -> phone -> otp -> profile
  const data = { phone: '', code: '', name: '', id: '', avatar: null, hue: Math.floor(Math.random() * 360) };
  const el = h(`<div class="onb"></div>`);
  let step = 'welcome', resendT = null;

  function go(s) { step = s; clearInterval(resendT); render(); }
  const onbTop = (t, sub = '') => `<div class="onb-top"><button class="icon-btn" data-act="prev" aria-label="Kembali">${icon('back')}</button><div class="onb-steps">${['phone', 'otp', 'profile'].map(s => `<i class="${s === step ? 'on' : ''}"></i>`).join('')}</div><span></span></div><div class="onb-title"><h2>${t}</h2>${sub ? `<p>${sub}</p>` : ''}</div>`;
  const fmtPhone = p => p.replace(/(\d{3})(\d{4})(\d+)/, '$1 $2 $3');

  function render() {
    el.dataset.step = step;
    if (step === 'welcome') {
      el.innerHTML = `<div class="onb-hero">
          <div class="floaty f1">💬</div><div class="floaty f2">✨</div>
          <div class="logo-big"><img src="icons/icon.svg" alt=""></div>
          <h1>onix</h1><p>chat bareng circle kamu</p>
        </div>
        <div class="onb-form"><button class="btn primary wide" data-act="start">Mulai ${icon('send')}</button></div>`;
    } else if (step === 'phone') {
      el.innerHTML = `${onbTop('Nomor HP')}
        <div class="onb-body">
          <div class="phone-row"><span class="cc">🇮🇩 +62</span><input class="field" type="tel" inputmode="numeric" maxlength="13" placeholder="812 3456 7890" value="${esc(data.phone)}"></div>
        </div>
        <div class="onb-form"><button class="btn primary wide" data-act="send-otp" disabled>Kirim kode</button></div>`;
      const inp = $('input', el), btn = $('[data-act=send-otp]', el);
      const chk = () => { inp.value = inp.value.replace(/\D/g, '').replace(/^0+/, ''); data.phone = inp.value; btn.disabled = inp.value.length < 9; };
      inp.addEventListener('input', chk); chk();
      inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !btn.disabled) sendOtp(); });
      setTimeout(() => inp.focus(), 300);
    } else if (step === 'otp') {
      el.innerHTML = `${onbTop('Kode verifikasi', `+62 ${esc(fmtPhone(data.phone))}`)}
        <div class="onb-body">
          <div class="otp">${'<input inputmode="numeric" maxlength="6" autocomplete="one-time-code">'.repeat(6)}</div>
          <button class="text-btn resend" data-act="resend" disabled></button>
        </div>`;
      const boxes = $$('.otp input', el);
      boxes.forEach((b, i) => {
        b.addEventListener('input', () => {
          const v = b.value.replace(/\D/g, '');
          if (v.length > 1) v.split('').slice(0, 6 - i).forEach((d, k) => { boxes[i + k].value = d; });
          else b.value = v;
          const next = boxes.find(x => !x.value);
          (next || boxes[5]).focus();
          checkOtp(boxes);
        });
        b.addEventListener('keydown', e => { if (e.key === 'Backspace' && !b.value && i) { boxes[i - 1].value = ''; boxes[i - 1].focus(); } });
      });
      setTimeout(() => boxes[0].focus(), 300);
      startResend();
    } else if (step === 'profile') {
      el.innerHTML = `${onbTop('Profil kamu')}
        <div class="onb-body">
          <button class="onb-av" data-act="photo">${avatar({ name: data.name || '?', hue: data.hue, avatar: data.avatar }, 96)}<span class="cam-badge">${icon('camera')}</span></button>
          <input class="field" name="name" maxlength="30" placeholder="Nama" value="${esc(data.name)}">
          <div class="field-prefix"><span>@</span><input class="field" name="id" maxlength="20" placeholder="onix id" autocapitalize="off" autocorrect="off" value="${esc(data.id)}"></div>
          <small class="id-hint"></small>
        </div>
        <div class="onb-form"><button class="btn primary wide" data-act="finish" disabled>Selesai ${icon('check')}</button></div>`;
      const nm = $('[name=name]', el), id = $('[name=id]', el), hint = $('.id-hint', el), btn = $('[data-act=finish]', el);
      let touched = !!data.id;
      const validate = () => {
        data.name = nm.value.trim(); data.id = id.value;
        const taken = api.idTaken(data.id);
        hint.textContent = data.id.length >= 3 ? (taken ? '✗ udah dipakai' : '✓ tersedia') : '';
        hint.className = 'id-hint ' + (taken ? 'bad' : 'ok');
        btn.disabled = data.name.length < 2 || data.id.length < 3 || taken;
        $('.onb-av', el).firstElementChild.outerHTML = avatar({ name: data.name || '?', hue: data.hue, avatar: data.avatar }, 96);
      };
      nm.addEventListener('input', () => { if (!touched) id.value = nm.value.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '').slice(0, 20); validate(); });
      id.addEventListener('input', () => { touched = true; id.value = id.value.toLowerCase().replace(/[^a-z0-9._]/g, ''); validate(); });
      nm.addEventListener('keydown', e => { if (e.key === 'Enter') id.focus(); });
      id.addEventListener('keydown', e => { if (e.key === 'Enter' && !btn.disabled) btn.click(); });
      validate();
      setTimeout(() => nm.focus(), 300);
    }
  }

  function sendOtp() {
    data.code = String(Math.floor(100000 + Math.random() * 900000));
    go('otp');
    // simulasi SMS masuk (nanti diganti SMS OTP asli dari server)
    setTimeout(() => banner({
      title: 'Pesan · Onix', text: `Kode Onix kamu: ${data.code}`,
      avatarHtml: `<div class="avatar sq" style="width:40px;height:40px;--h:255"><img src="icons/icon.svg" alt=""></div>`,
      onTap: fillOtp,
    }), 1200);
  }
  function fillOtp() {
    const boxes = $$('.otp input', el);
    if (!boxes.length) return;
    data.code.split('').forEach((d, i) => { boxes[i].value = d; });
    checkOtp(boxes);
  }
  function checkOtp(boxes) {
    const v = boxes.map(b => b.value).join('');
    if (v.length < 6) return;
    const box = $('.otp', el);
    if (v === data.code) { vibrate(15); box.classList.add('ok'); setTimeout(() => go('profile'), 450); }
    else {
      vibrate([30, 40, 30]); box.classList.add('bad');
      setTimeout(() => { box.classList.remove('bad'); boxes.forEach(b => { b.value = ''; }); boxes[0].focus(); }, 500);
    }
  }
  function startResend() {
    let n = 30;
    const b = $('[data-act=resend]', el);
    const tick = () => { if (!b.isConnected) return clearInterval(resendT); b.disabled = n > 0; b.textContent = n > 0 ? `Kirim ulang ${n}s` : 'Kirim ulang'; n--; };
    tick(); resendT = setInterval(tick, 1000);
  }

  bindActs(el, {
    start: () => go('phone'),
    prev: () => go(step === 'phone' ? 'welcome' : 'phone'),
    'send-otp': sendOtp,
    resend: sendOtp,
    photo: async () => { const f = await pickFile('image/*'); if (f) { data.avatar = (await compressImage(f, 400, 0.8)).src; render(); } },
    finish: () => {
      if (data.name.length < 2 || data.id.length < 3 || api.idTaken(data.id)) return;
      api.register({ name: data.name, id: data.id, phone: '+62' + data.phone, avatar: data.avatar, hue: data.hue });
      vibrate(15);
      onDone();
    },
  });
  render();
  return { el, destroy: () => clearInterval(resendT) };
}

/* ================= PROFILE ================= */
export function ProfileScreen(uid) {
  if (uid === ME) return MyProfileScreen();
  const el = h(`<div class="profile-screen"></div>`);
  function render() {
    const u = api.user(uid);
    if (!u) return;
    const fr = api.isFriend(uid), fav = api.isFav(uid), blocked = api.isBlocked(uid);
    const story = api.storyOf(uid);
    el.innerHTML = `
      <div class="profile-cover ${u.cover ? 'has-img' : ''}" style="${coverStyle(u)}">
        <header class="navbar clear"><button class="icon-btn" data-act="back">${icon('back')}</button><div></div><div class="nav-right"><button class="icon-btn" data-act="more">${icon('more')}</button></div></header>
      </div>
      <div class="profile-body">
        <button class="pav" data-act="${story ? 'story' : 'noop'}">${avatar(u, 104, { ring: !!story, seen: story?.seen })}</button>
        <h1>${esc(u.name)}${u.official ? verified() : ''}</h1>
        <div class="pid">@${esc(u.id)}</div>
        <p class="pstatus">${esc(u.status || '')}</p>
        <div class="presence ${u.online ? 'on' : ''}">${esc(presence(u))}${u.birthday ? `<span class="bd-pill">🎂 ${bdayLabel(u.birthday)}</span>` : ''}</div>
        ${blocked ? `<button class="btn ghost wide" data-act="unblock">Buka blokir</button>`
          : fr || u.official ? `<div class="pactions">
            <button data-act="chat">${icon('chat')}<span>Chat</span></button>
            <button data-act="call">${icon('phone')}<span>Telepon</span></button>
            <button data-act="video">${icon('video')}<span>Video</span></button>
            ${u.official ? '' : `<button data-act="fav" class="${fav ? 'on' : ''}">${icon('star')}<span>Favorit</span></button>`}
          </div>`
          : `<div class="stack"><button class="btn primary wide" data-act="add">${icon('userPlus')} Tambah teman</button><button class="btn ghost wide" data-act="chat">Kirim pesan</button></div>`}
      </div>`;
  }
  bindActs(el, {
    chat: () => openChat(api.directWith(uid).id),
    call: () => startCall(api.directWith(uid).id, false),
    video: () => startCall(api.directWith(uid).id, true),
    fav: () => { api.toggleFav(uid); toast(api.isFav(uid) ? 'Masuk favorit ⭐' : 'Dihapus dari favorit'); },
    add: () => { api.addFriend(uid); toast('Ditambahkan 🎉'); },
    unblock: () => { api.unblock(uid); ; },
    story: () => openStories([uid]),
    more: () => {
      const u = api.user(uid);
      const acts = [{ label: 'Bagikan kontak', icon: 'share', run: () => shareText(`Add ${u.name} di Onix: @${u.id}`) }];
      if (api.isFriend(uid)) acts.push({ label: 'Hapus teman', icon: 'trash', danger: true, run: async () => { if (await confirmBox({ title: `Hapus ${firstName(u.name)}?`, ok: 'Hapus', danger: true })) { api.removeFriend(uid); toast('Teman dihapus'); } } });
      if (!u.official && !api.isBlocked(uid)) acts.push({ label: 'Blokir', icon: 'block', danger: true, run: async () => { if (await confirmBox({ title: `Blokir ${firstName(u.name)}?`, text: 'Kamu nggak bakal nerima pesan dari dia.', ok: 'Blokir', danger: true })) { api.block(uid); toast('Diblokir'); } } });
      sheet({ title: u.name, actions: acts });
    },
  });
  const offs = [bus.on('friends', render), bus.on('presence', render), bus.on('stories', render)];
  render();
  return { el, destroy: () => offs.forEach(f => f()) };
}

function MyProfileScreen() {
  const el = h(`<div class="profile-screen"></div>`);
  function render() {
    const me = api.me();
    const st = api.storyOf(ME);
    el.innerHTML = `
      <div class="profile-cover ${me.cover ? 'has-img' : ''}" style="${coverStyle(me)}">
        <header class="navbar clear"><button class="icon-btn" data-act="back">${icon('back')}</button><div></div><div class="nav-right"><button class="icon-btn" data-act="qr">${icon('qr')}</button></div></header>
      </div>
      <div class="profile-body">
        <button class="pav" data-act="${st ? 'story' : 'edit'}">${avatar(me, 104, { ring: !!st, seen: true })}</button>
        <h1>${esc(me.name)}</h1>
        <div class="pid">@${esc(me.id)}</div>
        <p class="pstatus">${esc(me.status || '')}</p>
        <div class="pactions">
          <button data-act="edit">${icon('edit')}<span>Edit</span></button>
          <button data-act="add-story">${icon('plus')}<span>Story</span></button>
          <button data-act="qr">${icon('qr')}<span>QR</span></button>
        </div>
      </div>`;
  }
  bindActs(el, {
    edit: () => router.push(EditProfileScreen()),
    qr: () => router.push(AddFriendScreen('qr')),
    'add-story': addStoryFlow,
    story: () => openStories([ME]),
  });
  const offs = [bus.on('me', render), bus.on('stories', render)];
  render();
  return { el, destroy: () => offs.forEach(f => f()) };
}

export function EditProfileScreen() {
  const me = api.me();
  let avatarSrc = me.avatar, coverSrc = me.cover || null;
  const el = h(`<div class="sub-screen edit-profile">
    ${navbar('Edit profil', `<button class="text-btn" data-act="save">Simpan</button>`)}
    <div class="content">
      <button class="edit-cover" data-act="cover"><span class="cam-badge">${icon('camera')}</span></button>
      <div class="edit-av"><button data-act="photo">${avatar(me, 96)}<span class="cam-badge">${icon('camera')}</span></button><small>@${esc(me.id)}</small></div>
      <div class="pad">
        <label class="lbl">Nama</label>
        <input class="field" name="name" maxlength="30" value="${esc(me.name)}">
        <label class="lbl">Status <span class="counter"></span></label>
        <input class="field" name="status" maxlength="60" value="${esc(me.status || '')}" placeholder="lagi apa nih?">
        <label class="lbl">🎂 Ulang tahun</label>
        <input class="field" type="date" name="bday" value="${esc(me.birthdayFull || '')}">
      </div>
    </div>
  </div>`);
  const name = $('[name=name]', el), status = $('[name=status]', el), counter = $('.counter', el), cover = $('.edit-cover', el);
  const upd = () => { counter.textContent = `${status.value.length}/60`; };
  status.addEventListener('input', upd); upd();
  const paintCover = () => {
    cover.style.setProperty('--h', me.hue);
    cover.style.backgroundImage = coverSrc ? `url("${coverSrc}")` : '';
    cover.classList.toggle('has-img', !!coverSrc);
  };
  paintCover();
  const refreshAv = () => { $('.edit-av button', el).innerHTML = avatar({ ...me, name: name.value || me.name, avatar: avatarSrc }, 96) + `<span class="cam-badge">${icon('camera')}</span>`; };
  name.addEventListener('input', refreshAv);
  bindActs(el, {
    photo: () => sheet({
      actions: [
        { label: 'Pilih foto', icon: 'image', run: async () => { const f = await pickFile('image/*'); if (f) { avatarSrc = (await compressImage(f, 400, 0.8)).src; refreshAv(); } } },
        ...(avatarSrc ? [{ label: 'Hapus foto', icon: 'trash', danger: true, run: () => { avatarSrc = null; refreshAv(); } }] : []),
      ],
    }),
    cover: () => sheet({
      actions: [
        { label: 'Pilih cover', icon: 'image', run: async () => { const f = await pickFile('image/*'); if (f) { coverSrc = (await compressImage(f, 900, 0.75)).src; paintCover(); } } },
        ...(coverSrc ? [{ label: 'Hapus cover', icon: 'trash', danger: true, run: () => { coverSrc = null; paintCover(); } }] : []),
      ],
    }),
    save: () => {
      const n = name.value.trim();
      if (n.length < 2) return toast('Nama min. 2 huruf');
      const bd = $('[name=bday]', el).value;
      api.updateMe({ name: n, status: status.value.trim(), avatar: avatarSrc, cover: coverSrc, birthdayFull: bd || null, birthday: bd ? bd.slice(5) : null });
      router.back();
    },
  });
  return { el };
}

export const coverStyle = u => `--h:${u.hue}${u.cover ? `;background-image:url('${u.cover}')` : ''}`;
const bdayLabel = mmdd => { if (!mmdd) return ''; const [m, d] = mmdd.split('-').map(Number); return new Date(2000, m - 1, d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }); };

/* ================= ADD FRIEND ================= */
export function AddFriendScreen(initial = 'search') {
  let mode = initial, q = '';
  const el = h(`<div class="sub-screen">
    ${navbar('Tambah teman')}
    <div class="seg-wrap"><div class="seg"><button data-act="mode" data-m="search">ID</button><button data-act="mode" data-m="qr">QR</button></div></div>
    <div class="af-search"><div class="search">${icon('search')}<input placeholder="Cari ID atau nama" autocapitalize="off" autocorrect="off"></div></div>
    <div class="content af-body"></div>
  </div>`);
  const body = $('.af-body', el), inp = $('.af-search input', el), searchWrap = $('.af-search', el);
  const addBtn = u => api.isFriend(u.id) ? `<span class="pill">Teman</span>` : `<button class="btn primary sm" data-act="add" data-id="${u.id}">Tambah</button>`;
  function render() {
    $$('.seg button', el).forEach(b => b.classList.toggle('on', b.dataset.m === mode));
    searchWrap.hidden = mode !== 'search';
    if (mode === 'qr') {
      const me = api.me();
      body.innerHTML = `<div class="qr-card">
        ${avatar(me, 64)}<b>${esc(me.name)}</b><span>@${esc(me.id)}</span>
        <canvas width="220" height="220"></canvas>
      </div>
      <div class="stack pad-x"><button class="btn primary wide" data-act="scan">${icon('scan')} Scan</button><button class="btn ghost wide" data-act="share-id">${icon('share')} Bagikan</button></div>`;
      drawQR($('canvas', body), me.id);
      return;
    }
    const res = api.searchUsers(q);
    const rec = api.recommended();
    body.innerHTML = (q ? `${res.length ? res.map(u => userRow(u, { right: addBtn(u) })).join('') : empty('🔍', 'Nggak ketemu')}` : '')
      + (!q && rec.length ? `<div class="section-h">Saran</div>${rec.map(u => userRow(u, { right: addBtn(u) })).join('')}` : '')
      + (!q && !rec.length ? empty('🫶', 'Udah temenan semua') : '');
  }
  inp.addEventListener('input', () => { q = inp.value; render(); });
  bindActs(el, {
    mode: t => { mode = t.dataset.m; render(); },
    add: t => { api.addFriend(t.dataset.id); vibrate(10); toast('Ditambahkan 🎉'); render(); },
    profile: t => router.push(ProfileScreen(t.dataset.id)),
    'share-id': () => shareText(`Add aku di Onix ya! Onix ID: @${api.me().id}`),
    scan: () => {
      const overlay = h(`<div class="scan-overlay"><div class="scan-box"><i></i></div><button class="btn ghost" data-x>Batal</button></div>`);
      document.getElementById('app').appendChild(overlay);
      requestAnimationFrame(() => overlay.classList.add('show'));
      const close = () => { overlay.classList.remove('show'); setTimeout(() => overlay.remove(), 250); };
      const t = setTimeout(() => {
        close();
        const rec = api.recommended();
        if (!rec.length) return toast('QR nggak kebaca 😅');
        const u = rec[Math.floor(Math.random() * rec.length)];
        toast(`QR terdeteksi: ${u.name} (demo)`);
        router.push(ProfileScreen(u.id));
      }, 2200);
      $('[data-x]', overlay).addEventListener('click', () => { clearTimeout(t); close(); });
    },
  });
  const off = bus.on('friends', render);
  render();
  return { el, destroy: off };
}

function drawQR(canvas, text) {
  const ctx = canvas.getContext('2d');
  const N = 25, S = canvas.width / (N + 2);
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#7C5CFF';
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  let x = hash(text);
  const rnd = () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
  const finder = (cx, cy) => cx < 8 && cy < 8 || cx > N - 9 && cy < 8 || cx < 8 && cy > N - 9;
  ctx.fillStyle = '#111';
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    if (finder(i, j)) continue;
    if (Math.abs(i - 12) < 3 && Math.abs(j - 12) < 3) continue;
    if (rnd() < 0.48) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect((i + 1) * S, (j + 1) * S, S, S, S * 0.3) : ctx.rect((i + 1) * S, (j + 1) * S, S, S); ctx.fill(); }
  }
  [[0, 0], [N - 7, 0], [0, N - 7]].forEach(([a, b]) => {
    const px = (a + 1) * S, py = (b + 1) * S;
    ctx.fillStyle = '#111'; rr(ctx, px, py, 7 * S, 7 * S, S * 1.6); ctx.fill();
    ctx.fillStyle = '#fff'; rr(ctx, px + S, py + S, 5 * S, 5 * S, S * 1.1); ctx.fill();
    ctx.fillStyle = accent; rr(ctx, px + 2 * S, py + 2 * S, 3 * S, 3 * S, S * 0.8); ctx.fill();
  });
  ctx.fillStyle = accent; rr(ctx, 11 * S, 11 * S, 5 * S, 5 * S, S * 1.4); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = `bold ${S * 3}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('o', 13.5 * S, 13.3 * S);
}
function rr(ctx, x, y, w, hh, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + hh, r); ctx.arcTo(x + w, y + hh, x, y + hh, r); ctx.arcTo(x, y + hh, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

export async function shareText(text) {
  if (navigator.share) { try { await navigator.share({ text }); return; } catch { return; } }
  await copyText(text); toast('Disalin');
}

/* ================= FRIEND PICKER / NEW GROUP ================= */
export function FriendPicker({ title, multi = false, exclude = [], confirm = 'Selesai', onDone }) {
  const sel = new Set();
  let q = '';
  const el = h(`<div class="sub-screen">
    ${navbar(esc(title), multi ? `<button class="text-btn" data-act="done" disabled>${esc(confirm)}</button>` : '')}
    <div class="af-search"><div class="search">${icon('search')}<input placeholder="Cari teman"></div></div>
    <div class="content picker-body"></div>
  </div>`);
  const body = $('.picker-body', el);
  function render() {
    const list = api.friends().filter(u => !exclude.includes(u.id) && u.name.toLowerCase().includes(q.toLowerCase()));
    body.innerHTML = list.length ? list.map(u => `<div class="list-item" data-act="pick" data-id="${u.id}">${userAvatar(u, 44, { online: true })}<div class="li-main"><div class="li-name">${esc(u.name)}</div><div class="li-sub">${esc(u.status || '')}</div></div>${multi ? `<span class="check ${sel.has(u.id) ? 'on' : ''}">${icon('check')}</span>` : ''}</div>`).join('') : empty('🫥', 'Nggak ada teman yang cocok');
    const d = $('[data-act=done]', el);
    if (d) { d.disabled = !sel.size; d.textContent = sel.size ? `${confirm} (${sel.size})` : confirm; }
  }
  $('input', el).addEventListener('input', e => { q = e.target.value; render(); });
  bindActs(el, {
    pick: t => {
      if (!multi) { onDone([t.dataset.id]); return; }
      const id = t.dataset.id; sel.has(id) ? sel.delete(id) : sel.add(id); vibrate(5); render();
    },
    done: () => sel.size && onDone([...sel]),
  });
  render();
  return { el };
}

export function NewGroupScreen() {
  const sel = new Set();
  const EMO = ['✨', '🔥', '💅', '🎧', '🍕', '🚀', '📚', '🌈', '🎮', '⚽'];
  let emoji = EMO[0], q = '';
  const el = h(`<div class="sub-screen">
    ${navbar('Grup baru', `<button class="text-btn" data-act="create" disabled>Buat</button>`)}
    <div class="ng-head">
      <div class="ng-row"><button class="ng-emoji" data-act="emo">${emoji}</button><input class="field" maxlength="40" placeholder="Nama grup"></div>
      <div class="chips"></div>
      <div class="search">${icon('search')}<input class="q" placeholder="Cari teman"></div>
    </div>
    <div class="content picker-body"></div>
  </div>`);
  const name = $('.ng-row input', el), body = $('.picker-body', el), chips = $('.chips', el);
  function render() {
    const list = api.friends().filter(u => u.name.toLowerCase().includes(q.toLowerCase()));
    body.innerHTML = `<div class="section-h">Pilih anggota</div>` + list.map(u => `<div class="list-item" data-act="pick" data-id="${u.id}">${userAvatar(u, 44)}<div class="li-main"><div class="li-name">${esc(u.name)}</div></div><span class="check ${sel.has(u.id) ? 'on' : ''}">${icon('check')}</span></div>`).join('');
    chips.innerHTML = [...sel].map(id => `<button class="chip-user" data-act="pick" data-id="${id}">${avatar(api.user(id), 22)}${esc(firstName(api.user(id).name))}${icon('x', 'tiny')}</button>`).join('');
    $('[data-act=create]', el).disabled = !(sel.size && name.value.trim());
  }
  name.addEventListener('input', render);
  $('.q', el).addEventListener('input', e => { q = e.target.value; render(); });
  bindActs(el, {
    emo: t => { emoji = EMO[(EMO.indexOf(emoji) + 1) % EMO.length]; t.textContent = emoji; vibrate(5); },
    pick: t => { const id = t.dataset.id; sel.has(id) ? sel.delete(id) : sel.add(id); vibrate(5); render(); },
    create: async () => {
      const n = name.value.trim();
      if (!n || !sel.size) return;
      const ids = [...sel], online = ids.filter(id => api.user(id)?.remote);
      let c;
      if (online.length) {
        if (online.length !== ids.length) return toast('Grup online cuma bisa isi teman online 🌐');
        const be = await import('./backend.js');
        try { c = await be.createGroup(n, ids, emoji); } catch (e) { return toast(be.errText(e)); }
      } else c = api.createGroup(n, ids, emoji);
      history.back();
      setTimeout(() => openChat(c.id), 380);
    },
  });
  render();
  return { el };
}

/* ================= GROUP INFO ================= */
export function GroupInfoScreen(chatId) {
  const el = h(`<div class="sub-screen">${navbar('Info grup')}<div class="content gi-body"></div></div>`);
  const body = $('.gi-body', el);
  function render() {
    const c = api.chat(chatId);
    if (!c) return;
    const imgs = api.images(chatId);
    body.innerHTML = `
      <div class="gi-head">${chatAvatar(c, 96)}<h2>${esc(c.name)} <button class="icon-btn sm" data-act="rename">${icon('edit')}</button></h2><span>${c.members.length} anggota</span></div>
      <div class="pactions">
        <button data-act="call">${icon('phone')}<span>Telepon</span></button>
        <button data-act="video">${icon('video')}<span>Video</span></button>
        <button data-act="mute" class="${c.muted ? 'on' : ''}">${icon(c.muted ? 'bellOff' : 'bell')}<span>${c.muted ? 'Dibisukan' : 'Notif'}</span></button>
        <button data-act="album">${icon('grid')}<span>Album</span></button>
      </div>
      ${imgs.length ? `<div class="section-h">Foto <button class="link" data-act="album">Lihat semua</button></div><div class="mini-album">${imgs.slice(-4).reverse().map(m => `<button data-act="img" data-src="${m.id}"><img src="${m.src}" alt=""></button>`).join('')}</div>` : ''}
      <div class="list-item slim" data-act="notes"><span class="round-ic">${icon('note')}</span><div class="li-main"><div class="li-name">Catatan</div></div><span class="count">${api.notes(chatId).length || ''}</span>${icon('chevronRight', 'tiny')}</div>
      <div class="section-h">Anggota</div>
      <div class="list-item" data-act="add-members"><span class="round-ic">${icon('userPlus')}</span><div class="li-main"><div class="li-name accent-txt">Tambah anggota</div></div></div>
      ${c.members.map(id => { const u = api.user(id); return id === ME ? `<div class="list-item">${avatar(u, 44)}<div class="li-main"><div class="li-name">${esc(u.name)} <span class="pill">Kamu</span></div></div></div>` : userRow(u, { sub: presence(u) }); }).join('')}
      <div class="pad"><button class="btn danger-ghost wide" data-act="leave">${icon('logout')} Keluar dari grup</button></div>`;
  }
  bindActs(el, {
    rename: async () => { const v = await promptBox({ title: 'Ganti nama grup', value: api.chat(chatId).name, max: 40 }); if (v) api.renameGroup(chatId, v); },
    call: () => startCall(chatId, false),
    video: () => startCall(chatId, true),
    mute: () => api.toggleMute(chatId),
    album: () => router.push(AlbumScreen(chatId)),
    notes: () => router.push(NotesScreen(chatId)),
    img: t => { const all = api.images(chatId).slice().reverse(); const i = all.findIndex(x => x.id === t.dataset.src); if (i >= 0) openGallery(all.map(m => ({ src: m.src })), i); },
    profile: t => router.push(ProfileScreen(t.dataset.id)),
    'add-members': () => router.push(FriendPicker({
      title: 'Tambah anggota', multi: true, exclude: api.chat(chatId).members, confirm: 'Tambah',
      onDone: ids => { api.addMembers(chatId, ids); history.back();  },
    })),
    leave: async () => {
      if (!(await confirmBox({ title: 'Keluar dari grup?', text: 'Kamu nggak bakal nerima pesan dari grup ini lagi.', ok: 'Keluar', danger: true }))) return;
      api.leaveGroup(chatId);
      history.go(-2);
    },
  });
  const offs = [bus.on('chats', render), bus.on('messages', id => id === chatId && render()), bus.on('notes', id => id === chatId && render())];
  render();
  return { el, destroy: () => offs.forEach(f => f()) };
}

export function AlbumScreen(chatId) {
  const imgs = api.images(chatId).slice().reverse();
  const el = h(`<div class="sub-screen">${navbar('Album')}<div class="content">${imgs.length ? `<div class="album">${imgs.map(m => `<button data-act="img" data-id="${m.id}"><img src="${m.src}" alt="" loading="lazy"></button>`).join('')}</div>` : empty('🖼️', 'Belum ada foto')}</div></div>`);
  bindActs(el, { img: t => { const i = imgs.findIndex(x => x.id === t.dataset.id); if (i >= 0) openGallery(imgs.map(m => ({ src: m.src, caption: api.user(m.from)?.name || '' })), i); } });
  return { el };
}

/* ================= IMAGE VIEWER ================= */
export function openImage(src, caption = '') { return openGallery([{ src, caption }], 0); }

/* galeri: geser kiri/kanan, cubit/ketuk 2x untuk zoom, geser bawah untuk tutup */
export function openGallery(items, start = 0) {
  if (!items.length) return;
  let idx = Math.min(start, items.length - 1), scale = 1, tx = 0, ty = 0;
  const multi = items.length > 1;
  const el = h(`<div class="viewer gallery">
    <div class="viewer-top"><button class="icon-btn" data-x aria-label="Tutup">${icon('x')}</button><span class="g-cap"></span>${multi ? '<small class="g-count"></small>' : ''}<a class="icon-btn g-dl" download="onix-foto.jpg" aria-label="Simpan">${icon('download')}</a></div>
    <div class="g-track">${items.map(() => `<div class="g-slide"><img alt=""></div>`).join('')}</div>
    ${multi && items.length <= 12 ? `<div class="g-dots">${items.map(() => '<i></i>').join('')}</div>` : ''}
  </div>`);
  const track = $('.g-track', el), slides = [...el.querySelectorAll('.g-slide')];
  const img = i => slides[i]?.querySelector('img');
  document.getElementById('app').appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  const W = () => el.clientWidth;
  function load() { for (let i = idx - 1; i <= idx + 1; i++) if (items[i] && !img(i).src) img(i).src = items[i].src; }
  function applyZoom(anim) {
    const im = img(idx);
    im.style.transition = anim ? 'transform .25s var(--ease)' : 'none';
    im.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
    el.classList.toggle('zoomed', scale > 1.01);
  }
  function go(i, anim = true) {
    if (i !== idx) { scale = 1; tx = ty = 0; applyZoom(false); }
    idx = Math.max(0, Math.min(items.length - 1, i));
    track.style.transition = anim ? 'transform .3s var(--ease)' : 'none';
    track.style.transform = `translateX(${-idx * W()}px)`;
    $('.g-cap', el).textContent = items[idx].caption || '';
    const c = $('.g-count', el); if (c) c.textContent = `${idx + 1}/${items.length}`;
    el.querySelectorAll('.g-dots i').forEach((d, k) => d.classList.toggle('on', k === idx));
    $('.g-dl', el).href = items[idx].src;
    load();
  }
  const close = () => { el.classList.remove('show'); document.removeEventListener('keydown', onKey); setTimeout(() => el.remove(), 250); };
  const onKey = e => { if (e.key === 'Escape') close(); if (e.key === 'ArrowRight') go(idx + 1); if (e.key === 'ArrowLeft') go(idx - 1); };
  document.addEventListener('keydown', onKey);
  $('[data-x]', el).addEventListener('click', close);
  function clampPan() {
    const im = img(idx), r = im.getBoundingClientRect();
    const bw = r.width / scale, bh = r.height / scale;
    const mx = Math.max(0, (bw * scale - W()) / 2), my = Math.max(0, (bh * scale - el.clientHeight) / 2);
    tx = Math.max(-mx, Math.min(mx, tx)); ty = Math.max(-my, Math.min(my, ty));
  }
  function zoomAt(x, y, s) {
    const r = el.getBoundingClientRect();
    const cx = x - r.left - r.width / 2, cy = y - r.top - r.height / 2;
    const k = s / scale;
    tx = cx - (cx - tx) * k; ty = cy - (cy - ty) * k; scale = s;
    if (scale <= 1) { scale = 1; tx = ty = 0; } else clampPan();
  }
  // gestures
  let g = null, lastTap = 0, tapT = null;
  const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  el.addEventListener('touchstart', e => {
    if (e.target.closest('.viewer-top')) return;
    const t = e.touches;
    if (t.length === 2) { g = { mode: 'pinch', d: dist(t), s: scale, mx: (t[0].clientX + t[1].clientX) / 2, my: (t[0].clientY + t[1].clientY) / 2 }; return; }
    g = { mode: null, x: t[0].clientX, y: t[0].clientY, tx, ty, t0: Date.now(), moved: false };
  }, { passive: true });
  el.addEventListener('touchmove', e => {
    if (!g) return;
    const t = e.touches;
    if (g.mode === 'pinch' && t.length === 2) {
      const s = Math.max(1, Math.min(4, g.s * dist(t) / g.d));
      zoomAt(g.mx, g.my, s); applyZoom(false); return;
    }
    if (t.length !== 1) return;
    const dx = t[0].clientX - g.x, dy = t[0].clientY - g.y;
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) g.moved = true;
    if (!g.mode && g.moved) g.mode = scale > 1.01 ? 'pan' : Math.abs(dx) > Math.abs(dy) ? 'swipe' : 'dismiss';
    if (g.mode === 'pan') { tx = g.tx + dx; ty = g.ty + dy; clampPan(); applyZoom(false); }
    if (g.mode === 'swipe') {
      const edge = (idx === 0 && dx > 0) || (idx === items.length - 1 && dx < 0);
      track.style.transition = 'none';
      track.style.transform = `translateX(${-idx * W() + (edge ? dx / 3 : dx)}px)`;
    }
    if (g.mode === 'dismiss') { img(idx).style.transform = `translateY(${dy}px) scale(${1 - Math.min(.25, Math.abs(dy) / 1200)})`; el.style.setProperty('--o', Math.max(0.2, 1 - Math.abs(dy) / 400)); }
  }, { passive: true });
  el.addEventListener('touchend', e => {
    if (!g || e.touches.length) { if (g?.mode === 'pinch' && e.touches.length === 1) g = null; return; }
    const ct = e.changedTouches[0];
    const dx = ct.clientX - (g.x ?? ct.clientX), dy = ct.clientY - (g.y ?? ct.clientY);
    const s = g; g = null;
    if (s.mode === 'pinch') { if (scale < 1.05) { scale = 1; tx = ty = 0; } applyZoom(true); return; }
    if (s.mode === 'swipe') {
      const fast = Date.now() - s.t0 < 250 && Math.abs(dx) > 30;
      go(Math.abs(dx) > W() * .25 || fast ? idx + (dx < 0 ? 1 : -1) : idx);
      return;
    }
    if (s.mode === 'dismiss') {
      if (Math.abs(dy) > 120) close();
      else { img(idx).style.transition = 'transform .25s var(--ease)'; img(idx).style.transform = ''; el.style.removeProperty('--o'); }
      return;
    }
    if (s.moved || e.target.closest('.viewer-top')) return;
    // tap / double tap
    const now = Date.now();
    if (now - lastTap < 300) {
      clearTimeout(tapT); lastTap = 0;
      zoomAt(ct.clientX, ct.clientY, scale > 1.01 ? 1 : 2.5); applyZoom(true);
      return;
    }
    lastTap = now;
    tapT = setTimeout(() => el.classList.toggle('bare-ui'), 300);
  });
  // desktop: klik = sembunyikan UI, dobel klik = zoom
  let lastTouch = 0;
  el.addEventListener('touchstart', () => { lastTouch = Date.now(); }, { passive: true, capture: true });
  el.addEventListener('dblclick', e => { if (Date.now() - lastTouch < 1000 || e.target.closest('.viewer-top')) return; zoomAt(e.clientX, e.clientY, scale > 1.01 ? 1 : 2.5); applyZoom(true); });
  window.addEventListener('resize', () => go(idx, false), { once: true });
  go(idx, false);
}

/* ================= VOOM ================= */
export function PostComposeScreen() {
  let images = [];
  const me = api.me();
  const el = h(`<div class="sub-screen">
    ${navbar('Post baru', `<button class="text-btn" data-act="post" disabled>Posting</button>`)}
    <div class="content pad">
      <div class="compose-row">${avatar(me, 42)}<textarea placeholder="Bagikan sesuatu…" maxlength="500"></textarea></div>
      <div class="compose-img" hidden></div>
    </div>
    <div class="compose-tools"><button class="tool" data-act="photo">${icon('image')} Foto</button><button class="tool" data-act="cam">${icon('camera')} Kamera</button><span class="counter">0/500</span></div>
  </div>`);
  const ta = $('textarea', el), imgBox = $('.compose-img', el), postBtn = $('[data-act=post]', el);
  const upd = () => { postBtn.disabled = !(ta.value.trim() || images.length); $('.counter', el).textContent = `${ta.value.length}/500`; };
  ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; upd(); });
  const paintImgs = () => {
    imgBox.hidden = !images.length;
    imgBox.classList.toggle('multi', images.length > 1);
    imgBox.innerHTML = images.map((src, i) => `<div class="ci-item"><img src="${src}" alt=""><button class="icon-btn rm" data-act="rm" data-i="${i}">${icon('x')}</button></div>`).join('');
    upd();
  };
  const pick = async cap => {
    const fs = cap ? [await pickFile('image/*', cap)].filter(Boolean) : await pickFiles('image/*', 10 - images.length);
    for (const f of fs) images.push((await compressImage(f, 1080, .76)).src);
    images = images.slice(0, 10); paintImgs();
  };
  bindActs(el, {
    photo: () => pick(), cam: () => pick('environment'), rm: t => { images.splice(+t.dataset.i, 1); paintImgs(); },
    post: () => { api.createPost({ text: ta.value.trim(), images }); router.back(); },
  });
  setTimeout(() => ta.focus(), 350);
  return { el };
}

export function PostDetailScreen(pid) {
  const el = h(`<div class="sub-screen">${navbar('Post')}<div class="content pd-body"></div>
    <div class="comment-bar">${avatar(api.me(), 32)}<input placeholder="Komentar" maxlength="300" enterkeyhint="send"><button class="send-btn active" data-act="send">${icon('send')}</button></div></div>`);
  const body = $('.pd-body', el), inp = $('.comment-bar input', el);
  function render() {
    const p = api.post(pid);
    if (!p) { body.innerHTML = empty('🫥', 'Post udah dihapus'); return; }
    body.innerHTML = postCard(p, { detail: true }) + `<div class="section-h">${icon('comment', 'tiny')} ${p.comments.length}</div>` +
      (p.comments.length ? p.comments.map(cm => { const u = api.user(cm.userId); const lk = cm.likes || [], on = lk.includes(ME), byAuthor = lk.includes(p.userId) && p.userId !== cm.userId && p.userId !== ME; return `<div class="comment">${avatar(u, 34)}<div class="cm-main"><div class="cm-bubble"><b>${esc(cm.userId === ME ? 'Kamu' : u?.name)}</b>${esc(cm.text)}</div><small>${ago(cm.ts)}${byAuthor ? ` · <span class="cm-auth">${icon('heart', 'tiny')} ${esc(firstName(api.user(p.userId)?.name || ''))}</span>` : ''}</small></div><button class="cm-like ${on ? 'on' : ''}" data-act="cm-like" data-pid="${p.id}" data-cid="${cm.id}">${icon('heart')}<span>${lk.length || ''}</span></button></div>`; }).join('') : `<p class="hint center">💬</p>`);
  }
  const send = () => { const v = inp.value.trim(); if (!v) return; api.comment(pid, v); inp.value = ''; setTimeout(() => body.scrollTo({ top: body.scrollHeight, behavior: 'smooth' }), 50); };
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
  bindActs(el, postActions({ send, 'focus-comment': () => inp.focus() }));
  const off = bus.on('posts', render);
  render();
  return { el, destroy: off };
}

export function postActions(extra = {}) {
  return {
    like: t => { const liked = api.toggleLike(t.dataset.id); if (liked) { vibrate(8); t.classList.add('pop'); } },
    post: t => router.push(PostDetailScreen(t.dataset.id)),
    profile: t => router.push(ProfileScreen(t.dataset.id)),
    'view-src': t => {
      const p = api.post(t.dataset.srcPost);
      const imgs = p?.images?.length ? p.images : p?.image ? [p.image] : [];
      if (imgs.length) openGallery(imgs.map(src => ({ src, caption: api.user(p.userId)?.name || '' })), +t.dataset.i || 0);
    },
    'share-post': t => {
      const p = api.post(t.dataset.id);
      sheet({ actions: [
        { label: 'Kirim ke chat', icon: 'send', run: () => router.push(ChatPicker({ title: 'Kirim ke…', onDone: ids => { api.sharePost(p.id, ids); history.back(); toast('Terkirim ✈️'); } })) },
        { label: 'Bagikan', icon: 'share', run: () => shareText(`${api.user(p.userId)?.name} di Onix VOOM: "${p.text}"`) },
      ] });
    },
    'cm-like': t => { const on = api.toggleCommentLike(t.dataset.pid, t.dataset.cid); if (on) vibrate(6); },
    'post-more': t => {
      const p = api.post(t.dataset.id);
      const acts = p.userId === ME
        ? [{ label: 'Hapus post', icon: 'trash', danger: true, run: async () => { if (await confirmBox({ title: 'Hapus post ini?', ok: 'Hapus', danger: true })) { api.deletePost(p.id); if (router.top()?.el.querySelector('.pd-body')) router.back(); } } }]
        : [{ label: 'Lihat profil', icon: 'user', run: () => router.push(ProfileScreen(p.userId)) }, { label: 'Laporkan', icon: 'info', run: () => toast('Makasih, laporan diterima (demo)') }];
      sheet({ actions: acts });
    },
    ...extra,
  };
}

/* ================= STORIES ================= */
export function addStoryFlow() {
  const COLORS = [265, 330, 200, 150, 25, 0];
  sheet({
    title: 'Story baru', actions: [
      { label: 'Foto', icon: 'image', run: async () => { const f = await pickFile('image/*'); if (f) { const img = await compressImage(f, 900); api.addMyStory({ image: img.src, hue: 260 });  } } },
      { label: 'Teks', icon: 'type', run: () => openStoryEditor() },
    ],
  });
}

export const STORY_BGS = [
  'linear-gradient(160deg,#7C5CFF,#FF3D6E)', 'linear-gradient(160deg,#FF7A1A,#FFC53D)', 'linear-gradient(160deg,#00C6FF,#0072FF)',
  'linear-gradient(160deg,#2EE6A6,#0FA36B)', 'linear-gradient(160deg,#FF9A9E,#FAD0C4)', 'linear-gradient(160deg,#232526,#414345)',
  'linear-gradient(160deg,#F7971E,#FF3D6E,#7C5CFF)', '#111',
];
const STORY_FONTS = [['sans', 'Aa'], ['heavy', 'AA'], ['serif', 'Aa'], ['hand', 'Aa'], ['mono', 'Aa']];
const storyFontSize = t => { const n = (t || '').length; return n < 20 ? 40 : n < 50 ? 32 : n < 100 ? 26 : 21; };

export function openStoryEditor() {
  let bg = Math.floor(Math.random() * STORY_BGS.length), font = 0;
  const el = h(`<div class="story-editor">
    <div class="se-top"><button class="icon-btn" data-x aria-label="Tutup">${icon('x')}</button><button class="se-font" data-sfont></button><button class="se-post" data-post disabled>${icon('send')}</button></div>
    <div class="se-mid"><textarea maxlength="200" rows="1" placeholder="Ketik sesuatu…"></textarea></div>
    <div class="se-bgs">${STORY_BGS.map((b, i) => `<button data-bg="${i}" style="background:${b}"></button>`).join('')}</div>
  </div>`);
  document.getElementById('app').appendChild(el);
  const ta = $('textarea', el);
  const paint = () => {
    el.style.background = STORY_BGS[bg];
    const [k, l] = STORY_FONTS[font];
    ta.className = 'sf-' + k; $('[data-sfont]', el).className = 'se-font sf-' + k; $('[data-sfont]', el).textContent = l;
    el.querySelectorAll('[data-bg]').forEach(b => b.classList.toggle('on', +b.dataset.bg === bg));
    ta.style.fontSize = storyFontSize(ta.value) + 'px';
    ta.style.height = 'auto'; if (ta.scrollHeight) ta.style.height = ta.scrollHeight + 'px';
    $('[data-post]', el).disabled = !ta.value.trim();
  };
  const close = () => { el.classList.remove('show'); setTimeout(() => el.remove(), 250); };
  ta.addEventListener('input', paint);
  el.addEventListener('click', e => {
    if (e.target.closest('[data-x]')) return close();
    const b = e.target.closest('[data-bg]');
    if (b) { bg = +b.dataset.bg; vibrate(4); paint(); return; }
    if (e.target.closest('[data-sfont]')) { font = (font + 1) % STORY_FONTS.length; vibrate(4); paint(); return; }
    if (e.target.closest('[data-post]')) {
      const text = ta.value.trim();
      if (!text) return;
      api.addMyStory({ text, bg, font: STORY_FONTS[font][0] });
      close(); toast('Story diupload ✨');
      return;
    }
    if (e.target === el || e.target.closest('.se-mid')) ta.focus();
  });
  paint();
  requestAnimationFrame(() => { el.classList.add('show'); ta.focus(); });
}

export function openStories(uids, start = 0) {
  uids = uids.filter(id => api.storyOf(id)?.items.length);
  if (!uids.length) return;
  let ui = start, ii = 0, elapsed = 0, last = 0, paused = false, raf = 0;
  const DUR = 5000;
  const el = h(`<div class="story-view">
    <div class="story-stage"></div>
    <div class="story-top"><div class="story-bars"></div><div class="story-head"></div></div>
    <div class="story-nav"><div data-nav="prev"></div><div data-nav="next"></div></div>
    <div class="story-bottom"></div>
  </div>`);
  document.getElementById('app').appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  const stage = $('.story-stage', el), bars = $('.story-bars', el), head = $('.story-head', el), bottom = $('.story-bottom', el);

  function show() {
    const uid = uids[ui];
    const s = api.storyOf(uid), u = api.user(uid), it = s.items[ii];
    if (uid !== ME) api.markStorySeen(uid);
    elapsed = 0;
    bars.innerHTML = s.items.map((_, k) => `<i><b style="width:${k < ii ? 100 : 0}%"></b></i>`).join('');
    head.innerHTML = `${avatar(u, 34)}<b>${esc(uid === ME ? 'Story kamu' : u.name)}</b><span>${ago(it.ts)}</span><button class="icon-btn" data-x>${icon('x')}</button>`;
    stage.style.setProperty('--h', it.hue ?? 260);
    stage.style.background = it.bg != null ? STORY_BGS[it.bg] : '';
    stage.innerHTML = it.image ? `<img src="${it.image}" alt="">`
      : it.bg != null ? `<div class="story-txt sf-${it.font || 'sans'}"><p style="font-size:${storyFontSize(it.text)}px">${esc(it.text || '').replace(/\n/g, '<br>')}</p></div>`
      : `<div class="story-txt"><div class="se">${it.emoji || '✨'}</div><p>${esc(it.text || '')}</p></div>`;
    renderBottom();
  }
  function renderBottom() {
    const uid = uids[ui], s = api.storyOf(uid), it = s?.items[ii];
    if (!it) return;
    if (uid === ME) {
      const vs = it.viewers || [];
      bottom.innerHTML = `<div class="story-own"><button class="sv-btn" data-views>${vs.length ? `<span class="sv-avs">${vs.slice(-3).map(v => avatar(api.user(v.id), 24)).join('')}</span>` : icon('eye', 'tiny')}<b>${vs.length}</b>${vs.some(v => v.react) ? `<span class="sv-r">${[...new Set(vs.filter(v => v.react).map(v => v.react))].slice(0, 3).join('')}</span>` : ''}</button><button class="icon-btn" data-del aria-label="Hapus">${icon('trash')}</button></div>`;
    } else {
      bottom.innerHTML = `<div class="story-reacts">${['😂', '😍', '🔥', '😮', '😢', '👏'].map(e => `<button data-q="${e}">${e}</button>`).join('')}</div>
        <div class="story-reply"><input placeholder="Balas…" maxlength="200" enterkeyhint="send"><button class="react-like ${it.myReact === '❤️' ? 'on' : ''}" data-like aria-label="Suka">${icon('heart')}</button></div>`;
    }
  }
  function burst(emo) {
    const b = document.createElement('div');
    b.className = 'story-burst';
    b.innerHTML = Array.from({ length: 7 }, (_, k) => `<i style="--x:${Math.round(Math.random() * 160 - 80)}px;--d:${(k * .06).toFixed(2)}s">${emo}</i>`).join('');
    el.appendChild(b); setTimeout(() => b.remove(), 1400);
  }
  function viewersSheet() {
    const it = api.storyOf(ME)?.items[ii];
    if (!it) return;
    paused = true;
    const vs = (it.viewers || []).slice().reverse();
    sheet({
      top: `<div class="sv-list"><div class="sv-head">${icon('eye')} <b>${vs.length}</b></div>${vs.length ? vs.map(v => { const u = api.user(v.id); return `<div class="list-item">${avatar(u, 42)}<div class="li-main"><div class="li-name">${esc(u?.name || '')}</div><div class="li-sub">${ago(v.ts)}</div></div>${v.react ? `<span class="sv-react">${v.react}</span>` : ''}</div>`; }).join('') : `<div class="sv-empty">👀</div>`}</div>`,
    }).then(() => { paused = false; });
  }
  function next() { const s = api.storyOf(uids[ui]); if (ii < s.items.length - 1) ii++; else if (ui < uids.length - 1) { ui++; ii = 0; } else return close(); show(); }
  function prev() { if (ii > 0) ii--; else if (ui > 0) { ui--; ii = 0; } show(); }
  function loop(t) {
    if (!last) last = t;
    const dt = t - last; last = t;
    if (!paused) elapsed += dt;
    const b = bars.children[ii]?.firstElementChild;
    if (b) b.style.width = Math.min(100, (elapsed / DUR) * 100) + '%';
    if (elapsed >= DUR) next();
    raf = requestAnimationFrame(loop);
  }
  function close() { cancelAnimationFrame(raf); offStories?.(); el.classList.remove('show'); setTimeout(() => el.remove(), 250); }

  let downT = 0;
  el.addEventListener('pointerdown', e => { if (e.target.closest('.story-bottom,.story-head')) return; downT = Date.now(); paused = true; });
  el.addEventListener('pointerup', e => {
    if (e.target.closest('.story-bottom,.story-head')) return;
    paused = false;
    const nav = e.target.closest('[data-nav]');
    if (nav && Date.now() - downT < 250) nav.dataset.nav === 'next' ? next() : prev();
  });
  el.addEventListener('click', async e => {
    if (e.target.closest('[data-x]')) return close();
    if (e.target.closest('[data-del]')) { paused = true; if (await confirmBox({ title: 'Hapus story?', ok: 'Hapus', danger: true })) { api.deleteMyStory(); close(); } else paused = false; return; }
    if (e.target.closest('[data-views]')) return viewersSheet();
    const q = e.target.closest('[data-q]');
    if (q) { burst(q.dataset.q); replyStory(q.dataset.q, true); e.target.closest('input')?.blur(); }
    if (e.target.closest('[data-like]')) {
      const uid = uids[ui], it = api.storyOf(uid).items[ii];
      const on = api.reactStory(uid, it.id, '❤️');
      if (on) { burst('❤️'); replyStory('❤️', true); }
      vibrate(8); renderBottom();
    }
  });
  function replyStory(text, quiet) {
    const uid = uids[ui];
    const it = api.storyOf(uid).items[ii];
    const c = api.directWith(uid);
    api.send(c.id, { type: 'text', text, replyTo: { id: 'story', name: 'Story ' + firstName(api.user(uid).name), text: it.text || '📷 Foto' } });
    if (!quiet) toast('Terkirim 💌');
    vibrate(8);
  }
  const offStories = bus.on('stories', () => { if (uids[ui] === ME) renderBottom(); });
  el.addEventListener('focusin', () => { paused = true; el.classList.add('typing'); });
  el.addEventListener('focusout', () => { paused = false; setTimeout(() => el.classList.remove('typing'), 150); });
  el.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.matches('.story-reply input')) { const v = e.target.value.trim(); if (v) { replyStory(v); e.target.value = ''; e.target.blur(); } }
  });
  show();
  raf = requestAnimationFrame(loop);
}

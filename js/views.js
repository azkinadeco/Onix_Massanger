// Potongan tampilan yang dipakai di banyak layar
import { api, ME, firstName } from './service.js';
import { esc, avatar, ago, listTime } from './util.js';
import { icon } from './icons.js';

export function userAvatar(u, size, opts = {}) {
  return avatar(u, size, { online: opts.online && u?.online && !u.official, ...opts });
}

export function chatAvatar(c, size = 52, opts = {}) {
  if (c.type === 'group') return avatar({ name: c.name, hue: c.hue, emoji: c.emoji, avatar: c.avatar }, size, { sq: true, ...opts });
  const u = api.peerOf(c);
  return userAvatar(u, size, { online: opts.online !== false, ...opts });
}

export function presence(u) {
  if (!u) return '';
  if (u.official) return 'Akun resmi';
  if (u.remote) return u.online ? 'Online' : u.lastSeen ? `Aktif ${ago(u.lastSeen)}` : '@' + u.handle;
  return u.online ? 'Online' : `Aktif ${ago(u.lastSeen)}`;
}

export function preview(m, c) {
  if (!m) return '';
  if (m.type === 'system') return m.text;
  let who = '';
  if (m.from === ME) who = 'Kamu: ';
  else if (c.type === 'group') who = firstName(api.user(m.from)?.name) + ': ';
  if (m.unsent) return who + 'Pesan ditarik';
  const body = { sticker: 'Sticker ' + (m.sticker || ''), image: m.album?.length > 1 ? `📷 ${m.album.length} foto` : '📷 Foto', voice: '🎤 Voice note', location: '📍 ' + (m.title || 'Lokasi'), poll: '📊 ' + (m.poll?.q || 'Polling'), event: '📅 ' + (m.event?.title || 'Event'), video: '🎬 Video', file: '📎 ' + (m.name || 'File'), post: '📰 Post VOOM', game: { dice: '🎲 Dadu', coin: '🪙 Koin', suit: '✊ Suit' }[m.game], pay: { send: '💸 Kirim uang', request: '💸 Minta uang', split: '💸 Patungan' }[m.kind] }[m.type] || m.text;
  return who + body;
}

export const verified = () => `<span class="verified">${icon('verified')}</span>`;

export function userRow(u, { act = 'profile', right = '', sub } = {}) {
  return `<div class="list-item" data-act="${act}" data-id="${u.id}">
    ${userAvatar(u, 46, { online: true })}
    <div class="li-main"><div class="li-name">${esc(u.name)}${u.official ? verified() : ''}</div><div class="li-sub">${esc(sub ?? u.status ?? '')}</div></div>
    ${right}
  </div>`;
}

export function chatRow(c) {
  const title = api.chatTitle(c);
  const last = api.lastMessage(c.id);
  const typing = api.typingIn(c.id);
  let sub;
  if (typing.length) sub = `<span class="accent-txt">${c.type === 'group' ? esc(firstName(api.user(typing[0])?.name)) + ' ' : ''}lagi ngetik…</span>`;
  else if (c.draft) sub = `<span class="draft">Draft:</span> ${esc(c.draft)}`;
  else sub = esc(preview(last, c)).replace(/(^|\s)[*_~`]([^*_~`\n]+)[*_~`](?=$|[\s.,!?])/g, '$1$2');
  const peer = api.peerOf(c);
  return `<div class="list-item chat-item" data-act="open-chat" data-id="${c.id}">
    ${chatAvatar(c, 54)}
    <div class="li-main">
      <div class="li-top"><span class="li-name">${esc(title)}</span>${peer?.official ? verified() : ''}${c.type === 'group' ? `<span class="count">${c.members.length}</span>` : ''}${c.muted ? icon('bellOff', 'tiny muted-ic') : ''}<span class="li-time">${last ? listTime(last.ts) : ''}</span></div>
      <div class="li-bottom"><span class="li-sub">${sub}</span>${c.pinned ? icon('pin', 'tiny pin-ic') : ''}${c.mention ? `<b class="mention-badge">@</b>` : ''}${c.unread ? `<b class="unread ${c.muted ? 'muted' : ''}">${c.unread > 99 ? '99+' : c.unread}</b>` : ''}</div>
    </div>
  </div>`;
}

export function postCard(p, { detail = false } = {}) {
  const u = api.user(p.userId);
  const liked = p.likes.includes(ME);
  const likers = p.likes.filter(id => id !== ME).slice(0, 2).map(id => firstName(api.user(id)?.name)).filter(Boolean);
  return `<article class="post" data-id="${p.id}">
    <div class="post-head">
      <button data-act="profile" data-id="${p.userId}">${avatar(u, 40)}</button>
      <div class="post-who"><b>${esc(u?.name)}</b><span>${ago(p.ts)}</span></div>
      <button class="icon-btn sm" data-act="post-more" data-id="${p.id}">${icon('more')}</button>
    </div>
    ${p.text ? `<div class="post-text ${!p.image && p.text.length < 80 ? 'big' : ''}">${esc(p.text)}</div>` : ''}
    ${postMedia(p)}
    <div class="post-actions">
      <button class="pa ${liked ? 'liked' : ''}" data-act="like" data-id="${p.id}">${icon('heart')}<span>${p.likes.length || ''}</span></button>
      <button class="pa" data-act="${detail ? 'focus-comment' : 'post'}" data-id="${p.id}">${icon('comment')}<span>${p.comments.length || ''}</span></button>
      <button class="pa" data-act="share-post" data-id="${p.id}">${icon('share')}</button>
    </div>
  </article>`;
}

function postMedia(p) {
  const imgs = p.images?.length ? p.images : p.image ? [p.image] : [];
  if (!imgs.length) return '';
  if (imgs.length === 1) return `<button class="post-img" data-act="view-src" data-src-post="${p.id}" data-i="0"><img src="${imgs[0]}" alt="" loading="lazy"></button>`;
  return `<div class="post-car" data-n="${imgs.length}"><div class="pc-track">${imgs.map((src, i) => `<button class="post-img" data-act="view-src" data-src-post="${p.id}" data-i="${i}"><img src="${src}" alt="" loading="lazy"></button>`).join('')}</div><span class="pc-count">1/${imgs.length}</span><div class="pc-dots">${imgs.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div></div>`;
}

export function empty(emoji, title, text = '') {
  return `<div class="empty"><div class="empty-emoji">${emoji}</div><b>${esc(title)}</b></div>`;
}

// Data dummy awal. Nanti diganti data dari server.

export function art(hue, emoji, label = '') {
  const h2 = (hue + 50) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},90%,74%)"/><stop offset="1" stop-color="hsl(${h2},85%,58%)"/></linearGradient></defs><rect width="600" height="600" fill="url(#g)"/><circle cx="470" cy="130" r="120" fill="#fff" opacity=".18"/><circle cx="110" cy="510" r="170" fill="#fff" opacity=".12"/><text x="300" y="370" font-size="210" text-anchor="middle">${emoji}</text>${label ? `<text x="300" y="530" font-size="38" font-family="Helvetica,Arial,sans-serif" font-weight="700" fill="#fff" text-anchor="middle">${label}</text>` : ''}</svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

export const USERS = [
  { id: 'onix', name: 'Onix Team', status: 'Akun resmi Onix · tips & info ✨', hue: 255, emoji: '🪐', official: true },
  { id: 'nadia', name: 'Nadia Putri', status: 'lagi healing dulu 🌷', hue: 335 },
  { id: 'raka', name: 'Raka Pratama', status: 'ngoding sampe subuh ☕', hue: 210 },
  { id: 'kezia', name: 'Kezia Amelia', status: 'main character energy ✨', hue: 280 },
  { id: 'dimas', name: 'Dimas Arya', status: 'gym → kerja → tidur', hue: 150 },
  { id: 'salsa', name: 'Salsabila', status: 'kpop is my cardio 💜', hue: 300 },
  { id: 'bima', name: 'Bima Saputra', status: 'on my way 🛵', hue: 25 },
  { id: 'aurel', name: 'Aurelia Sari', status: 'no thoughts just vibes', hue: 190 },
  { id: 'farel', name: 'Farel Gunawan', status: 'valo? gas', hue: 0 },
  { id: 'tasya', name: 'Tasya Kirana', status: 'matcha > coffee 🍵', hue: 120 },
  { id: 'yoga', name: 'Yoga Mahendra', status: '📍 Bandung', hue: 45 },
  { id: 'citra', name: 'Citra Ayu', status: 'sleepy era 😴', hue: 260 },
  { id: 'jojo', name: 'Jonathan', status: 'rebahan profesional', hue: 170 },
  { id: 'luna', name: 'Luna Maharani', status: 'art & coffee 🎨', hue: 315 },
  { id: 'arka', name: 'Arkana Putra', status: 'basket tiap sore 🏀', hue: 200 },
  { id: 'vina', name: 'Vina Oktavia', status: 'skincare enthusiast 🧴', hue: 350 },
  { id: 'reza', name: 'Reza Firmansyah', status: 'photography 📸', hue: 30 },
  { id: 'gita', name: 'Gita Lestari', status: 'bookworm 📚', hue: 95 },
];

export const FRIENDS = ['nadia', 'raka', 'kezia', 'dimas', 'salsa', 'bima', 'aurel', 'farel', 'tasya', 'yoga', 'citra', 'jojo'];

export const STICKERS = {
  mood: ['😂', '🥹', '😭', '💀', '🫠', '😤', '🤌', '🫡', '😎', '🤯', '🥳', '😴', '🙄', '🤭', '😇', '🫣'],
  love: ['🫶', '💖', '💘', '😍', '🥰', '💌', '🌷', '✨', '💅', '👑', '🔥', '💯', '🌈', '⭐', '🎀', '🍓'],
  animal: ['🐱', '🐶', '🐸', '🦆', '🐧', '🐻', '🐼', '🐰', '🦊', '🐹', '🐨', '🦄', '🐙', '🐢', '🐥', '🦋'],
  food: ['🍜', '🍕', '🍔', '🧋', '🍵', '🍩', '🍦', '🍣', '🌮', '🍿', '🥐', '🍰', '☕', '🍉', '🍟', '🥟'],
};
// sticker animasi: [emoji, jenis animasi]
export const ANIM_STICKERS = [['👋', 'wave'], ['💖', 'beat'], ['😂', 'shake'], ['🥳', 'bounce'], ['🔥', 'flicker'], ['😴', 'float'], ['🤩', 'spin'], ['🫠', 'jelly'], ['🐱', 'bounce'], ['🫶', 'beat'], ['🙏', 'wave'], ['💀', 'shake'], ['✨', 'spin'], ['🐸', 'jelly'], ['🎉', 'flicker'], ['👀', 'float']];
export const STICKER_TABS = [['anim', '✨'], ['mood', '😂'], ['love', '🫶'], ['animal', '🐱'], ['food', '🧋']];

export const EMOJIS = '😀 😁 😂 🤣 😊 😍 🥰 😘 😎 🤩 🥳 😏 😌 😴 🤔 🤫 🤭 🙄 😬 😮 😳 🥺 😢 😭 😤 😡 🤯 😱 🫠 🫡 🫶 👍 👎 👏 🙏 💪 🔥 ✨ 💯 ❤️ 🧡 💛 💚 💙 💜 🖤 🤍 💔 🎉 🎂 🎁 🌈 ☀️ 🌙 ⭐ 🍀 🌸 🍕 🍔 🍜 🧋 ☕ ⚽ 🎮 🎧 📸 ✈️ 🏖️ 💤 💀 👀'.split(' ');

export const PLACES = [
  { title: 'Kafe Senja', address: 'Jl. Kemang Raya No. 21, Jakarta Selatan' },
  { title: 'Taman Literasi', address: 'Blok M, Jakarta Selatan' },
  { title: 'Kampus Utama', address: 'Jl. Margonda Raya, Depok' },
  { title: 'Braga Corner', address: 'Jl. Braga, Bandung' },
];

const M = 60e3, H = 3600e3, D = 864e5;

export function buildSeed(me) {
  const t = Date.now();
  const users = {};
  USERS.forEach(u => (users[u.id] = { ...u, online: u.official || Math.random() < 0.45, lastSeen: t - Math.random() * 5 * H }));

  const chats = {}, messages = {};
  let n = 0;
  const first = me.name.split(' ')[0];

  function mk(id, type, members, extra, rows, unread = 0) {
    chats[id] = { id, type, members: ['me', ...members], pinned: false, muted: false, unread, draft: '', createdAt: t - 30 * D, ...extra };
    messages[id] = rows.map(([from, ago, payload]) => ({
      id: 's' + n++, chatId: id, from, ts: t - ago, type: 'text', reactions: {}, status: 'sent',
      readBy: from === 'me' ? members.filter(x => x !== 'onix') : [],
      ...(typeof payload === 'string' ? { text: payload } : payload),
    }));
    chats[id].updatedAt = messages[id].length ? messages[id].at(-1).ts : t;
  }

  mk('d_onix', 'direct', ['onix'], { pinned: true }, [
    ['onix', 3 * M, `Haii ${first}! 👋 Selamat datang di Onix.`],
    ['onix', 3 * M - 2000, 'Tips cepat biar makin jago:\n• Tahan (long-press) pesan buat balas, react, salin, atau tarik pesan\n• Tap + buat kirim foto, lokasi, atau voice note\n• Tap 😊 buat kirim sticker\n• Bikin grup dari tab Chat → ikon grup'],
    ['onix', 3 * M - 4000, { type: 'sticker', sticker: '🫶' }],
    ['onix', 3 * M - 6000, 'Ini masih versi demo ya, semua chat masih simulasi. Coba chat teman-teman kamu ✨'],
  ], 4);

  mk('d_nadia', 'direct', ['nadia'], {}, [
    ['nadia', 3 * H, 'eh besok jadi nongkrong ga?'],
    ['me', 3 * H - 60e3, 'jadii dong, jam berapa?'],
    ['nadia', 3 * H - 120e3, 'jam 4 aja di kafe biasa ☕'],
    ['me', 3 * H - 180e3, 'okee siap'],
    ['nadia', 12 * M, { type: 'sticker', sticker: '🥹' }],
    ['nadia', 11 * M, 'btw jangan telat yaa 😤'],
  ], 2);

  mk('g_bestie', 'group', ['nadia', 'kezia', 'salsa'], { name: 'Bestie 4ever 💅', hue: 320, emoji: '💅' }, [
    ['me', 9 * D, { type: 'system', text: 'Kezia membuat grup "Bestie 4ever 💅"' }],
    ['kezia', 5 * H, 'GUYSSS liat deh outfit aku hari ini'],
    ['kezia', 5 * H - 20e3, { type: 'image', src: art(290, '👗', 'OOTD'), w: 600, h: 600 }],
    ['salsa', 5 * H - 60e3, 'CANTIK BANGET 😭😭'],
    ['nadia', 5 * H - 90e3, 'slay as always 💅', ],
    ['me', 5 * H - 120e3, 'ih lucu bgt beli dimana?'],
    ['kezia', 5 * H - 150e3, 'di thrift dong murah meriah wkwk'],
    ['salsa', 40 * M, 'weekend ini karaoke yuk 🎤'],
    ['kezia', 35 * M, 'GASSS'],
  ], 2);
  messages.g_bestie[4].reactions = { '❤️': ['kezia', 'salsa'] };

  mk('g_project', 'group', ['raka', 'dimas', 'farel', 'yoga'], { name: 'Tim Project Kampus', hue: 215, emoji: '📚' }, [
    ['me', 12 * D, { type: 'system', text: 'Raka membuat grup "Tim Project Kampus"' }],
    ['raka', 26 * H, 'deadline laporan hari jumat ya guys'],
    ['dimas', 26 * H - 60e3, 'siap bos, aku bagian bab 2'],
    ['farel', 26 * H - 120e3, 'aku slide presentasi'],
    ['me', 25 * H, 'aku bab 3 sama kesimpulan'],
    ['yoga', 24 * H, 'aku revisi + daftar pustaka 👍'],
    ['raka', 3 * H, 'jangan lupa progress update malam ini ya 🙏'],
  ], 1);

  mk('d_raka', 'direct', ['raka'], {}, [
    ['raka', 30 * H, 'bro udah liat repo yg aku share?'],
    ['me', 30 * H - 60e3, 'udah, rapi sih strukturnya'],
    ['raka', 30 * H - 120e3, 'sip, nanti review PR aku ya 🙏'],
    ['me', 30 * H - 180e3, { type: 'sticker', sticker: '🫡' }],
  ]);

  mk('d_kezia', 'direct', ['kezia'], {}, [
    ['me', 2 * D, 'kez nanti pinjem catatan dong'],
    ['kezia', 2 * D - 60e3, 'boleh nanti aku fotoin'],
    ['kezia', 2 * D - 120e3, { type: 'image', src: art(45, '📝', 'catatan bab 4'), w: 600, h: 600 }],
    ['me', 2 * D - 180e3, 'makasih bestie 🫶'],
  ]);

  mk('d_bima', 'direct', ['bima'], {}, [
    ['bima', 6 * D, 'bro titip kopi ga?'],
    ['me', 6 * D - 60e3, 'boleh, es kopi susu 1'],
    ['bima', 6 * D - 120e3, 'otw 🛵'],
    ['bima', 6 * D - 180e3, { type: 'location', title: 'Kafe Senja', address: 'Jl. Kemang Raya No. 21, Jakarta Selatan' }],
  ]);

  const posts = [
    { id: 'p1', userId: 'kezia', ts: t - 40 * M, text: 'thrift haul hari ini 🛍️ total cuma 150k, worth it parah', image: art(285, '🛍️'), likes: ['nadia', 'salsa', 'aurel'], comments: [{ id: 'c1', userId: 'nadia', text: 'SPILL TOKONYA', ts: t - 35 * M }] },
    { id: 'p2', userId: 'raka', ts: t - 3 * H, text: 'setup baru, produktivitas naik 200% (katanya) 💻', image: art(210, '💻'), likes: ['dimas', 'farel'], comments: [] },
    { id: 'p3', userId: 'tasya', ts: t - 6 * H, text: 'matcha latte terenak sejauh ini. rating 10/10 🍵', image: art(120, '🍵'), likes: ['citra', 'nadia', 'kezia', 'aurel'], comments: [{ id: 'c2', userId: 'citra', text: 'mauuu ajak aku', ts: t - 5 * H }] },
    { id: 'p4', userId: 'salsa', ts: t - 20 * H, text: 'UDAH DAPET TIKET KONSER!!! siapa yg mau nemenin 😭💜', image: null, likes: ['kezia', 'nadia'], comments: [{ id: 'c3', userId: 'kezia', text: 'AKUUU', ts: t - 19 * H }] },
    { id: 'p5', userId: 'yoga', ts: t - 1.4 * D, text: 'sunset di Bandung emang beda 🌅', image: art(20, '🌅'), likes: ['tasya', 'jojo', 'bima'], comments: [] },
    { id: 'p6', userId: 'dimas', ts: t - 2 * D, text: 'PR baru: deadlift 140kg 🏋️ consistency is key', image: art(150, '🏋️'), likes: ['farel', 'raka'], comments: [] },
  ];

  const stories = [
    { userId: 'nadia', seen: false, items: [{ id: 'st1', ts: t - 2 * H, hue: 335, emoji: '🌷', text: 'pagi yang cerah ☀️' }] },
    { userId: 'kezia', seen: false, items: [{ id: 'st2', ts: t - 4 * H, hue: 285, image: art(285, '👗', 'ootd check') }, { id: 'st3', ts: t - 3 * H, hue: 260, emoji: '🛍️', text: 'thrift day!!' }] },
    { userId: 'salsa', seen: false, items: [{ id: 'st4', ts: t - 5 * H, hue: 300, emoji: '🎤', text: 'karaoke time' }] },
    { userId: 'dimas', seen: false, items: [{ id: 'st5', ts: t - 7 * H, hue: 150, emoji: '🏋️', text: 'leg day 💀' }] },
    { userId: 'tasya', seen: true, items: [{ id: 'st6', ts: t - 9 * H, hue: 120, image: art(120, '🍵', 'matcha o\'clock') }] },
    { userId: 'aurel', seen: false, items: [{ id: 'st7', ts: t - 10 * H, hue: 190, emoji: '🌊', text: 'no thoughts just vibes' }] },
  ];

  const calls = [
    { id: 'cl1', chatId: 'd_nadia', userId: 'nadia', video: false, dir: 'in', status: 'done', duration: 312, ts: t - 5 * H },
    { id: 'cl2', chatId: 'd_raka', userId: 'raka', video: true, dir: 'out', status: 'done', duration: 1240, ts: t - 1 * D },
    { id: 'cl3', chatId: 'd_bima', userId: 'bima', video: false, dir: 'in', status: 'missed', duration: 0, ts: t - 2 * D },
    { id: 'cl4', chatId: 'd_kezia', userId: 'kezia', video: false, dir: 'out', status: 'noanswer', duration: 0, ts: t - 3 * D },
  ];

  return {
    v: 1,
    me: { id: me.id, name: me.name, status: 'hi, aku pakai Onix ✨', hue: me.hue, avatar: null },
    users, friends: FRIENDS.slice(), favorites: ['nadia', 'kezia'], blocked: [],
    chats, messages, posts, stories, myStory: null, calls,
    settings: { theme: 'system', accent: 'violet', notif: true, sound: true, simulate: true },
  };
}

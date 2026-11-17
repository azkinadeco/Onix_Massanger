# Onix Messenger (prototype)

Aplikasi chat ala LINE, versi web (PWA) untuk dites di browser HP. Mode portrait.

## Cara jalanin
```bash
./start.sh
```
Buka alamat **"Di iPhone"** yang muncul di Safari iPhone (HP & laptop harus di Wi-Fi yang sama).
Biar terasa seperti aplikasi: Safari → tombol Share → **Add to Home Screen**.

## Chat beneran (server PocketBase)
```bash
bash server/start.sh      # download PocketBase otomatis, jalan di port 8090
bash server/tunnel.sh     # (opsional) link HTTPS gratis via Cloudflare, buat iPhone dari mana aja
```
- Buka `http://localhost:8090` (laptop) atau `http://IP-laptop:8090` (iPhone, satu Wi-Fi)
- Di app: **Saya → Onix Online** → Daftar (ID + password) → cari ID teman → Chat
- Dashboard admin: `http://localhost:8090/_/` (login ada di `server/ADMIN.txt`)
- Skema ada di `server/pb_migrations/`, data di `server/pb_data/` (tidak ikut git)
- Yang sudah online: akun, cari teman, chat personal & **grup** realtime (teks, sticker, foto, voice, lokasi, dll), riwayat tersinkron,
  **centang dibaca**, **lagi ngetik…**, **status online**, **reaksi / edit / tarik pesan**, ganti nama grup, tambah anggota, keluar grup.
  **Video & file** (upload ke server, maks 50 MB), **polling, event, Onix Pay (kirim/minta/patungan), suit** interaktif lintas HP.
  **Telepon & video call** personal (WebRTC, sinyal lewat PocketBase). Mic/kamera di iPhone butuh HTTPS → pakai `server/tunnel.sh`.
  Catatan: call antar jaringan seluler kadang butuh server TURN (berbayar); di Wi-Fi yang sama / kebanyakan jaringan rumah biasanya lancar. Call grup online belum ada.
- Juga online: **profil & mood**, **story** (yang lihat + reaksi), **VOOM** (post, like, komentar), **pin/bisu/arsip/hapus/dibaca**
  sinkron antar HP sendiri, **riwayat lama & cari pesan di server**, **blokir & laporkan**, **admin grup & link undangan** (`#join=kode`),
  **antre kirim** saat offline (otomatis terkirim saat sinyal balik) + status koneksi, **notifikasi sistem & badge ikon** saat app di background,
  **privasi**: sembunyikan terakhir dilihat & centang dibaca (timbal balik). Atur di Saya → Onix Online.
  Catatan: notif sistem di iPhone butuh app ditambah ke Layar Utama (iOS 16.4+) dan cuma jalan selama app masih hidup di background — push saat app ditutup total butuh Web Push (belum).

## Fitur
- **Chat**: personal & grup, sticker, emoji, foto/kamera, voice note, lokasi, balas (reply), reaksi,
  salin, tarik pesan, hapus, tanda "Dibaca", indikator "lagi ngetik…", draft, pin/bisukan/hapus chat,
  cari chat & isi pesan, filter (belum dibaca/grup/personal), album foto
- **Home**: profil kamu, story (lihat/upload/balas), favorit, grup, daftar teman
- **Teman**: cari ID, rekomendasi, kode QR (scan masih dummy), profil, favorit, blokir, hapus teman
- **Grup**: bikin grup, ganti nama, tambah anggota, keluar grup
- **VOOM**: timeline post (teks/foto), like, komentar, hapus post
- **Panggilan**: telepon & video call (UI + kamera depan), riwayat, telepon masuk (simulasi)
- **Kamu**: edit profil + foto, mode terang/gelap/auto, 5 warna aksen, notifikasi, mode demo, reset

### Baru di v0.6
- **Cari global** di tab Chat: chat, orang, isi pesan (tap = loncat ke pesannya), post VOOM
- **Status mood** 24 jam di atas daftar chat, bisa dibalas cepat
- **Onix Pay** (dummy): saldo, kirim & minta uang, patungan grup, bayar tagihan, riwayat
- **Pembuat sticker** dari foto (lingkaran/kotak/hati, pinggiran putih, teks) → tab Buatanku
- **Backup & pulihkan** semua data ke/dari file `.json`

### Baru di v0.5
- **Daftar pakai nomor HP + OTP** (kode dummy muncul di banner), setup profil & cek ID
- **Notifikasi** (lonceng di Home): like, komentar, mention, panggilan tak terjawab, permintaan teman
- **Geser chat**: kiri = pin / bisukan / arsip / hapus, kanan = tandai dibaca
- **Format teks** `*tebal*` `_miring_` `~coret~` `` `kode` ``, **preview link**, **efek pesan** (konfeti, hati, kembang api, balon, salju — kata kunci atau tahan tombol kirim)
- **Kirim sampai 10 foto** jadi album + **galeri** geser, cubit/ketuk 2x untuk zoom
- **Pesan sementara** per chat (30 detik – 7 hari) & **chat tersembunyi** pakai PIN (tahan judul "Chat")
- **Story**: editor teks (8 latar, 5 font), daftar yang lihat + reaksi, reaksi emoji & suka
- **VOOM**: tab Untukmu / Mengikuti, post multi-foto (carousel), kirim post ke chat, like komentar
- **Performa**: chat muat 50 pesan dulu, sisanya pas scroll ke atas; **Penyimpanan** (ukuran per chat, hapus media); **mode offline** (banner + pesan dikirim pas online lagi)
- **Mini game** di chat: 🎲 dadu, 🪙 koin, ✊ suit

### Baru di v0.4
- **Event** di chat (tanggal, jam, tempat) + RSVP Ikut/Nggak
- **Pesan terjadwal**: tahan tombol kirim → pilih waktu
- **Toko sticker**: 6 paket gratis (2 animasi), bisa download/hapus
- **Catatan grup** (Notes), **ulang tahun teman** di Home + kirim ucapan 1 tap
- **Cover profil** & tanggal lahir di Edit profil

### Baru di v0.3
- **Kirim video & file** (maks 50 MB, disimpan di IndexedDB), video ada thumbnail + durasi
- **Panggilan grup**: tampilan grid peserta, teman gabung satu-satu, indikator yang lagi ngomong
- **Sticker animasi** (tab ✨)
- Tampilan lebih simpel: tab bar ikon saja, tanda dibaca pakai ✓✓, teks & label dipangkas

### Baru di v0.2
- **Geser pesan ke kiri** buat balas cepat
- **Edit pesan** (15 menit) dengan label "diedit", **teruskan** pesan ke beberapa chat sekaligus
- **Cari di dalam chat** (navigasi ↑ ↓, hasil di-highlight)
- **Pengumuman** (pin pesan di atas chat), **Polling** (pilih satu/beberapa, teman ikut vote)
- **@mention** di grup + auto-complete; kamu dapat notif `@` walau grup dibisukan
- **Dibaca oleh** (siapa saja yang sudah/belum baca di grup)
- **Wallpaper per chat** (8 pilihan, ikut mode gelap), **ukuran teks chat**
- **Keep**: simpan pesan/foto/lokasi + bikin catatan sendiri
- **Arsip chat** dan **kunci aplikasi pakai PIN** (terkunci lagi kalau keluar >30 detik)

## Struktur
```
index.html          entry
css/app.css         semua styling (token warna di :root)
js/service.js       ⚠️ LAYANAN DUMMY — semua data & simulasi balasan ada di sini
js/seed.js          data contoh (teman, chat, post, story)
js/app.js           tab utama + boot
js/chat.js          ruang chat + layar telepon
js/screens.js       profil, grup, tambah teman, VOOM, story, dll
js/features.js      Keep, polling, teruskan, arsip, wallpaper, kunci PIN
js/media.js         simpan video/file (IndexedDB) — nanti ganti ke storage server
js/ui.js, views.js, util.js, icons.js
```

## Nyambungin ke backend nanti
Semua UI cuma bicara ke objek `api` dan event `bus` di `js/service.js`.
Ganti isi fungsi `api.*` dengan panggilan server (REST/WebSocket/Firebase/Supabase), lalu panggil
`bus.emit('messages', chatId)` dsb. saat ada data baru dari server. UI nggak perlu diubah.

Catatan: mic/kamera asli di iPhone butuh HTTPS. Lewat http lokal, voice note jalan dalam mode demo.

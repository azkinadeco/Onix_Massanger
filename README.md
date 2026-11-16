# Onix Messenger (prototype)

Aplikasi chat ala LINE, versi web (PWA) untuk dites di browser HP. Mode portrait.

## Cara jalanin
```bash
./start.sh
```
Buka alamat **"Di iPhone"** yang muncul di Safari iPhone (HP & laptop harus di Wi-Fi yang sama).
Biar terasa seperti aplikasi: Safari → tombol Share → **Add to Home Screen**.

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

#!/bin/bash
# Bikin link HTTPS publik (gratis, tanpa akun) ke server Onix lewat Cloudflare Quick Tunnel.
# Jalankan setelah server/start.sh. Link-nya muncul di output (…trycloudflare.com).
# Link berubah tiap kali dijalankan. Tutup (Ctrl+C) kalau udah selesai ngetes.
set -e
cd "$(dirname "$0")"
if [ ! -x ./cloudflared ]; then
  case "$(uname -s)-$(uname -m)" in
    Darwin-arm64) F=cloudflared-darwin-arm64.tgz ;;
    Darwin-x86_64) F=cloudflared-darwin-amd64.tgz ;;
    Linux-x86_64) F=cloudflared-linux-amd64 ;;
    Linux-aarch64) F=cloudflared-linux-arm64 ;;
    *) echo "OS/CPU belum didukung script ini"; exit 1 ;;
  esac
  echo "Download cloudflared…"
  URL="https://github.com/cloudflare/cloudflared/releases/latest/download/$F"
  if [[ $F == *.tgz ]]; then curl -sL "$URL" | tar xz; else curl -sL -o cloudflared "$URL"; fi
  chmod +x cloudflared
fi
exec ./cloudflared tunnel --url http://localhost:8090

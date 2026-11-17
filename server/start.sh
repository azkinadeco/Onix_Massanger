#!/bin/bash
# Jalankan server Onix (PocketBase): API + realtime + file app, semuanya di port 8090.
# Pakai: bash server/start.sh
set -e
cd "$(dirname "$0")"
VER=0.40.6

if [ ! -x ./pocketbase ]; then
  case "$(uname -s)-$(uname -m)" in
    Darwin-arm64) ARCH=darwin_arm64 ;;
    Darwin-x86_64) ARCH=darwin_amd64 ;;
    Linux-x86_64) ARCH=linux_amd64 ;;
    Linux-aarch64) ARCH=linux_arm64 ;;
    *) echo "OS/CPU belum didukung script ini"; exit 1 ;;
  esac
  echo "Download PocketBase $VER ($ARCH)…"
  curl -sL -o pb.zip "https://github.com/pocketbase/pocketbase/releases/download/v$VER/pocketbase_${VER}_${ARCH}.zip"
  unzip -o -q pb.zip pocketbase && rm pb.zip
  chmod +x pocketbase
fi

# akun admin dashboard (sekali saja), disimpan di ADMIN.txt
if [ ! -f ADMIN.txt ]; then
  PW=$(LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 16)
  ./pocketbase superuser upsert admin@onix.local "$PW" --dir=pb_data --migrationsDir=pb_migrations >/dev/null
  printf 'Dashboard: http://localhost:8090/_/\nEmail: admin@onix.local\nPassword: %s\n' "$PW" > ADMIN.txt
fi

IP=$(ipconfig getifaddr en0 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}')
echo ""
echo "  Onix server jalan 🚀"
echo "  Laptop : http://localhost:8090"
[ -n "$IP" ] && echo "  iPhone : http://$IP:8090  (satu Wi-Fi)"
echo "  Admin  : lihat server/ADMIN.txt"
echo "  HTTPS  : jalankan 'bash server/tunnel.sh' di terminal lain"
echo ""
exec ./pocketbase serve --http=0.0.0.0:8090 --dir=pb_data --migrationsDir=pb_migrations --publicDir=pb_public

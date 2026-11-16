#!/bin/bash
# Jalankan server lokal. Buka alamat "Di iPhone" dari Safari (HP & laptop harus 1 Wi-Fi).
cd "$(dirname "$0")"
PORT=${PORT:-8080}
IP=$(ipconfig getifaddr en0 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}')
echo "Di laptop : http://localhost:$PORT"
echo "Di iPhone : http://$IP:$PORT"
python3 -m http.server $PORT --bind 0.0.0.0

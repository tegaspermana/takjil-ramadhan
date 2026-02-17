#!/usr/bin/env bash
set -euo pipefail

# Backup SQLite DB dari volume container ke folder backups (volume juga).
# Jalankan dari host: docker compose exec takjil-app /app/scripts/backup.sh

TS=$(date +"%Y-%m-%d_%H-%M-%S")
SRC="/app/database/takjil.db"
DEST_DIR="/app/backups"
DEST="$DEST_DIR/takjil_${TS}.db"

mkdir -p "$DEST_DIR"

if [ ! -f "$SRC" ]; then
  echo "[ERR] DB not found at $SRC"
  exit 1
fi

# Copy sederhana (cukup untuk kebanyakan kasus). Untuk snapshot konsisten, gunakan sqlite3 .backup jika tersedia.
cp "$SRC" "$DEST"

# Verifikasi file hasil copy tidak kosong
if [ ! -s "$DEST" ]; then
  echo "[ERR] Backup file is empty: $DEST"
  exit 1
fi

echo "[OK] Backup created: $DEST"

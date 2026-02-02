#!/usr/bin/env bash
set -euo pipefail

# Hapus backup lebih lama dari N hari (default 30 hari)
DAYS=${1:-30}
DIR="/app/backups"

if [ ! -d "$DIR" ]; then
  echo "[WARN] Backup dir not found: $DIR"
  exit 0
fi

find "$DIR" -type f -name "takjil_*.db" -mtime +"$DAYS" -print -delete

echo "[OK] Prune completed (> $DAYS days)"

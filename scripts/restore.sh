#!/usr/bin/env bash
set -euo pipefail

# Restore DB dari file backup ke /app/database/takjil.db
# Jalankan di container: docker compose exec takjil-app /app/scripts/restore.sh /app/backups/takjil_YYYY-mm-dd_HH-MM-SS.db

if [ $# -lt 1 ]; then
  echo "Usage: $0 /path/to/backup.db"
  exit 1
fi

BACKUP="$1"
TARGET="/app/database/takjil.db"

if [ ! -f "$BACKUP" ]; then
  echo "[ERR] Backup file not found: $BACKUP"
  exit 1
fi

cp "$BACKUP" "$TARGET"

echo "[OK] Restored DB to $TARGET from $BACKUP"

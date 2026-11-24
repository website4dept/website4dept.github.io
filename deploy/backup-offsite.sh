#!/bin/sh
# =============================================================================
# Take a backup of the portal and copy it OFF this machine.
#
# WHY
# The portal already keeps a daily copy of its database in
# backend/data/backups/.  That protects you from a mistake - somebody deleting
# the wrong notice - but not from the machine itself: if the disk fails or the
# server is rebuilt, the backups go with it.  This script copies a backup
# somewhere else, which is the only kind of backup that survives a real
# accident.
#
# WHAT IT COPIES
#   * the database  (accounts, people, notices, every booking)
#   * the uploads folder  (photos and files added through the portal)
# It does NOT copy config.json, because that holds the mail password. Keep one
# copy of that somewhere safe by hand.
#
# SET IT UP (about five minutes, once)
#   1. Decide where the copies go. Two usual choices:
#        - another machine you can reach with ssh   -> set DEST below
#        - a folder that CIC backs up for you       -> set DEST to that path
#   2. If you use ssh, make it passwordless, or cron cannot run it:
#        ssh-keygen -t ed25519 -f ~/.ssh/mathsite-backup -N ""
#        ssh-copy-id -i ~/.ssh/mathsite-backup.pub backups@otherserver
#      and set SSH_KEY below.
#   3. Test it by hand first:
#        sh deploy/backup-offsite.sh
#   4. Then run it every night at 02:20. As the user that runs the portal:
#        crontab -e
#      and add this one line:
#        20 2 * * * /srv/mathsite/deploy/backup-offsite.sh >> /srv/mathsite-data/backup.log 2>&1
#
# The portal's System health page shows when this last ran, and will start
# saying "worth a look" if it stops running.
# =============================================================================

set -eu

# ---- things to change -------------------------------------------------------
BACKEND="/srv/mathsite/backend"          # folder holding server.py
SITE="/srv/mathsite"                     # folder holding index.html
DEST="backups@otherserver:/backups/mathsite"   # ssh target, OR a plain path like /mnt/cic-backup/mathsite
SSH_KEY=""                               # e.g. /home/mathsite/.ssh/mathsite-backup  (leave empty for a plain path)
KEEP=30                                  # how many nights to keep at the far end
PYTHON="python3"
# -----------------------------------------------------------------------------

STAMP=$(date +%Y%m%d-%H%M%S)
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

echo "[$(date '+%Y-%m-%d %H:%M:%S')] taking a snapshot"
cd "$BACKEND"
DB=$("$PYTHON" server.py backup "$WORK")      # prints the file it wrote

ARCHIVE="$WORK/mathsite-$STAMP.tar.gz"
if [ -d "$SITE/uploads" ]; then
    tar -czf "$ARCHIVE" -C "$WORK" "$(basename "$DB")" -C "$SITE" uploads
else
    tar -czf "$ARCHIVE" -C "$WORK" "$(basename "$DB")"
fi
echo "    archive: $(du -h "$ARCHIVE" | cut -f1)"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] copying to $DEST"
case "$DEST" in
  *:*)                                     # ssh target
      if [ -n "$SSH_KEY" ]; then
          scp -q -i "$SSH_KEY" "$ARCHIVE" "$DEST/"
          REMOTE=${DEST%%:*}; DIR=${DEST#*:}
          ssh -i "$SSH_KEY" "$REMOTE" "ls -1t $DIR/mathsite-*.tar.gz 2>/dev/null | tail -n +$((KEEP+1)) | xargs -r rm -f"
      else
          scp -q "$ARCHIVE" "$DEST/"
          REMOTE=${DEST%%:*}; DIR=${DEST#*:}
          ssh "$REMOTE" "ls -1t $DIR/mathsite-*.tar.gz 2>/dev/null | tail -n +$((KEEP+1)) | xargs -r rm -f"
      fi
      ;;
  *)                                       # an ordinary folder
      mkdir -p "$DEST"
      cp "$ARCHIVE" "$DEST/"
      ls -1t "$DEST"/mathsite-*.tar.gz 2>/dev/null | tail -n +$((KEEP+1)) | xargs -r rm -f
      ;;
esac

# Only now, after the copy really worked, record that it ran. The System health
# page reads the date on this file.
DATA=$("$PYTHON" -c "import json,os;print(os.path.join('$BACKEND', json.load(open('$BACKEND/config.json')).get('data_dir','data')))")
: > "$DATA/offsite-last-run"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] done"

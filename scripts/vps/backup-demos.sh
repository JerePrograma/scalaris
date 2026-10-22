#!/bin/sh
set -eu
umask 077
stamp=$(date -u +%Y%m%dT%H%M%SZ)
config_root=/var/backups/scalaris/demo-configuration
destination="$config_root/$stamp"
mkdir -p "$destination"

if [ -f /srv/apps/fourbubbles-demo/deployment/vps/.env ]; then
    sh /srv/apps/fourbubbles-demo/deployment/vps/backup.sh
    cp /srv/apps/fourbubbles-demo/deployment/vps/.env "$destination/fourbubbles.env"
    git -C /srv/apps/fourbubbles-demo rev-parse HEAD > "$destination/fourbubbles.commit"
fi
if [ -f /srv/apps/gestudio-demo/.env ]; then
    sh /srv/apps/gestudio-demo/deployment/vps/backup.sh
    cp /srv/apps/gestudio-demo/.env "$destination/gestudio.env"
    git -C /srv/apps/gestudio-demo rev-parse HEAD > "$destination/gestudio.base-commit"
    if [ -d /srv/private/gestudio-demo ]; then
        tar -czf "$destination/gestudio-private-state.tar.gz" -C /srv/private gestudio-demo
    fi
    for overlay in gestudio-code-overlay.tar.gz gestudio-provision-helper.tar.gz gestudio-public-demo.tar.gz; do
        if [ -f "/root/$overlay" ]; then
            cp "/root/$overlay" "$destination/$overlay"
            (cd "$destination" && sha256sum "$overlay") >> "$destination/gestudio-code.SHA256SUMS"
        fi
    done
fi
for name in pharmahome calendario-servicios; do
    if [ -d "/srv/apps/$name/.git" ]; then
        git -C "/srv/apps/$name" rev-parse HEAD > "$destination/$name.commit"
    fi
done
cp -a /srv/infrastructure/caddy/sites "$destination/caddy-sites"
find "$destination" -type f -exec chmod 600 {} +
find "$destination" -type d -exec chmod 700 {} +
python3 - <<'PY_RETENTION'
from pathlib import Path
from datetime import datetime, timezone
import re
import shutil
import time

STAMP = re.compile(r"20[0-9]{6}T[0-9]{6}Z")
CONFIGURATION_FILES = {
    "fourbubbles.env", "fourbubbles.commit", "gestudio.env", "gestudio.base-commit", "gestudio-private-state.tar.gz",
    "pharmahome.commit", "calendario-servicios.commit", "gestudio-code-overlay.tar.gz", "gestudio-provision-helper.tar.gz",
    "gestudio-public-demo.tar.gz", "gestudio-code.SHA256SUMS"}
GESTUDIO_FILES = {"database.dump", "receipts.tar.gz", "database.contents", "SHA256SUMS"}


def prune_generated_backups(root, allowed_files, nested_dirs, cutoff):
    root = Path(root)
    if not root.exists():
        return
    # A root or snapshot redirected through a symlink is never a deletion target.
    if root.is_symlink() or root.resolve() != root.absolute():
        raise RuntimeError(f"Refusing non-canonical backup root: {root}")
    for snapshot in root.iterdir():
        if snapshot.is_symlink() or not snapshot.is_dir() or not STAMP.fullmatch(snapshot.name):
            continue
        try:
            created = datetime.strptime(snapshot.name, "%Y%m%dT%H%M%SZ").replace(tzinfo=timezone.utc).timestamp()
        except ValueError:
            continue
        if created >= cutoff or snapshot.stat().st_mtime >= cutoff:
            continue
        entries = list(snapshot.rglob("*"))
        safe = True
        for entry in entries:
            relative = entry.relative_to(snapshot)
            top = relative.parts[0]
            if entry.is_symlink() or entry.resolve().is_relative_to(snapshot.resolve()) is False:
                safe = False
                break
            if top not in nested_dirs and not (len(relative.parts) == 1 and entry.is_file() and top in allowed_files):
                safe = False
                break
            if entry.stat().st_mtime >= cutoff:
                safe = False
                break
        if not safe:
            print(f"Retention skipped unexpected or recently modified snapshot: {snapshot}")
            continue
        # Only a direct, timestamp-named snapshot under the explicit root is removed.
        if snapshot.resolve().parent != root.resolve():
            raise RuntimeError(f"Refusing snapshot outside backup root: {snapshot}")
        shutil.rmtree(snapshot)
        print(f"Expired generated demo backup removed: {snapshot}")


if __name__ == "__main__":
    cutoff = time.time() - 14 * 24 * 60 * 60
    prune_generated_backups(
        "/var/backups/scalaris/demo-configuration",
        CONFIGURATION_FILES, {"caddy-sites"}, cutoff)
    prune_generated_backups(
        "/var/backups/scalaris/gestudio",
        GESTUDIO_FILES, set(), cutoff)
PY_RETENTION
printf 'Demo backup finished: %s\n' "$destination"

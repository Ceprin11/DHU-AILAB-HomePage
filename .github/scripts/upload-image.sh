#!/usr/bin/env bash
# Uploads one file over SSH and resumes where it stopped when the connection drops, then verifies it with a checksum.
#
#   DEPLOY_TARGET=user@host SSH_OPTS="-i key ..." upload-image.sh <local-file> <remote-path>
#
# The remote path is relative to the remote home directory. SSH_BIN can replace the ssh command (used by the tests).
set -euo pipefail

file=${1:?local file}
remote=${2:?remote path}
target=${DEPLOY_TARGET:?DEPLOY_TARGET is not set}
ssh_bin=${SSH_BIN:-ssh}
read -r -a ssh_opts <<< "${SSH_OPTS:-}"

remote_run() { "$ssh_bin" "${ssh_opts[@]}" "$target" "$1"; }

total=$(stat -c%s "$file" 2>/dev/null || stat -f%z "$file")
remote_size() { remote_run "stat -c%s '$remote' 2>/dev/null || echo 0" | tr -dc '0-9'; }

remote_run "mkdir -p \"\$(dirname '$remote')\""
started=$(date +%s)

for attempt in 1 2 3 4 5 6 7 8; do
  have=$(remote_size || echo 0)
  have=${have:-0}
  if [ "$have" -gt "$total" ]; then
    echo "The partial file on the server is larger than the local one; starting over."
    remote_run "rm -f '$remote'"
    have=0
  fi
  [ "$have" -eq "$total" ] && break
  echo "Attempt $attempt: sending $((total - have)) of $total bytes (already on the server: $have)"
  tail -c +$((have + 1)) "$file" | remote_run "cat >> '$remote'" || echo "The connection dropped; the next attempt resumes from what arrived."
done

have=$(remote_size || echo 0)
if [ "${have:-0}" -ne "$total" ]; then
  echo "Upload incomplete: $have of $total bytes arrived." >&2
  exit 1
fi

local_sum=$(sha256sum "$file" 2>/dev/null | cut -d' ' -f1 || shasum -a 256 "$file" | cut -d' ' -f1)
remote_sum=$(remote_run "sha256sum '$remote'" | cut -d' ' -f1)
if [ "$local_sum" != "$remote_sum" ]; then
  echo "Checksum mismatch after upload (local $local_sum, server $remote_sum)." >&2
  remote_run "rm -f '$remote'" || true
  exit 1
fi

elapsed=$(( $(date +%s) - started ))
[ "$elapsed" -gt 0 ] || elapsed=1
echo "Uploaded $((total / 1024 / 1024)) MB in ${elapsed}s ($(( total / 1024 / elapsed )) KB/s); checksum verified."

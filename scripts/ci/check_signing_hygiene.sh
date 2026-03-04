#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

CANONICAL_PUBKEY_FILE="Velocity_GUI/src-tauri/velocity.key.pub"
TAURI_CONFIG_FILE="Velocity_GUI/src-tauri/tauri.conf.json"
LEGACY_PUBKEY_FILE="src-tauri/velocity.key.pub"

echo "Checking for tracked private key files..."
if command -v rg >/dev/null 2>&1; then
  bad_key_files="$(git ls-files | rg '(\.key$|\.pem$)' | rg -v '\.pub$' || true)"
else
  bad_key_files="$(git ls-files | grep -E '(\.key$|\.pem$)' | grep -Ev '\.pub$' || true)"
fi
if [[ -n "$bad_key_files" ]]; then
  echo "Tracked private key material is not allowed:"
  echo "$bad_key_files"
  exit 1
fi

echo "Scanning tracked files for private key markers..."
if git grep -nE 'BEGIN [A-Z ]*PRIVATE KEY|minisign secret key|AGE-SECRET-KEY-' -- . >/tmp/velocity-secret-scan.txt 2>/dev/null; then
  echo "Potential secret material found in tracked files:"
  cat /tmp/velocity-secret-scan.txt
  exit 1
fi
rm -f /tmp/velocity-secret-scan.txt

if [[ ! -f "$CANONICAL_PUBKEY_FILE" ]]; then
  echo "Missing canonical updater public key: $CANONICAL_PUBKEY_FILE"
  exit 1
fi

echo "Validating updater public key consistency..."
expected_pubkey="$(sed -n '2p' "$CANONICAL_PUBKEY_FILE" | tr -d '\r\n')"
if [[ -z "$expected_pubkey" ]]; then
  echo "Invalid canonical public key file format: $CANONICAL_PUBKEY_FILE"
  exit 1
fi
expected_tauri_pubkey="$(python - <<'PY'
import base64
from pathlib import Path

pub_line = Path("Velocity_GUI/src-tauri/velocity.key.pub").read_text(encoding="utf-8").splitlines()[1].strip()
print(base64.b64encode(pub_line.encode("utf-8")).decode("utf-8"))
PY
)"

actual_pubkey="$(python - <<'PY'
import json
from pathlib import Path

tauri_conf = Path("Velocity_GUI/src-tauri/tauri.conf.json")
data = json.loads(tauri_conf.read_text(encoding="utf-8"))
print(data["plugins"]["updater"]["pubkey"])
PY
)"

if [[ "$actual_pubkey" != "$expected_tauri_pubkey" ]]; then
  echo "Updater pubkey mismatch."
  echo "Expected (from $CANONICAL_PUBKEY_FILE): $expected_tauri_pubkey"
  echo "Actual   (from $TAURI_CONFIG_FILE): $actual_pubkey"
  exit 1
fi

if [[ -f "$LEGACY_PUBKEY_FILE" ]]; then
  legacy_pubkey="$(sed -n '2p' "$LEGACY_PUBKEY_FILE" | tr -d '\r\n')"
  if [[ "$legacy_pubkey" != "$expected_pubkey" ]]; then
    echo "Legacy public key file mismatch: $LEGACY_PUBKEY_FILE"
    exit 1
  fi
fi

echo "Signing hygiene checks passed."

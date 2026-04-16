#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# You can override with:
# PHANTOM_CRX_URLS="https://url1,https://url2" ./scripts/cache-phantom.sh
DEFAULT_URLS=(
  "https://crx-backup.phantom.dev/latest.crx"
  "https://clients2.google.com/service/update2/crx?response=redirect&prodversion=124.0.0.0&acceptformat=crx2,crx3&x=id%3Dbfnaelmomeimhlpmgjnjophhpkkoljpa%26uc"
)

if [[ -n "${PHANTOM_CRX_URLS:-}" ]]; then
  IFS=',' read -r -a URLS <<<"$PHANTOM_CRX_URLS"
else
  URLS=("${DEFAULT_URLS[@]}")
fi

attempt=1
for url in "${URLS[@]}"; do
  echo "[cache-phantom] Attempt ${attempt}/${#URLS[@]} using: $url"

  if SYNPRESS_PHANTOM_EXTENSION_URL="$url" npm run cache:phantom; then
    echo "[cache-phantom] Phantom cache created successfully."
    exit 0
  fi

  echo "[cache-phantom] Failed with URL: $url"
  attempt=$((attempt + 1))
  sleep 2
 done

echo "[cache-phantom] All Phantom cache download attempts failed."
echo "[cache-phantom] Try setting your own mirror URL:"
echo "PHANTOM_CRX_URLS=\"https://your-url/latest.crx\" ./scripts/cache-phantom.sh"
exit 1

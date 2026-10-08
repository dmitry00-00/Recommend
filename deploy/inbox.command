#!/bin/bash
# Забрать ссылки из формы Google в базу приложения сейчас и стереть из формы то, что база подтвердила
# (то же, что задание в 16:00). Двойной щелчок из Finder. Только забрать, не стирая: INBOX_KEEP=1.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$(dirname "$0")/.." || exit 1
VENV=.cache/venv
[ -x "$VENV/bin/python" ] || python3 -m venv "$VENV"
"$VENV/bin/python" -c "import google.auth, requests" 2>/dev/null || "$VENV/bin/pip" install -q google-auth requests
if [ "${INBOX_KEEP:-0}" = "1" ]; then npx --yes tsx tools/inbox.mts take; else npx --yes tsx tools/inbox.mts take --clear; fi
npx --yes tsx tools/inbox.mts list
read -r

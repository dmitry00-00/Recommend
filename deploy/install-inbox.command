#!/bin/bash
# Поставить на расписание очистку формы Google (06.10): каждый день в 16:00 (если Mac спал — при
# пробуждении) ссылки из листа «Ссылки» забираются в базу приложения, и строки, которые база
# подтвердила, стираются из формы — остаётся пустая форма. Сначала — переход реестра на сервер
# (REGISTRY_MODE=server в .env.local) и INBOX_SHEET_ID. Снять:
#   launchctl unload ~/Library/LaunchAgents/tm.recomend.inbox.plist
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLIST="$HOME/Library/LaunchAgents/tm.recomend.inbox.plist"
mkdir -p "$HOME/Library/LaunchAgents" "$ROOT/.cache/inbox"
NODE_BIN="$(dirname "$(command -v node || echo /opt/homebrew/bin/node)")"
cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>tm.recomend.inbox</string>
  <key>WorkingDirectory</key><string>$ROOT</string>
  <key>ProgramArguments</key><array>
    <string>/bin/bash</string><string>-lc</string><string>npx --yes tsx tools/inbox.mts take --clear</string>
  </array>
  <key>EnvironmentVariables</key><dict>
    <key>PATH</key><string>$NODE_BIN:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
  </dict>
  <key>StartCalendarInterval</key><dict><key>Hour</key><integer>16</integer><key>Minute</key><integer>0</integer></dict>
  <key>StandardOutPath</key><string>$ROOT/.cache/inbox/launchd.log</string>
  <key>StandardErrorPath</key><string>$ROOT/.cache/inbox/launchd.log</string>
</dict></plist>
PL
launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"
echo "Форма чистится по расписанию: каждый день в 16:00. Лог — $ROOT/.cache/inbox/launchd.log."
read -r

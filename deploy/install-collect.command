#!/bin/bash
# Поставить сборщик индексов на расписание: каждый день в 06:30 (если Mac спал — при
# пробуждении). Снять: launchctl unload ~/Library/LaunchAgents/tm.recomend.collect.plist
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLIST="$HOME/Library/LaunchAgents/tm.recomend.collect.plist"
mkdir -p "$HOME/Library/LaunchAgents" "$ROOT/.cache/collect"
# node у владельца не в /opt/homebrew, а в ~/.local/bin и ~/.nvm: без его каталога в PATH
# задание падало с кодом 127 «npx: command not found» (26.09, первый же утренний запуск)
NODE_BIN="$(dirname "$(command -v node || echo /opt/homebrew/bin/node)")"
cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>tm.recomend.collect</string>
  <key>WorkingDirectory</key><string>$ROOT</string>
  <key>ProgramArguments</key><array>
    <string>/bin/bash</string><string>-lc</string><string>npx --yes tsx tools/collect.mts</string>
  </array>
  <key>EnvironmentVariables</key><dict>
    <key>PATH</key><string>$NODE_BIN:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
  </dict>
  <key>StartCalendarInterval</key><dict><key>Hour</key><integer>6</integer><key>Minute</key><integer>30</integer></dict>
  <key>StandardOutPath</key><string>$ROOT/.cache/collect/launchd.log</string>
  <key>StandardErrorPath</key><string>$ROOT/.cache/collect/launchd.log</string>
</dict></plist>
PL
launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"
echo "Сборщик стоит на расписании: каждый день в 06:30. Лог — $ROOT/.cache/collect/."
read -r

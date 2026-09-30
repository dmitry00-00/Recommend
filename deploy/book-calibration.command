#!/bin/bash
# Калибровка разметки книг (З4). Первый запуск — лист .cache/markup/book_calibration.csv и памятка
# рядом (откроются сами). Заполните, сохраните на том же месте (CSV) и запустите ещё раз — ручная
# разметка уйдёт в src/mocks/bookAnnotations.ts, отчёт сравнения с моделью — .cache/book-calibration-report.md.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$(dirname "$0")/.." || exit 1
set -e
npx --yes tsx tools/book-calibration-sheet.mts
# в листе уже есть уровни — применяем
if grep -qE '^[a-z0-9]+[;,]("[^"]*"|[^;,]*)[;,]("[^"]*"|[^;,]*)[;,][0-9]+[;,][0-9]' .cache/markup/book_calibration.csv; then
  npx --yes tsx tools/apply-book-calibration.mts
  open .cache/book-calibration-report.md 2>/dev/null || true
else
  open .cache/markup/book_calibration_README.txt 2>/dev/null || true
  open .cache/markup/book_calibration.csv 2>/dev/null || true
fi

// Стоп-слова опознавателя (02.10): слово или фраза в заголовке — привязки по названию нет.
// Список — tools/stopwords.json, решает владелец (вкладка «Проверка» → «Стоп-слова»), кандидатов
// считает tools/stopwords.mts по решениям разметки.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

export interface StopWord { w: string; channel?: string; at?: string; note?: string }
export interface StopFile { _?: string; words: StopWord[]; rejected: StopWord[] }
export const STOP_FILE = new URL('./stopwords.json', import.meta.url);

/** Слова заголовка: нижний регистр, ё → е, только буквы и цифры. */
export const tokens = (s: string): string[] => s.toLowerCase().replace(/ё/g, 'е').split(/[^\p{L}\p{N}]+/u).filter(Boolean);

export function readStop(): StopFile {
  try { return existsSync(STOP_FILE) ? JSON.parse(readFileSync(STOP_FILE, 'utf8')) as StopFile : { words: [], rejected: [] }; } catch { return { words: [], rejected: [] }; }
}
export function writeStop(f: StopFile): void { writeFileSync(STOP_FILE, JSON.stringify(f, null, 1) + '\n'); }

/** Сопоставитель: фраза — подряд идущие слова заголовка; канал — точное название. */
export function stopMatcher(list = readStop().words): (title: string, channel?: string) => string | undefined {
  const rules = list.map((s) => ({ ...s, t: tokens(s.w) })).filter((s) => s.t.length);
  if (!rules.length) return () => undefined;
  return (title, channel) => {
    const t = tokens(title);
    for (const r of rules) {
      if (r.channel && r.channel !== channel) continue;
      for (let i = 0; i + r.t.length <= t.length; i++) if (r.t.every((x, j) => t[i + j] === x)) return r.w;
    }
    return undefined;
  };
}

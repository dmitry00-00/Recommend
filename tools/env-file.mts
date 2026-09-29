// Переменные из .env.local — для скриптов, которые запускаются не из Vite (сборщик, публикация).
// Значения только читаются; уже заданные в окружении не перетираются.
import { existsSync, readFileSync } from 'node:fs';

export function loadEnvFile(path = '.env.local'): Record<string, string> {
  const out: Record<string, string> = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!m || line.trim().startsWith('#')) continue;
    out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
  for (const [k, v] of Object.entries(out)) if (process.env[k] === undefined) process.env[k] = v;
  return out;
}

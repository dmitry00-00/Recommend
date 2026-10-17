// Наблюдение за боевым сервером (аудит 17.10, волна 1, п. 12): о падении владелец узнавал от участников.
// Один прогон — один GET TM_SERVER/api/health (предел 10 с); запускает агент launchd раз в 5 мин.
//   - две неудачи подряд — тревога сообщением в Telegram; пока сервер лежит — напоминание раз в 6 ч;
//   - снова ответил — «снова работает» (если до этого была тревога);
//   - раз в сутки — самая новая копия базы в ~/recomend-backups/db (TM_DB_BACKUP_DIR) моложе 30 ч, иначе тревога.
// Сообщение шлёт бот приложения (BOT_TOKEN или TELEGRAM_BOT_TOKEN — тот же, что у бота на bothost) владельцу
// (OWNER_TG_ID) — оба из .env.local. Нет любого из них — тревога только в журнал и в state.json.
// Состояние — .cache/health/state.json, журнал событий — .cache/health/health.log (TM_HEALTH_DIR).
// Обычный удачный прогон ничего не печатает: журнал launchd растёт только событиями.
//
//   npx tsx tools/health-watch.mts            один прогон (так его и зовёт launchd)
//   npx tsx tools/health-watch.mts --status   что сейчас в state.json
//
// Включить агенты (владелец, 17.10; plist лежат в репозитории, в LaunchAgents их кладут руками):
//   mkdir -p ~/recomend/.cache/backup ~/recomend/.cache/health
//   cp ~/recomend/tools/launchd/tm.recomend.{backup,health}.plist ~/Library/LaunchAgents/
//   launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/tm.recomend.backup.plist
//   launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/tm.recomend.health.plist
// Выключить: launchctl bootout gui/$(id -u)/tm.recomend.health (и .backup).
// Для проверки на заглушке: TM_SERVER=http://127.0.0.1:<порт>, TG_API_BASE=<адрес заглушки Bot API>, TM_HEALTH_DIR=<папка>.
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnvFile } from './env-file.mts';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
loadEnvFile(join(ROOT, '.env.local'));
const server = (process.env.TM_SERVER ?? 'https://bot-1791394986-4062-dmitriy-00.bothost.tech').replace(/\/+$/, '');
const DIR = process.env.TM_HEALTH_DIR ?? join(ROOT, '.cache', 'health');
const STATE = join(DIR, 'state.json');
const LOG = join(DIR, 'health.log');
const BACKUPS = process.env.TM_DB_BACKUP_DIR ?? join(homedir(), 'recomend-backups', 'db');
const botToken = (process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '').trim();
const ownerId = (process.env.OWNER_TG_ID || '').trim();
const tgApi = (process.env.TG_API_BASE ?? 'https://api.telegram.org').replace(/\/+$/, '');

const FAILS_TO_ALERT = 2;
const REMIND_MS = 6 * 3600e3;
const BACKUP_CHECK_MS = 24 * 3600e3;
const BACKUP_MAX_AGE_H = 30;

interface State {
  fails: number;              // неудач подряд
  down: boolean;              // тревога поднята
  downSince?: string;         // первая неудача этой серии
  lastOk?: string;
  lastFail?: string;
  lastError?: string;
  alertSentAt?: string;       // когда последний раз ушло сообщение о падении (или записано в журнал без бота)
  alertDelivered?: boolean;   // дошло ли оно ботом
  backupCheckedAt?: string;
  backupNewest?: string;      // имя самой новой копии на прошлой проверке
  backupStale?: boolean;
  pending?: string[];         // тревоги, которые не удалось отправить (бот не ответил) — попробуем в следующий прогон
}

mkdirSync(DIR, { recursive: true });
const load = (): State => { try { return { fails: 0, down: false, ...JSON.parse(readFileSync(STATE, 'utf8')) }; } catch { return { fails: 0, down: false }; } };
const save = (s: State) => { writeFileSync(`${STATE}.tmp`, JSON.stringify(s, null, 2) + '\n'); renameSync(`${STATE}.tmp`, STATE); };
const now = new Date();
const iso = now.toISOString();
const local = (d: Date | string) => new Date(d).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', dateStyle: 'short', timeStyle: 'short' });
// токен бота не должен попасть ни в журнал, ни в state: в тексте ошибок fetch бывает адрес
const clean = (s: string) => (botToken ? s.split(botToken).join('<токен>') : s).slice(0, 300);
const journal = (s: string) => { const line = `${iso} ${clean(s)}`; console.log(line); appendFileSync(LOG, `${line}\n`); };

/** Сообщение владельцу ботом. true — дошло; без токена или номера — только журнал (это не «не дошло»). */
async function notify(text: string): Promise<boolean | 'no-bot'> {
  if (!botToken || !ownerId) { journal(`(бота нет: ${!botToken ? 'BOT_TOKEN' : 'OWNER_TG_ID'} не задан в .env.local) ${text}`); return 'no-bot'; }
  try {
    const res = await fetch(`${tgApi}/bot${botToken}/sendMessage`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: ownerId, text, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(10e3),
    });
    const body = await res.text();
    if (!res.ok) { journal(`бот не отправил (${res.status} ${body.slice(0, 120)}): ${text}`); return false; }
    journal(`→ владельцу: ${text}`);
    return true;
  } catch (err) {
    journal(`бот не ответил (${(err as Error).message}): ${text}`);
    return false;
  }
}

/** Один GET /api/health: ok — 2xx и в ответе `ok: true` (так отвечает воркер). */
async function probe(): Promise<{ ok: boolean; error?: string; ms: number }> {
  const t = Date.now();
  try {
    const res = await fetch(`${server}/api/health`, { signal: AbortSignal.timeout(10e3), headers: { 'cache-control': 'no-cache' } });
    const text = await res.text();
    if (!res.ok) return { ok: false, error: `${res.status} ${text.slice(0, 80).replace(/\s+/g, ' ')}`, ms: Date.now() - t };
    let ok = false;
    try { ok = JSON.parse(text)?.ok === true; } catch { /* не JSON — не наш сервер (заглушка прокси bothost) */ }
    return ok ? { ok, ms: Date.now() - t } : { ok: false, error: `200, но не ответ API: ${text.slice(0, 80).replace(/\s+/g, ' ')}`, ms: Date.now() - t };
  } catch (err) {
    const e = err as Error & { cause?: { code?: string } };
    return { ok: false, error: e.name === 'TimeoutError' ? 'нет ответа за 10 с' : `${e.message}${e.cause?.code ? ` (${e.cause.code})` : ''}`, ms: Date.now() - t };
  }
}

/** Самая новая копия базы здесь: время — из имени (когда её снял сервер), иначе — время файла. */
function newestBackup(): { name: string; at: number } | undefined {
  if (!existsSync(BACKUPS)) return undefined;
  const all = readdirSync(BACKUPS).filter((f) => f.endsWith('.sqlite.gz')).map((name) => {
    const m = /^tm-(\d{4}-\d{2}-\d{2})-(\d{2})(\d{2})(\d{2})-/.exec(name);
    const at = m ? Date.parse(`${m[1]}T${m[2]}:${m[3]}:${m[4]}Z`) : statSync(join(BACKUPS, name)).mtimeMs;
    return { name, at };
  });
  return all.sort((a, b) => b.at - a.at)[0];
}

if (process.argv.includes('--status')) {
  console.log(JSON.stringify(load(), null, 2));
  console.log(`сервер ${server}; бот ${botToken ? 'есть' : 'нет'}, номер владельца ${ownerId ? 'есть' : 'нет'}`);
  process.exit(0);
}

const st = load();

// тревоги, не дошедшие в прошлый раз (бот не ответил), — первыми
if (st.pending?.length) {
  const left: string[] = [];
  for (const text of st.pending) if ((await notify(`${text} (повтор)`)) === false) left.push(text);
  st.pending = left.length ? left.slice(-5) : undefined;
}
const alert = async (text: string) => {
  const r = await notify(text);
  if (r === false) st.pending = [...(st.pending ?? []), text].slice(-5);
  return r;
};

const p = await probe();
if (p.ok) {
  if (st.down) {
    const since = st.downSince ? Math.round((now.getTime() - Date.parse(st.downSince)) / 60e3) : undefined;
    await alert(`✅ recomend: сервер снова работает${since !== undefined ? ` (не отвечал ~${since} мин, с ${local(st.downSince!)} МСК)` : ''}. ${server}`);
  } else if (st.fails > 0) {
    journal(`ответил после ${st.fails} неудачи (${st.lastError}) — тревоги не было`);
  }
  Object.assign(st, { fails: 0, down: false, lastOk: iso, downSince: undefined, alertSentAt: undefined, alertDelivered: undefined });
} else {
  st.fails += 1;
  st.lastFail = iso;
  st.lastError = clean(p.error ?? '?');
  st.downSince ??= iso;
  journal(`/api/health: ${st.lastError} (неудача ${st.fails} подряд)`);
  const remind = st.down && st.alertSentAt && now.getTime() - Date.parse(st.alertSentAt) >= REMIND_MS;
  if ((!st.down && st.fails >= FAILS_TO_ALERT) || remind) {
    const r = await alert(`🔴 recomend: сервер не отвечает${remind ? ' (всё ещё)' : ''} — неудачных проверок подряд: ${st.fails}, с ${local(st.downSince)} МСК. `
      + `Последняя ошибка: ${st.lastError}. ${server}/api/health`);
    st.down = true;
    st.alertSentAt = iso;
    st.alertDelivered = r === true;
  }
}

// раз в сутки — свежесть копии базы на Mac (агент tm.recomend.backup и ночной сбор)
if (!st.backupCheckedAt || now.getTime() - Date.parse(st.backupCheckedAt) >= BACKUP_CHECK_MS) {
  const b = newestBackup();
  const ageH = b ? (now.getTime() - b.at) / 3600e3 : Infinity;
  st.backupCheckedAt = iso;
  st.backupNewest = b?.name;
  st.backupStale = ageH > BACKUP_MAX_AGE_H;
  if (st.backupStale) {
    await alert(`🟠 recomend: копии базы на Mac ${b ? `${Math.round(ageH)} ч (самая новая — ${b.name})` : `нет вовсе (${BACKUPS})`}, а должна быть моложе ${BACKUP_MAX_AGE_H} ч. `
      + `Журнал: ~/recomend/.cache/backup/launchd.log; руками — npx tsx tools/db-backup.mts pull`);
  } else {
    journal(`копия базы на Mac: ${b!.name}, ${ageH.toFixed(1)} ч — в порядке`);
  }
}

save(st);

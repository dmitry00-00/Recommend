// Профили Кинопоиска списком (23.10, просьба владельца): вставил в пульт десятки ссылок — они встают в очередь помощника
// (.cache/outreach/kp-queue.json, её перечитывает прогон после каждого профиля) и тем самым в список адресатов
// (tools/addressees.mts). Канал на той же строке (@ник, t.me/ник) — канал адресата; нет — профиль просто копит историю.
// Контакты: помощник (tools/kinopoisk-helper.js) перед оценками смотрит главную страницу профиля и кладёт найденное
// первой строкой файла (`<!-- kp-contacts … -->`); здесь — чтение. Что встречается почти у всех профилей (подвал и меню
// самой площадки), — не контакт: такие ники и ссылки отсеиваются по частоте. Итог для других инструментов —
// .cache/outreach/kp-contacts.json (вне git: контакты людей).
// Находки шлюза (23.10, просьба владельца «автоматизировать»): профили из постов и комментариев Telegram
// (.cache/tg-asks/found.json, tools/viewer-profiles.mts) — `syncFound`: Кинопоиск — в ту же очередь помощника, Letterboxd —
// первый сбор истории сразу (tools/profile-seed.mts; дальше копит ночной `--auto`); Фантлаб и Goodreads — так же,
// tools/book-profile-seed.mts (в отчёте прохода — вместе с Letterboxd). Зовёт автоимпорт на каждом проходе;
// работа — только когда файл находок изменился.
import { closeSync, existsSync, openSync, readdirSync, readFileSync, readSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { addressees, helperState, HELPER_DIR, kpSeed, QUEUE, type HelperState } from './addressees.mts';
import { letterboxdUser, viewerProfiles, type FoundPost } from './viewer-profiles.mts';

export interface QueueItem { id: string; channel?: string | null; from: string }
export interface Contacts { at?: string; title?: string; tg: string[]; mentions: string[]; links: string[]; error?: string }

const CONTACTS = '.cache/outreach/kp-contacts.json';
/** профиль в адресе: номер или ник (как имя папки помощника) */
const KP = /kinopoisk\.ru\/user\/([\w.-]+)/i;
const CHANNEL = /(?:t\.me\/|telegram\.me\/|(?<![\w.@/])@)([A-Za-z][A-Za-z0-9_]{3,31})\b/;

// нет файла — пустая очередь; битый — ошибка, а не [] (23.10, ревью): иначе addProfiles перезаписал бы очередь одними
// новыми профилями. Пишут три процесса (пульт, автоимпорт, channel-profiles-finalize.py) — у каждого свой tmp
export const readQueue = (): QueueItem[] => existsSync(QUEUE) ? JSON.parse(readFileSync(QUEUE, 'utf8')) as QueueItem[] : [];
function writeQueue(q: QueueItem[]): void {
  const tmp = `${QUEUE}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(q, null, 1)}\n`);
  renameSync(tmp, QUEUE);
}

/** Текст со ссылками → профили. Строка без ссылки на профиль — в `bad` (кроме пустых). Канал — с той же строки. */
export function parseProfiles(text: string): { items: { id: string; channel?: string }[]; bad: string[] } {
  const items: { id: string; channel?: string }[] = [], bad: string[] = [];
  for (const line of text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) {
    // точка или дефис в конце — знак препинания после ссылки, не часть ника (ревью 23.10)
    const ids = [...line.matchAll(new RegExp(KP.source, 'gi'))].map((m) => m[1].replace(/[.-]+$/, '')).filter(Boolean);
    if (!ids.length) { bad.push(line.slice(0, 120)); continue; }
    // канал ищем в строке без ссылок на Кинопоиск
    const channel = CHANNEL.exec(line.replace(/\S*kinopoisk\.ru\S*/gi, ' '))?.[1];
    for (const id of ids) items.push({ id, ...(channel ? { channel } : {}) });
  }
  return { items, bad };
}

/** Дописать в очередь; уже есть (без учёта регистра) — мимо, но канал дописывается, если его не было. */
export function addProfiles(text: string, from: string): { added: string[]; already: string[]; channelSet: string[]; bad: string[] } {
  const { items, bad } = parseProfiles(text);
  const q = readQueue();
  const at = new Map(q.map((x, i) => [x.id.toLowerCase(), i]));
  const added: string[] = [], already: string[] = [], channelSet: string[] = [];
  for (const it of items) {
    const i = at.get(it.id.toLowerCase());
    if (i == null) { at.set(it.id.toLowerCase(), q.length); q.push({ id: it.id, channel: it.channel ?? null, from }); added.push(it.id); continue; }
    if (it.channel && !q[i].channel) { q[i] = { ...q[i], channel: it.channel }; channelSet.push(it.id); } else already.push(it.id);
  }
  if (added.length || channelSet.length) writeQueue(q);
  return { added, already, channelSet, bad };
}

// ─── контакты ──────────────────────────────────────────────────────────────────
const cache = new Map<string, { mtime: number; c: Contacts | undefined }>();
/** контакты из файлов помощника в папке профиля (первый файл с меткой); нет — undefined */
function rawContacts(kp: string): Contacts | undefined {
  const dir = join(HELPER_DIR, kp);
  if (!existsSync(dir)) return undefined;
  const files = readdirSync(dir).filter((f) => f.endsWith('.html')).map((f) => join(dir, f));
  const mtime = Math.max(0, ...files.map((f) => statSync(f).mtimeMs));
  const hit = cache.get(kp);
  if (hit && hit.mtime === mtime) return hit.c;
  let c: Contacts | undefined;
  for (const f of files) {
    // метка — в первой строке: читать файл целиком незачем (страниц бывает на десятки мегабайт)
    const fd = openSync(f, 'r'), buf = Buffer.alloc(64 * 1024);
    const head = buf.subarray(0, readSync(fd, buf, 0, buf.length, 0)).toString('utf8');
    closeSync(fd);
    const m = /^<!-- kp-contacts (\S+) -->/.exec(head);
    if (!m) continue;
    try { c = JSON.parse(decodeURIComponent(m[1])) as Contacts; } catch { continue; }
    if (!c.error) break;
  }
  cache.set(kp, { mtime, c });
  return c;
}

/** Контакты всех профилей очереди; ники и ссылки площадки (есть у ≥ 30% проверенных, не меньше чем у 3) — вон. */
export function allContacts(kps = readQueue().map((x) => x.id)): Map<string, Contacts> {
  const raw = new Map(kps.map((k) => [k, rawContacts(k)] as const).filter((x): x is [string, Contacts] => !!x[1] && !x[1].error));
  const freq = new Map<string, number>();
  for (const c of raw.values()) for (const k of new Set([...c.tg.map((x) => `@${x}`), ...c.mentions.map((x) => `@${x}`), ...c.links.map((x) => x.toLowerCase())])) freq.set(k, (freq.get(k) ?? 0) + 1);
  // свои страницы площадки (подвал: youtube.com/@kinopoisk, dzen.ru/kinopoisk.ru) — сразу, не дожидаясь частоты
  const own = /kinopoisk|yandex|kinopoiskru/i;
  const common = (k: string) => own.test(k) || (freq.get(k) ?? 0) >= Math.max(3, 0.3 * raw.size);
  const out = new Map<string, Contacts>();
  for (const [k, c] of raw) {
    const tg = c.tg.filter((x) => !common(`@${x}`));
    out.set(k, { ...c, tg, mentions: c.mentions.filter((x) => !common(`@${x}`) && !tg.includes(x)), links: c.links.filter((x) => !common(x.toLowerCase())) });
  }
  return out;
}

export interface ProfileRow { id: string; channel: string | null; from: string; state: HelperState; note?: string; contacts?: Contacts; checked: boolean }
/** Очередь для пульта: состояние помощника и контакты по каждому профилю; заодно — снимок контактов в файл. */
export function profilesState(): { rows: ProfileRow[]; counts: Record<string, number> } {
  const q = readQueue();
  const contacts = allContacts(q.map((x) => x.id));
  const rows = q.map((x): ProfileRow => {
    const h = helperState(x.id);
    return { id: x.id, channel: x.channel ?? null, from: x.from, state: h.state, ...(h.note ? { note: h.note } : {}),
      ...(contacts.has(x.id) ? { contacts: contacts.get(x.id) } : {}), checked: contacts.has(x.id) };
  });
  const counts: Record<string, number> = { всего: rows.length };
  for (const r of rows) counts[r.state] = (counts[r.state] ?? 0) + 1;
  counts['контакты проверены'] = rows.filter((r) => r.checked).length;
  counts['есть Telegram'] = rows.filter((r) => r.contacts?.tg.length || r.contacts?.mentions.length).length;
  saveContacts(contacts);
  return { rows, counts };
}

function saveContacts(contacts: Map<string, Contacts>): void {
  const body = `${JSON.stringify(Object.fromEntries([...contacts].filter(([, c]) => c.tg.length || c.mentions.length || c.links.length)), null, 1)}\n`;
  try { if (existsSync(CONTACTS) && readFileSync(CONTACTS, 'utf8') === body) return; } catch { /* пишем заново */ }
  writeFileSync(`${CONTACTS}.tmp`, body);
  renameSync(`${CONTACTS}.tmp`, CONTACTS);
}

// ─── находки шлюза ─────────────────────────────────────────────────────────────
const FOUND = '.cache/tg-asks/found.json';
/** первых сборов Letterboxd за проход: лента RSS — по запросу на профиль, но всё равно бережно */
const LB_PER_PASS = 5;
let foundAt = 0;
/** уже пробовали в этом процессе (не собралось — до перезапуска не пробуем; ночной --auto попробует сам) */
const triedLb = new Set<string>();
/** Новые профили из находок: Кинопоиск — в очередь, Letterboxd без истории — первый сбор. Файл не менялся — ничего. */
export function syncFound(): { kp: string[]; letterboxd: string[]; failed: string[] } | undefined {
  if (!existsSync(FOUND)) return undefined;
  const mtime = statSync(FOUND).mtimeMs;
  if (mtime === foundAt) return undefined;
  const profiles = viewerProfiles(JSON.parse(readFileSync(FOUND, 'utf8')) as FoundPost[]);
  const kp: string[] = [];
  // все имена истории у профиля (24.10, ревью п. 6): у присланного владельцем своё имя (kp_kinofilnii для t.me.kinofilnii),
  // а не kp_<профиль> — по одному kp_<профиль> собранное не узнать, и находка ставила бы двойника в очередь
  const seedsOf = new Map<string, string[]>();
  for (const a of addressees()) if (a.kp) seedsOf.set(a.kp.toLowerCase(), [...(seedsOf.get(a.kp.toLowerCase()) ?? []), a.seed]);
  for (const p of profiles.filter((x) => x.site === 'Кинопоиск')) {
    // уже собран другим путём (пульт, присланное владельцем) — история под любым его именем или метка .done помощника:
    // второй раз Кинопоиск не трогаем
    const id = parseProfiles(p.url).items[0]?.id;
    if (!id) continue;
    const names = [kpSeed(id), ...(seedsOf.get(id.toLowerCase()) ?? [])];
    if (names.some((s) => existsSync(`seeds/${s}.json`)) || ['собран', 'оценки скрыты'].includes(helperState(id).state)) continue;
    // канал находки — где человек оставил ссылку, а не его канал: в `from`, поле канала не трогаем
    const r = addProfiles(p.url, `находка шлюза @${p.channel}${p.date ? ` ${p.date.slice(0, 10)}` : ''}`);
    kp.push(...r.added);
  }
  const letterboxd: string[] = [], failed: string[] = [];
  const fresh = [...new Set(profiles.filter((x) => x.site === 'Letterboxd').map((x) => letterboxdUser(x.url)).filter((u): u is string => !!u))]
    .filter((u) => !triedLb.has(u) && !existsSync(`seeds/letterboxd-${u}.json`) && !existsSync(`seeds/letterboxd-${u.toLowerCase()}.json`));
  for (const u of fresh.slice(0, LB_PER_PASS)) {
    triedLb.add(u);
    const r = spawnSync('npx', ['--yes', 'tsx', 'tools/profile-seed.mts', `letterboxd:${u}`], { encoding: 'utf8', timeout: 10 * 60e3 });
    // собрано — только если история появилась (24.10, ревью п. 8): profile-seed на ошибку HTTP или пустой дневник
    // пропускает профиль и выходит с кодом 0
    const got = existsSync(`seeds/letterboxd-${u}.json`) || existsSync(`seeds/letterboxd-${u.toLowerCase()}.json`);
    (r.status === 0 && got ? letterboxd : failed).push(u);
  }
  // книги (23.10): Фантлаб и Goodreads без истории в seeds/books/ — первый сбор (tools/book-profile-seed.mts)
  const bookRef = (url: string) => { const f = /fantlab\.ru\/user(\d+)/i.exec(url), g = /goodreads\.com\/user\/show\/(\d+)/i.exec(url); return f ? `fantlab:${f[1]}` : g ? `goodreads:${g[1]}` : undefined; };
  const books = [...new Set(profiles.map((p) => bookRef(p.url)).filter((r): r is string => !!r))]
    .filter((r) => !triedLb.has(r) && !existsSync(`seeds/books/${r.replace(':', '-')}.json`));
  for (const r of books.slice(0, LB_PER_PASS)) {
    triedLb.add(r);
    const res = spawnSync('npx', ['--yes', 'tsx', 'tools/book-profile-seed.mts', r], { encoding: 'utf8', timeout: 15 * 60e3 });
    (res.status === 0 && existsSync(`seeds/books/${r.replace(':', '-')}.json`) ? letterboxd : failed).push(r);
  }
  // не всё успели — следующий проход возьмёт остальное (файл тот же, но отметку не ставим)
  if (fresh.length <= LB_PER_PASS && books.length <= LB_PER_PASS) foundAt = mtime;
  return { kp, letterboxd, failed };
}

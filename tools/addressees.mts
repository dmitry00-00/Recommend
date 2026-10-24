// Адресаты личных подборок (ЗП-46, 22.10): профиль зрителя на Кинопоиске или Letterboxd → канал → история в seeds/.
// Общее для вкладки «Истории» пульта (tools/histories-desk.mts), автоимпорта скачанного (tools/kinopoisk-autoimport.mts)
// и подборок (tools/outreach-slates.mts). Откуда адресаты:
//   .cache/outreach/kp-queue.json        — очередь помощника-закладки: профиль Кинопоиска → канал (списки владельца и находки);
//   .cache/outreach/addressees-extra.json — присланное владельцем вне очереди (Letterboxd, папка «Профили»), с явным seed;
//   находки шлюза (вкладка «Запросы», tools/viewer-profiles.mts).
// Страницы оценок помощник складывает в ~/Downloads/Профили/помощник/<профиль>/ (TM_KP_HELPER_DIR): метка .done — собран
// (в ней итог помощника: «оценки скрыты» тоже сюда), .skip — три раза подряд не открылся, отложен.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { letterboxdUser, viewerProfiles, type FoundPost } from './viewer-profiles.mts';

export const HELPER_DIR = process.env.TM_KP_HELPER_DIR ?? join(homedir(), 'Downloads', 'Профили', 'помощник');
export const QUEUE = '.cache/outreach/kp-queue.json';
const EXTRA = '.cache/outreach/addressees-extra.json';
const FOUND = '.cache/tg-asks/found.json';

export type Site = 'Кинопоиск' | 'Letterboxd';
export interface Addressee {
  seed: string; site: Site; channel: string | null; profile: string; from: string;
  /** профиль Кинопоиска — как в адресе (`820385`, `mrkuhnya`): имя папки помощника */
  kp?: string;
  /** место в очереди помощника (с нуля) */
  queue?: number;
}

const read = <T,>(f: string, d: T): T => { try { return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) as T : d; } catch { return d; } };
/** имя истории для профиля Кинопоиска: seeds/kp_<профиль>.json (ник Telegram — только буквы, цифры и _) */
export const kpSeed = (id: string) => `kp_${id.replace(/[^A-Za-z0-9_]/g, '_')}`;
const kpOf = (url: string) => /kinopoisk\.ru\/user\/([\w.-]+)/.exec(url)?.[1];

/** Все адресаты: присланное владельцем главнее находок; без канала уступает тому, у кого канал известен. */
export function addressees(): Addressee[] {
  const out = new Map<string, Addressee>();
  const add = (a: Addressee) => {
    const had = out.get(a.seed);
    if (!had) out.set(a.seed, a);
    else out.set(a.seed, { ...had, channel: had.channel ?? a.channel, queue: had.queue ?? a.queue, kp: had.kp ?? a.kp });
  };
  for (const a of read<Omit<Addressee, 'site'>[]>(EXTRA, [])) {
    const kp = kpOf(a.profile);
    add({ ...a, site: kp ? 'Кинопоиск' : 'Letterboxd', ...(kp ? { kp } : {}) });
  }
  read<{ id: string; channel: string; from: string }[]>(QUEUE, []).forEach((q, i) =>
    add({ seed: kpSeed(q.id), site: 'Кинопоиск', channel: q.channel, profile: `https://www.kinopoisk.ru/user/${q.id}/`, from: q.from, kp: q.id, queue: i }));
  for (const p of viewerProfiles(read<FoundPost[]>(FOUND, []))) {
    const from = `находка шлюза ${p.date?.slice(0, 10) ?? ''}`.trim();
    if (p.site === 'Letterboxd') { const u = letterboxdUser(p.url); if (u) add({ seed: `letterboxd-${u.toLowerCase()}`, site: 'Letterboxd', channel: p.channel, profile: p.url, from }); }
    else if (p.site === 'Кинопоиск') { const kp = kpOf(p.url)!; add({ seed: kpSeed(kp), site: 'Кинопоиск', channel: p.channel, profile: p.url, from, kp }); }
  }
  return [...out.values()];
}

export type HelperState = 'в очереди' | 'качается' | 'собран' | 'оценки скрыты' | 'отложен';
/** Что помощник сделал с профилем Кинопоиска: по папке и меткам в ней. */
export function helperState(kp: string): { state: HelperState; note?: string; files: number; at?: string } {
  const dir = join(HELPER_DIR, kp);
  if (!existsSync(dir)) return { state: 'в очереди', files: 0 };
  const files = readdirSync(dir).filter((f) => f.endsWith('.html'));
  const mark = (m: string) => (existsSync(join(dir, m)) ? readFileSync(join(dir, m), 'utf8').trim() : undefined);
  const done = mark('.done'), skip = mark('.skip');
  // метка — «<время ISO> <итог помощника>»
  const at = (done ?? skip)?.split(' ')[0];
  const note = (m: string) => m.slice(m.indexOf(' ') + 1);
  if (done) return { state: /оценки скрыты|нет фильмов/.test(done) ? 'оценки скрыты' : 'собран', note: note(done), files: files.length, at };
  if (skip) return { state: 'отложен', note: note(skip), files: files.length, at };
  return { state: 'качается', files: files.length };
}
/** Самая свежая страница помощника — чтобы понять, не устарела ли история. */
export function helperNewest(kp: string): number {
  const dir = join(HELPER_DIR, kp);
  if (!existsSync(dir)) return 0;
  // файл из одних контактов (kp-<профиль>-контакты.html, tools/kinopoisk-helper.js) — не докачка: историю не пересобирать
  return Math.max(0, ...readdirSync(dir).filter((f) => f.endsWith('.html') && !f.endsWith('-контакты.html')).map((f) => statSync(join(dir, f)).mtimeMs));
}

export interface SeedStats { watched: number; rated: number; median?: number; at?: string; mtime: number }
/** Что лежит в seeds/<имя>.json: сколько фильмов и оценок, медиана сырой шкалы, когда собрана. */
export function seedStats(seed: string): SeedStats | undefined {
  const f = `seeds/${seed}.json`;
  if (!existsSync(f)) return undefined;
  const j = read<{ watched?: unknown[]; ratings?: { raw?: number }[]; resolvedAt?: string }>(f, {});
  const raws = (j.ratings ?? []).map((r) => r.raw).filter((x): x is number => x != null).sort((a, b) => a - b);
  return { watched: j.watched?.length ?? 0, rated: raws.length, ...(raws.length ? { median: raws[Math.floor(raws.length / 2)] } : {}), at: j.resolvedAt, mtime: statSync(f).mtimeMs };
}

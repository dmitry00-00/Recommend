// Точность опознавателя по каналу и способу (02.10, ОП-1): где ему можно верить без человека.
//   npx tsx tools/link-precision.mts     → .cache/link-precision.json, итог — последней строкой
//
// Опознаватель прогоняется по роликам с вердиктом (как в замере), каждая привязка — с каналом и
// способом: по названию (title), по году, оригинальному названию, хэштегу и тегам (tag). По паре
// «канал × способ» — сколько верных и ошибочных и нижняя граница доли верных (Уилсон, 90%).
//   · надёжная пара — от 20 привязок и нижняя граница от 0,9: её догадки индекс считает
//     подтверждёнными (улика `channel` — «надёжный канал»);
//   · слабая пара — от 10 привязок и верных меньше 85%: её улика не подтверждает, догадка идёт на
//     проверку, а вкладка «Проверка» ставит её в спорные с пометкой «канал часто ошибается».
// Решения людей сильнее: их это не касается.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { worksIndex } from './works-index.mts';
import { matchVideos } from './match-videos.mts';
import { isBookKey } from '../src/lib/keys.ts';

export const PRECISION = new URL('../.cache/link-precision.json', import.meta.url);
export const TRUST_N = 20, TRUST_LB = 0.9, WEAK_N = 10, WEAK_P = 0.85;
export interface PairStat { right: number; wrong: number; p: number; lb: number }
export interface Precision { at: string; method: Record<string, PairStat>; pair: Record<string, PairStat>; trusted: string[]; weak: string[] }

export const pairKey = (channel: string | undefined, method: string) => `${channel ?? '?'}|${method}`;
export function readPrecision(): Precision | undefined {
  try { return existsSync(PRECISION) ? JSON.parse(readFileSync(PRECISION, 'utf8')) as Precision : undefined; } catch { return undefined; }
}
/** Нижняя граница Уилсона для доли верных (z = 1,64 — 90%). */
export function wilson(right: number, n: number, z = 1.64): number {
  if (!n) return 0;
  const p = right / n;
  return (p + (z * z) / (2 * n) - z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n)) / (1 + (z * z) / n);
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const root = new URL('../', import.meta.url);
  const read = <T,>(p: string, d: T): T => existsSync(new URL(p, root)) ? JSON.parse(readFileSync(new URL(p, root), 'utf8')) as T : d;
  type V = { key: string | null; why?: string; from?: string; guess?: boolean };
  const human = read<{ videos?: Record<string, V> }>('tools/markup-verdicts.json', {}).videos ?? {};
  const videos = read<{ id: string; title: string; channel?: string; channelId?: string }[]>('.cache/youtube/videos.json', []);
  const channels = read<Record<string, { medium?: string }>>('.cache/youtube/channels.json', {});
  const ordinary = new Set<string>(read<{ names?: string[] }>('.cache/ordinary.json', {}).names ?? []);
  const byId = new Map(videos.map((v) => [v.id, v]));
  const truth = Object.entries(human).filter(([id, v]) => !v.guess && v.from !== 'desk' && byId.has(id) && (v.key || v.why));
  const set = truth.map(([id]) => ({ ...byId.get(id)!, book: channels[byId.get(id)!.channelId ?? '']?.medium === 'book' }));
  const got = matchVideos(set, worksIndex().filter((w) => !isBookKey(w.key)), ordinary);

  const acc = { method: new Map<string, [number, number]>(), pair: new Map<string, [number, number]>() };
  const bump = (m: Map<string, [number, number]>, k: string, ok: boolean) => { const c = m.get(k) ?? [0, 0]; c[ok ? 0 : 1]++; m.set(k, c); };
  for (const [id, v] of truth) {
    const g = got.get(id);
    if (!g) continue;
    const method = g.evidence ?? 'title';
    const ok = g.key === v.key;
    bump(acc.method, method, ok);
    bump(acc.pair, pairKey(byId.get(id)!.channel, method), ok);
  }
  const stat = ([r, w]: [number, number]): PairStat => ({ right: r, wrong: w, p: Math.round((r / (r + w)) * 1000) / 1000, lb: Math.round(wilson(r, r + w) * 1000) / 1000 });
  const pair = Object.fromEntries([...acc.pair].map(([k, c]) => [k, stat(c)]));
  const trusted = Object.entries(pair).filter(([, s]) => s.right + s.wrong >= TRUST_N && s.lb >= TRUST_LB).map(([k]) => k);
  const weak = Object.entries(pair).filter(([, s]) => s.right + s.wrong >= WEAK_N && s.p < WEAK_P).map(([k]) => k);
  const out: Precision = { at: new Date().toISOString(), method: Object.fromEntries([...acc.method].map(([k, c]) => [k, stat(c)])), pair, trusted, weak };
  mkdirSync(new URL('.cache/', root), { recursive: true });
  writeFileSync(PRECISION, JSON.stringify(out, null, 1));
  const show = (k: string) => `${k.replace('|', ' · ')} ${pair[k].right}/${pair[k].right + pair[k].wrong}`;
  console.error(`по способам: ${Object.entries(out.method).map(([k, s]) => `${k} ${s.right}/${s.right + s.wrong}`).join(', ')}`);
  console.error(`надёжные: ${trusted.map(show).join('; ') || '—'}`);
  console.error(`слабые: ${weak.map(show).join('; ') || '—'}`);
  console.log(`точность по каналам: надёжных пар ${trusted.length}, слабых ${weak.length}`);
}

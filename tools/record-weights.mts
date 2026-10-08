/**
 * Веса записей (02.10, набросок; src/lib/weights.ts): замер доверия к улике на решениях людей и
 * отчёт, как меняется порядок произведений от сырого счёта к весу.
 *
 *   npx tsx tools/record-weights.mts            → src/mocks/recordTrust.ts + отчёт
 *
 * Доверие к улике — доля верных среди привязок опознавателя с этой уликой на роликах с вердиктом
 * (те же правила правды, что у tools/markup-eval.mts), сжатая к априорному числу: при малом n
 * замер весит мало (вес априорного — как 20 решений).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { worksIndex } from './works-index.mts';
import { matchVideos } from './match-videos.mts';
import { isBookKey } from '../src/lib/keys.ts';
import { TRUST_PRIOR, weightOf, recordWeight, type TrustKind } from '../src/lib/weights.ts';
import type { ExternalAnalysis } from '../src/types/tmdf.ts';

const root = new URL('../', import.meta.url);
const read = <T,>(p: string, d: T): T => (existsSync(new URL(p, root)) ? JSON.parse(readFileSync(new URL(p, root), 'utf8')) as T : d);
type V = { key: string | null; why?: string; from?: string; guess?: boolean };
const human = read<{ videos?: Record<string, V> }>('tools/markup-verdicts.json', {}).videos ?? {};
const videos = read<{ id: string; title: string; channelId?: string; description?: string; tags?: string[]; publishedAt?: string }[]>('.cache/youtube/videos.json', []);
const channels = read<Record<string, { medium?: string; title?: string }>>('.cache/youtube/channels.json', {});
const ordinary = new Set<string>(read<{ names?: string[] }>('.cache/ordinary.json', {}).names ?? []);
const byId = new Map(videos.map((v) => [v.id, v]));

// ─── доверие к улике ──────────────────────────────────────────────────────────
const truth = Object.entries(human).filter(([id, v]) => !v.guess && v.from !== 'desk' && byId.has(id) && (v.key || v.why === 'не про фильм'));
const set = truth.map(([id]) => {
  const v = byId.get(id)!;
  return { ...v, channel: channels[v.channelId ?? '']?.title, book: channels[v.channelId ?? '']?.medium === 'book' };
});
const got = matchVideos(set, worksIndex().filter((w) => !isBookKey(w.key)), ordinary);
const tally = new Map<string, { ok: number; n: number }>();
for (const [id, v] of truth) {
  const g = got.get(id);
  if (!g) continue;
  const k = g.evidence ?? (g.offFocus ? 'offfocus' : 'none');
  const t = tally.get(k) ?? { ok: 0, n: 0 };
  t.n++; if (g.key === v.key) t.ok++;
  tally.set(k, t);
}
const PRIOR_N = 20;
const trust: Partial<Record<TrustKind, number>> = {};
console.log('доверие к улике (замер на решениях людей → с поправкой к априорному):');
for (const [k, t] of [...tally].sort((a, b) => b[1].n - a[1].n)) {
  const prior = TRUST_PRIOR[k as TrustKind] ?? TRUST_PRIOR.none;
  const p = (t.ok + prior * PRIOR_N) / (t.n + PRIOR_N);
  if (k in TRUST_PRIOR) trust[k as TrustKind] = Math.round(p * 1000) / 1000;
  console.log(`  ${k.padEnd(9)} верно ${t.ok}/${t.n} = ${(t.ok / t.n * 100).toFixed(1)}%  → ${p.toFixed(3)} (априорно ${prior})`);
}
console.log('  human, manual и channel не замеряются (человек и надёжный канал) — остаются априорными');
writeFileSync(new URL('src/mocks/recordTrust.ts', root), `// Сгенерировано tools/record-weights.mts (${new Date().toISOString().slice(0, 10)}): доверие к привязке по виду
// улики — доля верных на решениях людей, сжатая к априорному (src/lib/weights.ts). Не править руками.
import type { TrustKind } from '@/lib/weights';

export const recordTrust: Partial<Record<TrustKind, number>> = ${JSON.stringify(trust)};
`);

// ─── отчёт: сырой счёт против веса ────────────────────────────────────────────
const mod = async (p: string) => import(new URL(p, root).href);
const [{ essays }, { essaysAuto }, { postsAuto }] = await Promise.all([mod('src/mocks/essays.ts'), mod('src/mocks/essaysAuto.ts'), mod('src/mocks/postsAuto.ts')]);
const all = new Map<string, ExternalAnalysis[]>();
for (const src of [essays, essaysAuto, postsAuto] as Record<string, ExternalAnalysis[]>[]) {
  for (const [k, list] of Object.entries(src)) {
    const have = all.get(k) ?? all.set(k, []).get(k)!;
    for (const a of list) if (!have.some((x) => x.url === a.url)) have.push(a);
  }
}
const voice = (a: ExternalAnalysis) => /^tg-([^-]+)-/.exec(a.id)?.[1] ?? a.author;
const title = new Map(worksIndex({ all: true }).map((w) => [w.key, `${w.work.title}${w.work.year ? ` (${w.work.year})` : ''}`]));
const rows = [...all].map(([k, list]) => ({ k, n: list.length, ch: new Set(list.map(voice)).size,
  w: weightOf(list, voice, { trust }), f: weightOf(list, voice, { trust, fresh: true }) }));
const rankBy = (f: (r: typeof rows[number]) => number) => new Map([...rows].sort((a, b) => f(b) - f(a)).map((r, i) => [r.k, i + 1]));
const rn = rankBy((r) => r.n), rw = rankBy((r) => r.w), rf = rankBy((r) => r.f);
const line = (r: typeof rows[number]) => `  ${String(rw.get(r.k)).padStart(4)} ${(title.get(r.k) ?? r.k).slice(0, 38).padEnd(38)} вес ${r.w.toFixed(1).padStart(5)}  записей ${String(r.n).padStart(4)} (№${rn.get(r.k)})  каналов ${String(r.ch).padStart(3)}  сейчас №${rf.get(r.k)}`;
console.log(`\nпроизведений ${rows.length}; первые 25 по весу:`);
for (const r of [...rows].sort((a, b) => b.w - a.w).slice(0, 25)) console.log(line(r));
const moved = [...rows].map((r) => ({ r, d: rn.get(r.k)! - rw.get(r.k)! })).filter((x) => x.r.n >= 3);
console.log('\nподнялись сильнее всех (мало записей, но много голосов или подтверждено):');
for (const { r } of moved.sort((a, b) => b.d - a.d).slice(0, 10)) console.log(line(r));
console.log('\nопустились сильнее всех (много записей одного канала или догадки):');
for (const { r } of moved.sort((a, b) => a.d - b.d).slice(0, 10)) console.log(line(r));
const ws = [...all.values()].flat().map((a) => recordWeight(a, trust)).sort((a, b) => a - b);
const q = (p: number) => ws[Math.floor(p * (ws.length - 1))].toFixed(2);
console.log(`\nвес записи: медиана ${q(0.5)}, 10% ${q(0.1)}, 90% ${q(0.9)} (записей ${ws.length})`);

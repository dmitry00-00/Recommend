// Разовая сборка карты каналов (channelId → ярус). Не часть сборки.
import { readFileSync, writeFileSync } from 'node:fs';
import { loadEnvFile } from './env-file.mts';
import { sources } from '../src/mocks/sources.ts';

loadEnvFile();
const key = process.env.YT_API_KEY;
if (!key) { console.error('нужен YT_API_KEY'); process.exit(1); }

const vids = JSON.parse(readFileSync('.cache/youtube/videos.json', 'utf8')) as { channel: string; channelId?: string }[];
const meta: Record<string, { handle?: string; title: string; tier: 'essay' | 'review'; medium: 'film' | 'book' }> = {};
for (const v of vids) if (v.channelId && !meta[v.channelId]) meta[v.channelId] = { title: v.channel, tier: 'essay', medium: 'film' };

for (const src of sources.filter((x) => x.platform === 'youtube' && x.role === 'voice')) {
  const r = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet&forHandle=@${src.handle}&key=${key}`);
  if (!r.ok) { console.error(`  @${src.handle}: ${r.status}`); continue; }
  const j = await r.json() as { items?: { id: string; snippet?: { title?: string } }[] };
  const it = j.items?.[0];
  if (!it) { console.error(`  не нашёлся @${src.handle}`); continue; }
  meta[it.id] = { handle: src.handle, title: it.snippet?.title ?? src.title, tier: src.tier ?? 'essay', medium: src.medium ?? 'film' };
}
writeFileSync('.cache/youtube/channels.json', JSON.stringify(meta, null, 1));
const vals = Object.values(meta);
console.log(`каналов ${vals.length} | обзорщиков ${vals.filter((m) => m.tier === 'review').length} | эссеистов ${vals.filter((m) => m.tier === 'essay').length} | про книги ${vals.filter((m) => m.medium === 'book').length}`);
for (const m of vals.filter((x) => x.tier === 'review')) console.log('  обзор:', m.title);

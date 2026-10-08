// Плейлисты каналов (tools/youtube-playlists.mts): ролик → цели его плейлистов — для опознавателя.
import { existsSync, readFileSync } from 'node:fs';

export interface Playlist { id: string; title: string; count: number; items?: string[]; target?: { kind: 'work' | 'universe' | 'person'; id: string; title: string } }
/** цель плейлиста вместе с самим плейлистом — опознавателю нужно знать, кто ещё в нём лежит */
export type PlaylistHit = NonNullable<Playlist['target']> & { pl: string; items: string[] };
export interface PlaylistFile { channels: Record<string, { title: string; at: string; playlists: Playlist[] }> }
/** TM_PLAYLISTS — другой файл (проверки без настоящей выгрузки) */
export const PLAYLISTS = process.env.TM_PLAYLISTS ? new URL(`file://${process.env.TM_PLAYLISTS}`) : new URL('../.cache/youtube/playlists.json', import.meta.url);

import { inUniverse, peopleOfKey } from './about-lib.mts';

/** Подтверждает ли плейлист привязку: цель — само произведение, его вселенная или его человек. */
export function playlistConfirms(targets: readonly NonNullable<Playlist['target']>[] | undefined, key: string): boolean {
  return Boolean(targets?.some((t) => (t.kind === 'work' ? t.id === key : t.kind === 'universe' ? inUniverse(key, t.id) : peopleOfKey(key).includes(t.id))));
}

/** Ролик → цели плейлистов, где он лежит (только плейлисты с целью). */
export function playlistTargets(): Map<string, PlaylistHit[]> {
  const out = new Map<string, PlaylistHit[]>();
  if (!existsSync(PLAYLISTS)) return out;
  let file: PlaylistFile;
  try { file = JSON.parse(readFileSync(PLAYLISTS, 'utf8')) as PlaylistFile; } catch { return out; }
  for (const ch of Object.values(file.channels)) for (const pl of ch.playlists) {
    if (!pl.target || !pl.items) continue;
    const hit: PlaylistHit = { ...pl.target, pl: pl.id, items: pl.items };
    for (const v of pl.items) (out.get(v) ?? out.set(v, []).get(v)!).push(hit);
  }
  return out;
}

// Желания героев (ROADMAP «Желания и ценностный заряд», 14.10): черновики агентов по всем размеченным произведениям
// лежат в src/mocks/desires/NN.json — 64 куска по хэшу ключа произведения, грузятся лениво (странице нужен один).
// Запись — компактно: `m` — модель желаний произведения, `c` — герои кортежами.
import type { CharacterDesire, Confidence, DesireModel, SpoilerLevel } from '@/types/tmdf';

export const DESIRE_SHARDS = 64;

/** Кусок для ключа произведения (`tmdb:…`, `imdb:…`, `wd:…`): один и тот же у сборки и приложения. */
export function desireShard(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (Math.imul(h, 31) + key.charCodeAt(i)) | 0;
  return String((h >>> 0) % DESIRE_SHARDS).padStart(2, '0');
}

/** [герой, хочет вслух, хочет на самом деле ('' — нет зазора), проговорено 0 / по поступкам 1 / по устройству 2,
 *  спойлерность 0–2, уверенность h/m/l] */
export type DesireTuple = [string, string, string, 0 | 1 | 2, SpoilerLevel, 'h' | 'm' | 'l'];
export interface DesireRecord { m: DesireModel; c: DesireTuple[] }

const CONF: Record<DesireTuple[5], Confidence> = { h: 'high', m: 'medium', l: 'low' };

export const desiresOf = (r: DesireRecord): { desireModel: DesireModel; characters: CharacterDesire[] } => ({
  desireModel: r.m,
  characters: r.c.map(([character, explicit, suppressed, visibility, spoilerLevel, c]) => ({
    character, explicit, ...(suppressed ? { suppressed } : {}), visibility, spoilerLevel, confidence: CONF[c],
  })),
});

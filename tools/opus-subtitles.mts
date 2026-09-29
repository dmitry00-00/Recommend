// Корпус субтитров OPUS OpenSubtitles: где он лежит, как разобрать путь и что считать по
// репликам. Само чтение архива по HTTP — в tools/remote-zip.mts.
// Лицензия корпуса — свободная для исследований (OPUS, Lison & Tiedemann 2016); у себя
// держим только числа, тексты субтитров не сохраняем.
import { zipIndex, zipRead, type ZipEntry } from './remote-zip.mts';

export { zipIndex, zipRead, type ZipEntry };

export const OPUS_RU = 'https://object.pouta.csc.fi/OPUS-OpenSubtitles/v2024/raw/ru.zip';

/** IMDb-идентификатор из пути `OpenSubtitles/raw/<язык>/<год>/<каталог>/<файл>.xml`.
 *  Каталог — либо голый номер IMDb, либо `<группа>_<imdb>_<часть>_<всего>` у фильма,
 *  разрезанного на диски. 4294967295 — метка «фильм не опознан». */
export function imdbOf(name: string): { imdb: string; part: number; parts: number } | undefined {
  const dir = name.split('/')[4];
  if (!dir) return undefined;
  const bits = dir.split('_');
  const id = bits.length >= 4 ? bits[1] : bits[0];
  if (!/^\d+$/.test(id) || id === '4294967295') return undefined;
  return {
    imdb: `tt${id.padStart(7, '0')}`,
    part: bits.length >= 4 ? Number(bits[2]) : 1,
    parts: bits.length >= 4 ? Number(bits[3]) : 1,
  };
}

export interface Cue { start: number; end: number; text: string }

const TIME = /<time id="T\d+([SE])" value="(\d+):(\d\d):(\d\d)[,.](\d+)"/g;

/** Реплики из сырого XML OPUS: у блока `<s>` метка начала и метка конца, между ними текст.
 *  Метки местами сбиты (конец реплики помечен номером следующей) — берём первую и последнюю. */
export function parseCues(xml: string): Cue[] {
  const out: Cue[] = [];
  for (const block of xml.split('<s id=').slice(1)) {
    const times: { kind: string; at: number }[] = [];
    TIME.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = TIME.exec(block))) {
      times.push({ kind: m[1], at: Number(m[2]) * 3600 + Number(m[3]) * 60 + Number(m[4]) + Number(`0.${m[5]}`) });
    }
    if (times.length < 2) continue;
    const text = block.replace(/<[^>]*>/g, ' ').replace(/^[^\n]*\n/, ' ').replace(/\s+/g, ' ').trim();
    if (!text) continue;
    const start = times[0].at;
    const end = times[times.length - 1].at;
    if (end <= start || end - start > 60) continue;
    out.push({ start, end, text });
  }
  return out.sort((a, b) => a.start - b.start);
}

export const WORD = /[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*/gu;

export function words(text: string): string[] {
  return (text.toLowerCase().match(WORD) ?? []).filter((w) => /\p{L}/u.test(w));
}

// Мост с кино в книги (З2), чистая часть: какие книги называют в разговоре о кино. Не всякое
// «название в кавычках» — книга: берём только названное рядом с книжным словом — «по роману «…»»,
// «книга «…»», «экранизация повести «…»», «рассказ «…»». Автора, если он стоит сразу за
// кавычками в родительном («Память» Дональда Уэслейка) — тоже.
// Книжные каналы (З6, `loose`): там книжного слова рядом нет — канал сам про книги, — зато почти
// всегда стоит автор: ««Собачье сердце» Булгакова», «"Властелин Колец" Д.Р.Р.Толкина». Берём
// названное в кавычках (и в прямых тоже — так пишут в заголовках роликов), если сразу за ним автор;
// проверяет его потом Wikidata (`sameSurname`), так что «"Театр" Почему» отсеется там.
import { sound } from './evidence.mts';

export interface BookMention { title: string; author?: string; context: string }

const BEFORE = /(?:по\s+(?:роману|книге|повести|рассказу|мотивам\s+(?:романа|книги|повести|рассказа))|экранизаци\p{L}*\s+(?:романа|книги|повести|рассказа|бестселлера)|(?<!\p{L})(?:роман|романа|романом|книга|книги|книгу|книгой|повесть|повести|повестью|рассказ|рассказа|рассказом|бестселлер\p{L}*)(?:-\p{L}+)?)\s*$/iu;
// родительный имени сразу за кавычками: «Память» Дональда Э. Уэслейка, «Убик» Филипа Дика
// пробелы — без перевода строки: в описании ролика за «…» Гюнтера Грасса следующей строкой идёт «Топ»
const AUTHOR = /^[^\S\n]*([А-ЯЁ][а-яё]+(?:[^\S\n]+[А-ЯЁ]\.)*(?:[^\S\n]+(?:фон|де|ван|дер|ди|да|ле)?[^\S\n]*[А-ЯЁ][а-яё'-]+){1,2})/u;
const QUOTE = /«([^«»\n]{2,80})»/g;
// прямые кавычки: открывающая — перед буквой, закрывающая — после буквы и не перед буквой, иначе
// «"Что круче? "Властелин Колец" Д.Р.Р. Толкина или "Хроники Нарнии"» склеивается не в те пары
const QUOTE_LOOSE = /[«"](?=\S)([^«»"\n]{2,80}?)(?<=\S)[»"](?!\p{L})/gu;
// одна фамилия, можно с инициалами: «Булгакова», «Д.Р.Р.Толкина», «К.С. Льюиса»
// автор перед названием, в именительном: «Эмиль Золя "Западня"», «Стивен Кинг — «Оно»»
const AUTHOR_BEFORE = /(?<!\p{L})([А-ЯЁ][а-яё]+(?:[^\S\n]+[А-ЯЁ]\.)*[^\S\n]+[А-ЯЁ][а-яё'-]+)[^\S\n]*[-–—:]?[^\S\n]*$/u;
const SURNAME = /^[^\S\n]*(?:[А-ЯЁ]\.[^\S\n]*)*([А-ЯЁ][а-яё'-]{2,})(?=[\s,.!?)|:;—–-]|$)/u;

/** Не книги, хотя стоят в кавычках рядом с книжным словом: рубрики, клубы, подкасты. */
const NOT_TITLE = /^(?:книжн\p{L}* клуб\p{L}*|клуб\p{L}*|подкаст\p{L}*)$/iu;

export function bookMentions(text: string, { loose = false } = {}): BookMention[] {
  const out: BookMention[] = [];
  for (const m of text.matchAll(loose ? QUOTE_LOOSE : QUOTE)) {
    const start = m.index ?? 0;
    const before = text.slice(Math.max(0, start - 40), start);
    const afterQ = text.slice(start + m[0].length, start + m[0].length + 60);
    const bookWord = BEFORE.test(before);
    const authorBefore = loose ? AUTHOR_BEFORE.exec(before)?.[1] : undefined;
    if (!bookWord && !(loose && (authorBefore || AUTHOR.exec(afterQ) || SURNAME.exec(afterQ)))) continue;
    // «мой роман», «наш рассказ» — автор канала о своей книге: реклама, а не разговор о книге
    if (/(?:(?<!\p{L})мо(?:й|я|ю|ей|ем|ём)|наш\p{L}*|сво(?:й|я|ю|ей|ем|ём))\s+(?:\p{L}+\s+)?(?:роман|рассказ|книг|повест)\p{L}*\s*$/iu.test(before)) continue;
    const title = m[1].trim().replace(/\s+/g, ' ');
    if (NOT_TITLE.test(title) || /^[\d\s.,:-]+$/.test(title)) continue;
    const after = text.slice(start + m[0].length, start + m[0].length + 60);
    const a = AUTHOR.exec(after)?.[1] ?? authorBefore ?? (loose ? SURNAME.exec(after)?.[1] : undefined);
    out.push({ title, ...(a ? { author: a } : {}), context: text.slice(Math.max(0, start - 60), start + m[0].length + 60).replace(/\s+/g, ' ') });
  }
  return out;
}

/** Ключ для счёта: регистр, ё и пунктуация снимаются. */
export const titleKey = (t: string): string =>
  t.toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** Та же ли фамилия: из текста (в любом падеже, кириллицей) и из Wikidata или Open Library (любым
 *  алфавитом) — по звучанию (`sound`) и общему началу: «Булгакова» и «Bulgakov», «Лема» и «Лем»,
 *  «Гюнтера Грасса» и «Günter Grass». Сравнивается последнее слово. */
export function sameSurname(said: string, full: string): boolean {
  // «Борхес» и «Borges»: испанское g по-русски — х
  const a = sound(said.trim().split(/[\s.]+/).filter(Boolean).pop() ?? '').replace(/g/g, 'h');
  const b = sound(full.trim().split(/\s+/).pop() ?? '').replace(/g/g, 'h');
  if (a.length < 3 || b.length < 3) return false;
  const n = Math.min(Math.max(3, a.length - 2), b.length);
  return a.slice(0, n) === b.slice(0, n);
}

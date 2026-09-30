// Мост с кино в книги (З2), чистая часть: какие книги называют в разговоре о кино. Не всякое
// «название в кавычках» — книга: берём только названное рядом с книжным словом — «по роману «…»»,
// «книга «…»», «экранизация повести «…»», «рассказ «…»». Автора, если он стоит сразу за
// кавычками в родительном («Память» Дональда Уэслейка) — тоже.

export interface BookMention { title: string; author?: string; context: string }

const BEFORE = /(?:по\s+(?:роману|книге|повести|рассказу|мотивам\s+(?:романа|книги|повести|рассказа))|экранизаци\p{L}*\s+(?:романа|книги|повести|рассказа|бестселлера)|(?<!\p{L})(?:роман|романа|романом|книга|книги|книгу|книгой|повесть|повести|повестью|рассказ|рассказа|рассказом|бестселлер\p{L}*)(?:-\p{L}+)?)\s*$/iu;
// родительный имени сразу за кавычками: «Память» Дональда Э. Уэслейка, «Убик» Филипа Дика
const AUTHOR = /^\s*([А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ]\.)*(?:\s+(?:фон|де|ван|дер|ди|да|ле)?\s*[А-ЯЁ][а-яё'-]+){1,2})/u;
const QUOTE = /«([^«»\n]{2,80})»/g;

/** Не книги, хотя стоят в кавычках рядом с книжным словом: рубрики, клубы, подкасты. */
const NOT_TITLE = /^(?:книжн\p{L}* клуб\p{L}*|клуб\p{L}*|подкаст\p{L}*)$/iu;

export function bookMentions(text: string): BookMention[] {
  const out: BookMention[] = [];
  for (const m of text.matchAll(QUOTE)) {
    const start = m.index ?? 0;
    const before = text.slice(Math.max(0, start - 40), start);
    if (!BEFORE.test(before)) continue;
    // «мой роман», «наш рассказ» — автор канала о своей книге: реклама, а не разговор о книге
    if (/(?:(?<!\p{L})мо(?:й|я|ю|ей|ем|ём)|наш\p{L}*|сво(?:й|я|ю|ей|ем|ём))\s+(?:\p{L}+\s+)?(?:роман|рассказ|книг|повест)\p{L}*\s*$/iu.test(before)) continue;
    const title = m[1].trim().replace(/\s+/g, ' ');
    if (NOT_TITLE.test(title) || /^[\d\s.,:-]+$/.test(title)) continue;
    const after = text.slice(start + m[0].length, start + m[0].length + 60);
    const a = AUTHOR.exec(after)?.[1];
    out.push({ title, ...(a ? { author: a } : {}), context: text.slice(Math.max(0, start - 60), start + m[0].length + 60).replace(/\s+/g, ' ') });
  }
  return out;
}

/** Ключ для счёта: регистр, ё и пунктуация снимаются. */
export const titleKey = (t: string): string =>
  t.toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

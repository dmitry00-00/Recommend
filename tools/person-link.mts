// Ссылка на страницу человека для сотрудничества (24.10, слово владельца): режиссёр, сценарист, писатель публикует у
// себя ссылку на свою страницу в приложении — работы, разборы о них и его канал. Печатает
// `https://t.me/<бот>?startapp=p-<Q>--s<метка>` и что сейчас на странице — чтобы не отдать ссылку на пустую.
// Лёгкий, по образцу tools/author-link.mts: без vite, только чтение src/mocks.
//   npx tsx tools/person-link.mts <Q | имя> [--label tg_<канал>_p]
// Имя — подстрока имени в справочнике людей (регистр не важен); несколько совпадений — список, ссылки нет.
// Метка — [a-z0-9_]{1,24}, по умолчанию tg_<канал>_p (канал из src/mocks/personChannels.ts), без канала — p_<q>;
// её запишет сервер в user.source (worker/invite.ts). Страница за флагом `personChannel` или `pages` (src/lib/flags.ts).
// Счёт — по ключам src/mocks/workCredits.ts: приложение сводит ещё и двойные ключи вещи (tmdb/imdb), отсеивает
// «про другое» и обзоры — на странице может быть чуть иначе.
import { readFileSync } from 'node:fs';
import { people, workCredits } from './credits-all.mts';
import { personChannels } from '../src/mocks/personChannels.ts';

const BOT = process.env.VITE_BOT_USERNAME || 'recomend_media_bot';
const args = process.argv.slice(2);
const at = args.indexOf('--label');
const label = at >= 0 ? args[at + 1] : undefined;
const raw = args.filter((a, i) => !a.startsWith('--') && (at < 0 || i !== at + 1)).join(' ').trim();
if (!raw) { console.error('нужен человек: npx tsx tools/person-link.mts <Q | имя> [--label tg_<канал>_p]'); process.exit(1); }

let q = /^Q\d+$/i.test(raw) ? raw.toUpperCase() : undefined;
if (!q) {
  const low = raw.toLocaleLowerCase('ru');
  const found = Object.entries(people).filter(([, p]) => [p.name, p.originalName].some((n) => n?.toLocaleLowerCase('ru').includes(low)));
  if (!found.length) { console.error(`в справочнике людей нет «${raw}»`); process.exit(1); }
  if (found.length > 1) {
    console.error(`совпадений ${found.length} — уточните или дайте Q:`);
    for (const [id, p] of found.slice(0, 20)) console.error(`  ${id} ${p.name}${p.originalName ? ` (${p.originalName})` : ''}${personChannels[id] ? ` · @${personChannels[id].h}` : ''}`);
    process.exit(1);
  }
  q = found[0][0];
}
const ch = personChannels[q];
const tag = (label ?? (ch ? `tg_${ch.h.toLowerCase()}_p` : `p_${q.toLowerCase()}`)).slice(0, 24);
if (!/^[a-z0-9_]{1,24}$/.test(tag)) { console.error(`метка — только [a-z0-9_], до 24 знаков: ${tag}`); process.exit(1); }
const param = `p-${q}--s${tag}`;
if (param.length > 64) { console.error(`параметр длиннее 64 знаков, Telegram не примет: ${param}`); process.exit(1); }

// его работы — ключи, где он в титрах; разборы о них — те же три источника, что у страницы (getPerson)
const keys = Object.entries(workCredits).filter(([, line]) => line.split(',').some((x) => x.split(':')[0] === q)).map(([k]) => k);
type A = { id: string; url: string; tier?: string };
const load = (file: string): Record<string, A[]> => {
  const text = readFileSync(new URL(`../src/mocks/${file}`, import.meta.url), 'utf8');
  return JSON.parse(text.slice(text.indexOf('= {') + 2, text.lastIndexOf('}') + 1));
};
const analyses = new Set<string>();
const own = new Set<string>();
const prefix = ch ? `tg-${ch.h.toLowerCase()}-` : undefined;
for (const file of ['essays.ts', 'essaysAuto.ts', 'postsAuto.ts']) {
  const src = load(file);
  for (const k of keys) for (const a of src[k] ?? []) {
    if (prefix && a.id.toLowerCase().startsWith(prefix)) own.add(a.url);
    else if (a.tier !== 'review') analyses.add(a.url);
  }
}

console.log(`https://t.me/${BOT}?startapp=${param}`);
console.log(`человек: ${people[q]?.name ?? 'нет в справочнике людей'} (${q})`);
console.log(`работ: ${keys.length}, разборов о них: ${analyses.size}`);
console.log(ch ? `канал: @${ch.h}${ch.t ? ` (${ch.t})` : ''}${ch.known ? '' : ' — нет в наших выемках: канал ли это, не проверено'}, его постов о своих работах: ${own.size}`
  : 'канала нет (Wikidata P3789 и разметка каналов): блок «Канал автора» не появится');
if (!people[q] || !keys.length) console.log('страница покажет «Такого автора нет» — давать ссылку рано');

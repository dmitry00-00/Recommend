// Ось «О чём — чего хочет герой» для наклона ленты (19.10, панель ленты v2): желания героев (src/mocks/desires/NN.json —
// черновики агентов, свободный текст «хочет вслух» и «на самом деле») раскладываются по десятку видов желания словами-
// основами (regex по основам + сторожа, без морфологии — как сопоставление названий). Смотрим только главного героя
// (первого в записи): желание злодея или второго плана — не «о чём» фильм. «На самом деле» — только у вины и признания:
// там подавленное желание и есть сюжет; у остальных оно чаще про другое и только шумит.
// Пишет src/mocks/desireAxis.ts — ключи произведений по видам, строкой через пробел (лениво, только наклону).
//   npx tsx tools/build-desire-axis.mts [--sample <вид>]
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

type Tuple = [string, string, string, number, number, string];
type Kind = 'home' | 'redeem' | 'escape' | 'fame' | 'protect' | 'truth' | 'revenge' | 'love' | 'survive' | 'power';

// в JS \w и \b не знают кириллицы — границы слова явно
const B = '(?:^|[^а-яё])';
const E = '(?:[^а-яё]|$)';
const RULES: Record<Kind, RegExp> = {
  home: new RegExp(`домой|на родину|(?:вернуть(?:ся)?|возвра[а-яё]*|добраться|доехать|попасть)\\s+(?:[^\\s]+\\s+){0,2}(?:в\\s+)?(?:дом${E}|отчий|родн(?:ой|ую|ые|ое) (?:дом|деревн|город|кра))`, 'i'),
  redeem: new RegExp(`искуп|загладить|${B}вин[уыа]${E}|прощени|покаят|покаян|исправить (?:ошиб|содея|прошл)`, 'i'),
  escape: /вырват|вырвать|сбежать|бежать из|выбраться из|освободит[а-яё]* от|на свобод|уйти из|уехать из|из-под/i,
  fame: new RegExp(`признани|прослав|знаменит|стать (?:лучш|велик|звезд|перв|чемпион)|${B}слав[аыуе]${E}|карьер|доказать (?:всем|отцу|матери|себе|миру)`, 'i'),
  protect: /уберечь|защит|сберечь|спасти (?:сем|сын|доч|брат|сестр|дет|жен|муж|мат|отц|друз|близк|свои)|прокормить|оберега/i,
  truth: /правд|раскрыть|расследов|выяснить|разгадать|докопаться|узнать,? (?:кто|что|почему|правду|тайну)|(?:найти|поймать|вычислить|выследить) (?:убийц|маньяк|преступ|виновн)/i,
  revenge: /отомст|месть|мести|поквитаться|расплатиться с/i,
  love: new RegExp(`(?:быть|остаться|жить) вместе|жениться|выйти замуж|завоевать (?:сердце|любов|её|его)|добиться (?:её|его|любв|руки|взаимн)|${B}любов|взаимн`, 'i'),
  survive: /выжить|уцелеть|спастись|остаться в живых|выбраться живым/i,
  power: /власт|захватить|разбогатеть|богатств|миллион|подчинить|господств|трон/i,
};
// сторожа: «не возвращаться домой» — не о возвращении
const GUARD: Partial<Record<Kind, RegExp>> = {
  home: /не возвращ|не вернуть/i,
  love: /любовь (?:к|отца|матери|родител|зрител|публик)|любовни/i,
};
// «быть с Еленой», «завоевать Лану» — по заглавной букве имени, поэтому без флага i
const NAMED: Partial<Record<Kind, RegExp>> = {
  love: /(?:^|[^а-яё])(?:[Бб]ыть|[Оо]статься|[Жж]ить) с [А-ЯЁ]|[Зз]авоевать [А-ЯЁ]|[Дд]обиться [А-ЯЁ]/,
};
const DEEP = new Set<Kind>(['redeem', 'fame']);

const dir = new URL('../src/mocks/desires/', import.meta.url);
const byKind = new Map<Kind, string[]>();
let works = 0;
let tagged = 0;
const samples: string[] = [];
const want = process.argv.includes('--sample') ? process.argv[process.argv.indexOf('--sample') + 1] as Kind : undefined;
for (const f of readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
  const shard = JSON.parse(readFileSync(new URL(f, dir), 'utf8')) as Record<string, { m: string; c: Tuple[] }>;
  for (const [key, r] of Object.entries(shard)) {
    works += 1;
    const hero = r.c[0];
    if (!hero) continue;
    let any = false;
    for (const kind of Object.keys(RULES) as Kind[]) {
      const text = DEEP.has(kind) ? `${hero[1]} | ${hero[2]}` : hero[1];
      if (!(RULES[kind].test(text) || NAMED[kind]?.test(text)) || GUARD[kind]?.test(text)) continue;
      (byKind.get(kind) ?? byKind.set(kind, []).get(kind)!).push(key);
      any = true;
      if (kind === want) samples.push(text);
    }
    if (any) tagged += 1;
  }
}

const out = [...byKind].sort(([a], [b]) => a.localeCompare(b)).map(([k, keys]) => `  ${k}: '${keys.sort().join(' ')}',`).join('\n');
writeFileSync(new URL('../src/mocks/desireAxis.ts', import.meta.url),
  `// Сгенерировано tools/build-desire-axis.mts (${new Date().toISOString().slice(0, 10)}): ключи произведений по виду желания главного\n` +
  `// героя — ось «О чём» в наклоне ленты. Не править руками — перегенерировать.\n` +
  `export const desireAxis: Record<string, string> = {\n${out}\n};\n`);
console.log(`желаний: ${works} произведений, с видом: ${tagged}`);
for (const [k, keys] of byKind) console.log(`  ${k.padEnd(8)} ${keys.length}`);
if (want) for (let i = 0; i < 30 && samples.length; i++) console.log('   ', samples[Math.floor(Math.random() * samples.length)]);

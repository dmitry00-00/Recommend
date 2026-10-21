// Проверка отсева перед сопоставлением названий (19.10, скорость индексов разборов; tools/title-match.mts):
//   1. свёртка CANON склеивает не меньше, чем флаг `iu`: для каждого символа, который основа берёт в обязательное
//      начало (literalChar, и `[её]`), всё, что выражение с `iu` считает им же, — та же буква свёртки. На этом стоит
//      «нет начала в тексте — выражение не совпадёт»;
//   2. обязательное начало (mandatoryPrefix) — на придуманных основах: склонение, «,?», многоточие, «ё»;
//   3. на настоящих названиях справочника и заголовках из индексов (essaysAuto, postsAuto) и придуманных строках с
//      «K» Кельвина, «ſ», старой кириллицей: где выражение совпало — начало в тексте есть, произведение — в отборе
//      nameIndex, и nameMatchAt отвечает так же, как без отсева (выражение напрямую, тем же текстом).
// Без сети.
//
//   npx tsx tools/title-match-test.mts
import assert from 'node:assert/strict';
import { canonText, literalChar, literalOf, mandatoryPrefix, nameIndex, nameMatchAt, stemOf, tailOf } from './title-match.mts';
import { worksIndex } from './works-index.mts';
import { essaysAuto } from '../src/mocks/essaysAuto.ts';
import { postsAuto } from '../src/mocks/postsAuto.ts';
import { loreHits, loreNames } from './lore.mts';

// ─── 1. свёртка против флага `iu` ───────────────────────────────────────────────────────────────────────────────
{
  const all: string[] = [];
  for (let c = 0; c < 0x10000; c++) if (c < 0xd800 || c > 0xdfff) all.push(String.fromCharCode(c));
  const ALL = all.join('');
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const lits: string[] = [];
  for (let c = 0; c < 0x500; c++) if (literalChar(String.fromCharCode(c))) lits.push(String.fromCharCode(c));
  let pairs = 0;
  for (const [src, as] of [...lits.map((l) => [esc(l), l]), ['[её]', 'е']] as [string, string][]) {
    for (const m of ALL.matchAll(new RegExp(src, 'giu'))) {
      pairs += 1;
      assert.equal(canonText(m[0]), canonText(as), `свёртка: ${JSON.stringify(m[0])} (U+${m[0].charCodeAt(0).toString(16)}) ~ ${JSON.stringify(as)}`);
    }
  }
  assert.ok(pairs > lits.length, 'есть пары по регистру');
  assert.equal(canonText('ЁёЕе'), 'ееее');
  assert.equal(canonText('Kſᲀ'), 'ksв');
}

// ─── 2. обязательное начало ─────────────────────────────────────────────────────────────────────────────────────
{
  const lit = (name: string) => mandatoryPrefix(stemOf(name));
  assert.equal(lit('Игра престолов'), 'Игр');
  assert.equal(lit('Прибытие'), 'Прибыти');
  assert.equal(lit('Я, робот'), 'Я');
  assert.equal(lit('Однажды в… Голливуде'), 'Однажды в');
  assert.equal(lit('Тёмный рыцарь'), 'Темный рыцарь');
  assert.equal(lit('Помнить'), 'Помнить');
  assert.equal(lit('The Batman'), 'The Batman');
  assert.equal(lit('Мистер и миссис Смит: новое'), 'Мистер и миссис Смит');
  assert.equal(lit('«Ви»'), '');
  assert.equal(lit('Ἀγαμέμνων'), '');
  assert.equal(literalOf('Тёмный рыцарь'), 'темный рыцарь');
}

// ─── 3. отсев против выражения напрямую ─────────────────────────────────────────────────────────────────────────
{
  const CYR = 'А-Яа-яЁёЇїІіЄєҐґ';
  const direct = (text: string, name: string) => new RegExp(`(^|[\\s|:.,"«»(\\-—/])(${stemOf(name)})(${tailOf(name)})(?![A-Za-z0-9_${CYR}])(?!-\\p{L})()`, 'giu').test(text);
  const works = worksIndex({ all: true });
  const titles = [...new Set([...Object.values(essaysAuto), ...Object.values(postsAuto)].flat().map((a) => a.title))];
  // каждый 150-й — чтобы проверка шла минуту, а не час; плюс придуманные строки с особыми символами регистра
  const sample = [...titles.filter((_, i) => i % 150 === 0),
    'Обзор фильма \u212aИНГ КОНГ', 'Разбор «Ведьмака»', 'ТЁМНЫЙ РЫЦАРЬ — смысл', 'темный рыцарь', 'ſhrek review', 'Ⅿатрица'];
  const index = nameIndex(works, (w) => [...w.names, ...(w.bookNames ?? [])]);
  const fold = (x: string) => x.toLowerCase().replace(/ё/g, 'е');
  let hits = 0, checked = 0;
  const broken = new Set<string>();
  for (const text of sample) {
    const picked = new Set(index(text));
    const ct = canonText(text);
    for (const w of works) {
      for (const n of [...w.names, ...(w.bookNames ?? [])]) {
        // прежний отсев nameMatchAt (три первые буквы где-то в тексте): что он не пропускал, выражения не видело и раньше
        const p = fold(n.trim()).slice(0, 3);
        if (/^[\p{L}\p{N}]{3}$/u.test(p) && !fold(text).includes(p)) continue;
        checked += 1;
        let ok: boolean;
        // выражение, которое не строится («Гукансё»: основа режет «[её]» пополам) — без отсева, падает как раньше
        try { ok = direct(text, n); } catch { assert.equal(literalOf(n), ''); assert.ok(picked.has(w)); broken.add(n); continue; }
        if (!ok) continue;
        hits += 1;
        const lit = literalOf(n);
        assert.ok(!lit || ct.includes(lit), `начало «${lit}» названия «${n}» не нашлось в «${text}»`);
        assert.ok(picked.has(w), `«${n}» не в отборе для «${text}»`);
      }
    }
  }
  assert.ok(hits > sample.length / 2, `совпадений мало: ${hits}`);
  assert.ok(nameMatchAt('Разбор фильма «Тёмный рыцарь»', 'Тёмный рыцарь'));
  // имена героев (tools/lore.mts) — тот же отбор: ответ loreHits тот же, что перебором всех выражений
  const names = loreNames();
  const slow = (text: string) => { const t = text.replace(/ё/g, 'е').replace(/Ё/g, 'Е'); const seen = new Set<string>(); return names.filter((n) => n.re.test(t) && !seen.has(n.who) && (seen.add(n.who), true)); };
  let heroes = 0;
  for (const text of [...titles.filter((_, i) => i % 10 === 0), 'Тирион Ланнистер: путь героя', 'Daemon Targaryen explained', 'ДЕЙМОН ТАРГАРИЕН']) {
    const want = slow(text);
    heroes += want.length;
    assert.deepEqual(loreHits(text).map((n) => n.name), want.map((n) => n.name), `герои в «${text}»`);
  }
  assert.ok(heroes > 0, 'герои нашлись');
  console.error(`отсев: проверено ${checked} пар, совпадений выражения ${hits} — все в отборе; не строится выражений: ${broken.size}`);
}
console.error('title-match-test: ok');

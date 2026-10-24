// Автоимпорт скачанного помощником-закладкой (22.10): профиль собран (метка .done в его папке) — история сама
// собирается в seeds/<имя>.json тем же разбором, что импорт с пульта (tools/import-kinopoisk.mts). Повторно — только
// если страницы свежее истории (помощник докачал). Оценки скрыты, отложенные и недокачанные — мимо.
// Имя истории — как у адресата (tools/addressees.mts): kp_<профиль>, или явное из присланного владельцем.
//   npx tsx tools/kinopoisk-autoimport.mts           — один проход
//   npx tsx tools/kinopoisk-autoimport.mts --watch   — проход раз в минуту, пока не остановят
// Заодно (23.10) — находки шлюза в Telegram (tools/kp-profiles.mts → syncFound): новые профили Кинопоиска встают в очередь
// помощника, Letterboxd — собирается сразу.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { addressees, helperNewest, helperState, HELPER_DIR, kpSeed, seedStats } from './addressees.mts';
import { syncFound } from './kp-profiles.mts';

const WATCH = process.argv.includes('--watch');

function pass(): number {
  // находки шлюза (23.10): Кинопоиск — в очередь помощника, Letterboxd — первый сбор истории
  try {
    const f = syncFound();
    if (f && (f.kp.length || f.letterboxd.length || f.failed.length)) console.log(`${new Date().toTimeString().slice(0, 8)} находки шлюза: в очередь Кинопоиска ${f.kp.length}${f.kp.length ? ` (${f.kp.join(', ')})` : ''}, Letterboxd собрано ${f.letterboxd.length}${f.failed.length ? `, не собралось ${f.failed.join(', ')}` : ''}`);
  } catch (err) { console.log(`находки шлюза: ${(err as Error).message}`); }
  if (!existsSync(HELPER_DIR)) return 0;
  // первое имя выигрывает (24.10, ревью п. 6): addressees() идёт от присланного владельцем (addressees-extra, явное имя)
  // к очереди и находкам (kp_<профиль>); Map из списка брал бы последнее — и собирал бы двойника под kp_<профиль>
  const seedOf = new Map<string, string>();
  for (const a of addressees()) if (a.kp && !seedOf.has(a.kp.toLowerCase())) seedOf.set(a.kp.toLowerCase(), a.seed);
  let n = 0;
  for (const kp of readdirSync(HELPER_DIR)) {
    if (helperState(kp).state !== 'собран') continue;
    const seed = seedOf.get(kp.toLowerCase()) ?? kpSeed(kp);
    const have = seedStats(seed);
    if (have && have.mtime >= helperNewest(kp)) continue;
    console.log(`${new Date().toTimeString().slice(0, 8)} ${kp} → seeds/${seed}.json`);
    const r = spawnSync('npx', ['--yes', 'tsx', 'tools/import-kinopoisk.mts', seed, join(HELPER_DIR, kp)], { encoding: 'utf8' });
    const line = `${r.stdout}\n${r.stderr}`.split('\n').find((l) => l.startsWith('→')) ?? `не собралось (код ${r.status})`;
    console.log(`  ${line}`);
    n++;
  }
  return n;
}

pass();
if (WATCH) setInterval(pass, 60e3);

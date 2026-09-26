// Сборщик индексов по расписанию (трек В1). Запускается на машине владельца: там шлюз
// Telegram (~/core/services/tg-gateway), экспорты каналов и сеть. Шаги:
//   1. новые посты каналов из шлюза (tools/telegram-pull.mts);
//   2. раз в неделю — расширение справочника фильмов по Wikidata (tools/expand-film-base.mts):
//      узким местом индекса оказалась база, а не каналы (HANDOFF, 23.09);
//   3. индексы: посты, ролики, кандидаты в источники, соупоминания;
//   4. замер (tools/voices-report.mts) — в .cache/collect/, строкой в history.tsv;
//   5. публикация на сервер (tools/publish-reference.mts) — приложение подхватит без перезаливки.
// Упавший необязательный шаг не останавливает остальные: старые посты лучше, чем никаких.
//   npx tsx tools/collect.mts [--expand] [--no-publish]
// Расписание ставит deploy/install-collect.command (launchd, каждый день в 06:30).
import { spawnSync } from 'node:child_process';
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnvFile } from './env-file.mts';

loadEnvFile();
const DIR = '.cache/collect';
mkdirSync(DIR, { recursive: true });
const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
const log = join(DIR, `${stamp}.log`);
const say = (s: string) => { console.log(s); appendFileSync(log, `${s}\n`); };

function step(name: string, cmd: string, args: string[], { optional = false } = {}): boolean {
  say(`\n── ${name}: ${cmd} ${args.join(' ')}`);
  const t = Date.now();
  // вывод шага пишется в лог сразу, а не по окончании: долгий шаг (Wikidata — полчаса) видно
  // по `tail -f .cache/collect/<время>.log`, и понятно, что он жив
  const fd = openSync(log, 'a');
  const r = spawnSync(cmd, args, { env: process.env, stdio: ['ignore', fd, fd] });
  closeSync(fd);
  const ok = r.status === 0;
  say(`   ${ok ? 'готово' : `ОШИБКА (код ${r.status ?? r.error?.message})`} за ${Math.round((Date.now() - t) / 1000)} с`);
  if (!ok && !optional) { say('обязательный шаг упал — дальше не идём'); process.exit(1); }
  return ok;
}

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const tsx = (script: string, ...args: string[]) => [npx, ['--yes', 'tsx', script, ...args]] as const;

// 1. Telegram: посты забирает шлюз (~/core/services/tg-gateway), аккаунтом владеет он один. Шаг
// необязательный: если шлюз лежит, telegram-pull выходит с кодом 2, и индексы строятся по
// тем постам, что уже выкачаны, — старые посты лучше, чем никаких.
step('посты каналов', ...tsx('tools/telegram-pull.mts'), { optional: true });

// 2. Справочник фильмов — раз в неделю или по --expand: это сотни запросов к Wikidata
const expandMark = join(DIR, 'expand.last');
const weekOld = !existsSync(expandMark) || Date.now() - statSync(expandMark).mtimeMs > 7 * 86400e3;
if (process.argv.includes('--expand') || weekOld) {
  if (step('справочник фильмов (Wikidata)', ...tsx('tools/expand-film-base.mts', '--min', '2'), { optional: true })) writeFileSync(expandMark, new Date().toISOString());
}

// 3. Индексы
step('разборы в постах', ...tsx('tools/build-telegram-index.mts'));
if (process.env.YT_API_KEY) step('разборы-ролики', ...tsx('tools/build-essay-index.mts'), { optional: true });
else say('── разборы-ролики: нет YT_API_KEY — пропускаем');
step('кандидаты в источники', ...tsx('tools/build-source-index.mts'), { optional: true });
step('соупоминания', ...tsx('tools/build-comention-index.mts'), { optional: true });

// 4. Замер
const report = spawnSync(npx, ['--yes', 'tsx', 'tools/voices-report.mts'], { encoding: 'utf8', env: process.env });
if (report.status === 0) {
  writeFileSync(join(DIR, `voices-${stamp.slice(0, 10)}.md`), report.stdout);
  const works = /Фильмов с материалом: \*\*(\d+)\*\*/.exec(report.stdout)?.[1];
  const unver = /не подтверждено: \*\*(\d+) \((\d+)%\)/.exec(report.stdout);
  const hist = join(DIR, 'history.tsv');
  if (!existsSync(hist)) writeFileSync(hist, 'дата\tфильмов\tне подтверждено\tдоля\n');
  appendFileSync(hist, `${stamp}\t${works ?? ''}\t${unver?.[1] ?? ''}\t${unver?.[2] ?? ''}%\n`);
  say(`\nзамер: фильмов с материалом ${works}, не подтверждено ${unver?.[1]} (${unver?.[2]}%)`);
  say(readFileSync(hist, 'utf8').trim().split('\n').slice(-5).join('\n'));
}

// 5. Публикация
if (!process.argv.includes('--no-publish')) step('публикация на сервер', ...tsx('tools/publish-reference.mts'), { optional: true });
say(`\nлог: ${log}`);

// Сборщик индексов по расписанию (трек В1). Запускается на машине владельца: там шлюз
// Telegram (~/core/services/tg-gateway), экспорты каналов и сеть. Шаги:
//   1. новые посты каналов из шлюза (tools/telegram-pull.mts);
//   2. раз в неделю — расширение справочника фильмов по Wikidata (tools/expand-film-base.mts):
//      узким местом индекса оказалась база, а не каналы (HANDOFF, 23.09);
//   3. индексы: посты, ролики, кандидаты в источники, соупоминания;
//   4. замер (tools/voices-report.mts) — в .cache/collect/, строкой в history.tsv;
//      контрольные числа против прошлого снимка (tools/collect-metrics.mts) — предупреждения в лог;
//   5. публикация на сервер (tools/publish-reference.mts) — приложение подхватит без перезаливки.
// С 06.10 — реестр из базы приложения и ссылки из формы Google в самом начале (registry-lib pull, inbox take),
// решения владельца с телефона (tools/owner-pull.mts) и очередь для телефона в
// конце (tools/owner-queue.mts): экран «Разметка» в приложении. С 06.10 последним — копия базы участников
// с сервера на Mac (tools/db-backup.mts pull, ~/recomend-backups/db).
// После индексов (02.10) — разметка моделью (tools/llm-label.mts, не больше 300 штук и 20 минут:
// локальная модель общая с recruit), с 07.10 — рубрики новых роликов (tools/llm-lens.mts --new, полчаса)
// и замер на ручной разметке (tools/markup-eval.mts). Долгим шагам — предел по времени (`minutes`).
// Каждый шаг оставляет отметку в .cache/pipeline/state.json — её показывает панель «Конвейер»
// во вкладке «Проверка» пульта (tools/check-desk.mts).
// Упавший необязательный шаг не останавливает остальные: старые посты лучше, чем никаких.
//   npx tsx tools/collect.mts [--expand] [--no-publish]
// Расписание ставит deploy/install-collect.command (launchd, каждый день в 06:30).
import { spawnSync } from 'node:child_process';
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnvFile } from './env-file.mts';
import { markStage } from './pipeline.mts';

loadEnvFile();
const DIR = '.cache/collect';
mkdirSync(DIR, { recursive: true });
const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
const log = join(DIR, `${stamp}.log`);
const say = (s: string) => { console.log(s); appendFileSync(log, `${s}\n`); };

// предел по времени (07.10): «разборы в постах» шли больше трёх часов на 100% ядра, и обязательный шаг держал
// весь сбор — индекс роликов, публикацию, копию базы. Шаг, вышедший за предел, снимается и считается упавшим.
function step(name: string, cmd: string, args: string[], { optional = false, mark, minutes }: { optional?: boolean; mark?: string; minutes?: number } = {}): boolean {
  say(`\n── ${name}: ${cmd} ${args.join(' ')}${minutes ? ` (предел ${minutes} мин)` : ''}`);
  const t = Date.now();
  const startedAt = new Date().toISOString();
  // вывод шага пишется в лог сразу, а не по окончании: долгий шаг (Wikidata — полчаса) видно
  // по `tail -f .cache/collect/<время>.log`, и понятно, что он жив
  const fd = openSync(log, 'a');
  const r = spawnSync(cmd, args, { env: process.env, stdio: ['ignore', fd, fd], ...(minutes ? { timeout: minutes * 60e3, killSignal: 'SIGKILL' as const } : {}) });
  closeSync(fd);
  const ok = r.status === 0;
  const late = minutes && r.signal === 'SIGKILL' && Date.now() - t >= minutes * 60e3 - 1000;
  say(`   ${ok ? 'готово' : late ? `ПРЕДЕЛ ВРЕМЕНИ (${minutes} мин) — шаг снят` : `ОШИБКА (код ${r.status ?? r.signal ?? r.error?.message})`} за ${Math.round((Date.now() - t) / 1000)} с`);
  if (mark) {
    // последняя строка шага — итог для панели (её и печатают шаги последней)
    const tail = readFileSync(log, 'utf8').trimEnd().split('\n').filter((l) => l.trim() && !l.startsWith('──') && !l.startsWith('   готово') && !l.startsWith('   ОШИБКА')).at(-1);
    markStage(mark, { startedAt, finishedAt: new Date().toISOString(), code: r.status ?? 1, ...(tail ? { summary: tail.slice(0, 300) } : {}), by: 'сборщик' });
  }
  if (!ok && !optional) { say('обязательный шаг упал — дальше не идём'); process.exit(1); }
  return ok;
}

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const tsx = (script: string, ...args: string[]) => [npx, ['--yes', 'tsx', script, ...args]] as const;

// 1. Telegram: посты забирает шлюз (~/core/services/tg-gateway), аккаунтом владеет он один. Шаг
// необязательный: если шлюз лежит, telegram-pull выходит с кодом 2, и индексы строятся по
// тем постам, что уже выкачаны, — старые посты лучше, чем никаких.
// реестр (06.10) — в базе приложения: снимок в файлы до всего остального (tools/registry-lib.mts). Сервер не
// ответил — сбор идёт по прошлому снимку; ссылки из формы Google — во входящие базы (форма чистится в 16:00)
if (process.env.REGISTRY_MODE === 'server') {
  step('реестр с сервера', ...tsx('tools/registry-lib.mts', 'pull'), { optional: true });
  step('ссылки из формы', ...tsx('tools/inbox.mts', 'take'), { optional: true });
}
// решения владельца с телефона (экран «Разметка», 06.10) — до индексов: сборка их уже учтёт
if (process.env.TM_ADMIN_TOKEN) step('решения с телефона', ...tsx('tools/owner-pull.mts'), { optional: true });
step('посты каналов', ...tsx('tools/telegram-pull.mts'), { optional: true, mark: 'tg' });
// у каких каналов включены комментарии — для кнопки «Обсуждение» у поста (ТВ-5б)
step('комментарии каналов', ...tsx('tools/telegram-comments.mts'), { optional: true });

// 2. Справочник фильмов — раз в неделю или по --expand: это сотни запросов к Wikidata
const expandMark = join(DIR, 'expand.last');
const weekOld = !existsSync(expandMark) || Date.now() - statSync(expandMark).mtimeMs > 7 * 86400e3;
if (process.argv.includes('--expand') || weekOld) {
  if (step('справочник фильмов (Wikidata)', ...tsx('tools/expand-film-base.mts', '--min', '2'), { optional: true })) writeFileSync(expandMark, new Date().toISOString());
}

// 3. Индексы. Сначала — названия-ловушки по свежему корпусу: с новыми постами и каналами меняется,
// что здесь повседневная фраза (01.10: «Главный герой»); без них индексы работают как раньше
step('названия-ловушки', ...tsx('tools/build-ordinary.mts'), { optional: true });
// профиль канала (02.10): о каких вселенных и людях канал — по прошлому индексу и решениям людей
// плейлисты каналов (02.10): их названия — подпись автора к роликам; квота — не больше 1500 запросов
if (process.env.YT_API_KEY) step('плейлисты каналов', ...tsx('tools/youtube-playlists.mts', '--max-calls', '1500'), { optional: true });
step('профили каналов', ...tsx('tools/channel-profile.mts'), { optional: true });
// точность по каналу и способу (02.10): надёжным каналам индекс верит без человека, слабым — нет
step('точность по каналам', ...tsx('tools/link-precision.mts'), { optional: true });
// не обязательный с 07.10: завис — индексы идут по вчерашним постам (postsAuto.ts остаётся прежним)
step('разборы в постах', ...tsx('tools/build-telegram-index.mts'), { optional: true, minutes: 40 });
// лица героев (02.10): Wikidata P18, затем актёр в роли по TMDB — составы кешируются, повтор дешёвый
step('лица героев', ...tsx('tools/character-images.mts'), { optional: true });
if (process.env.YT_API_KEY) step('разборы-ролики', ...tsx('tools/build-essay-index.mts'), { optional: true, mark: 'index', minutes: 60 });
else say('── разборы-ролики: нет YT_API_KEY — пропускаем');
step('кандидаты в источники', ...tsx('tools/build-source-index.mts'), { optional: true });
step('соупоминания', ...tsx('tools/build-comention-index.mts'), { optional: true });
// разметка моделью через llm-gateway основы: шлюз лежит — код 2, шаг пропущен, остальное идёт
// модель — LLM_LABEL_MODEL, по умолчанию qwen (с 07.10, как у рубрик)
step('разметка моделью', ...tsx('tools/llm-label.mts', '--limit', '300', '--minutes', '20', '--model', process.env.LLM_LABEL_MODEL ?? 'qwen'), { optional: true, mark: 'llm' });
// рубрики новых роликов (ЗП-2, 07.10): без этого шага ролики свежих каналов приходят в карточку без полки.
// Только неразмеченные, полчаса; модель — LENS_MODEL (по умолчанию qwen: LM Studio бывает выключен)
step('рубрики роликов', ...tsx('tools/llm-lens.mts', '--new', '--minutes', '30', '--model', process.env.LENS_MODEL ?? 'qwen'), { optional: true, minutes: 40 });
step('рубрики каналов', ...tsx('tools/rubrics.mts'), { optional: true });
step('кандидаты в стоп-слова', ...tsx('tools/stopwords.mts'), { optional: true });
step('замер на ручной разметке', ...tsx('tools/markup-eval.mts'), { optional: true, mark: 'eval' });

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

// 4б. Контрольные замеры (tools/collect-metrics.mts): два десятка чисел против вчерашнего снимка
// (.cache/collect-metrics.json) — чтобы тихая потеря (шаг отработал «успешно», но отдал меньше:
// Wikidata с 429, выпавший канал, ручные привязки мимо индекса — всё это было 29.09) была видна
// в этом логе в то же утро. Стоит до публикации, после всех шагов: меряет ровно то, что сейчас
// уедет на сервер, и предупреждение оказывается в логе раньше строки о публикации. Публикацию
// не держит — без --strict замер всегда выходит с кодом 0, и ночной прогон не ломается; если
// понадобится стоп-кран, код выхода `--strict` здесь и есть готовое условие.
const metrics = spawnSync(npx, ['--yes', 'tsx', 'tools/collect-metrics.mts'], { encoding: 'utf8', env: process.env });
say(`\n── контрольные замеры\n${(metrics.stdout ?? '').trimEnd()}`);
if (metrics.status !== 0) say(`   замер не отработал (код ${metrics.status ?? metrics.error?.message}): ${(metrics.stderr ?? '').trim().slice(-400)}`);
const warned = /ПРЕДУПРЕЖДЕНИЯ \((\d+)\)/.exec(metrics.stdout ?? '')?.[1];
if (warned) say(`ВНИМАНИЕ: контрольные замеры — ${warned} предупр., см. выше`);

// 5. Публикация
// сезоны сериалов (ЗП-17, 07.10): идущие — каждую ночь, закончившиеся — раз в месяц; публикуются со справочниками
step('сезоны сериалов', ...tsx('tools/series-seasons.mts'), { optional: true, minutes: 20 });
// английские названия новых карточек (ЗП-20, 08.10): из кэша, в TMDb — только новые; в сборку попадут при следующем деплое
step('английские названия', ...tsx('tools/titles-en.mts'), { optional: true, minutes: 15 });
if (!process.argv.includes('--no-publish')) step('публикация на сервер', ...tsx('tools/publish-reference.mts'), { optional: true, mark: 'publish' });
// свежая очередь разметки для телефона — после всех шагов: в ней уже новые ролики и решения ночи
if (!process.argv.includes('--no-publish')) step('очередь разметки для телефона', ...tsx('tools/owner-queue.mts'), { optional: true });
// копия базы участников — к себе на Mac (ЗП-4, 06.10): ночная копия сервера лежит на его же диске
if (!process.argv.includes('--no-publish')) step('копия базы', ...tsx('tools/db-backup.mts', 'pull'), { optional: true });
say(`\nлог: ${log}`);

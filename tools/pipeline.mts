// Конвейер данных одной панелью (02.10): шаги от сбора каналов до архива для bothost, у каждого —
// отметка «когда шёл, с каким кодом, что сказал» и признак «устарел».
//   npx tsx tools/pipeline.mts                  состояние всех шагов
//   npx tsx tools/pipeline.mts run stale        прогнать устаревшее (сбор, разметка, индекс, замер)
//   npx tsx tools/pipeline.mts run tg yt index  прогнать выбранное по порядку
// Панель — вкладка «Проверка» пульта (tools/check-desk.mts): те же шаги кнопками, лог на странице.
//
// «Устарел» считается как у make — по времени файлов: входы шага новее его выходов (или его
// последнего удачного прогона). Сбор из сети устаревает ещё и по возрасту — раз в сутки. Отметки
// — .cache/pipeline/state.json; их пишет и сборщик по расписанию (tools/collect.mts), так что
// панель видит и ночной прогон. Код 2 у необязательного шага — «пропущен» (шлюз лежит): жёлтый,
// дальше идём. Упал обязательный — цепочка останавливается.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { loadEnvFile } from './env-file.mts';

export const ROOT = fileURLToPath(new URL('../', import.meta.url));
loadEnvFile(join(ROOT, '.env.local'));
const DIR = process.env.TM_PIPELINE_DIR ?? join(ROOT, '.cache/pipeline');
const STATE = join(DIR, 'state.json');
const LOCK = join(DIR, 'run.lock');
const SNAP = join(DIR, 'verdicts-at-index.json');
const NPX = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const DATA = ['src/mocks', 'tools/markup-verdicts.json', 'tools/markup-resolved.json'];

export type Group = 'Сбор и индекс' | 'Разметка' | 'Выкладка';
interface Cmd { argv: string[]; env?: Record<string, string>; optional?: boolean }
export interface Stage {
  id: string; title: string; group: Group; what: string;
  cmds: Cmd[];
  /** упал — цепочка идёт дальше; код 2 — «пропущен» */
  optional?: boolean;
  /** входит в «Обновить устаревшее» */
  auto?: boolean;
  /** перед запуском с панели — вопрос */
  confirm?: string;
  inputs?: string[]; outputs?: string[];
  /** часов до «устарел» без всяких входов: сбор из сети */
  maxAgeH?: number;
  /** чего не хватает, чтобы шаг вообще мог идти */
  needs?: () => string | undefined;
  /** сколько ждёт обработки — дёшево, без сети */
  pending?: (last?: Mark) => { n: number; text: string } | undefined;
}
export interface Mark { startedAt: string; finishedAt: string; code: number; summary?: string; by?: string }

const tsx = (script: string, ...args: string[]): Cmd => ({ argv: [NPX, '--yes', 'tsx', script, ...args] });
const read = <T,>(p: string, d: T): T => { try { return JSON.parse(readFileSync(join(ROOT, p), 'utf8')) as T; } catch { return d; } };
/** отпечаток решения без оглядки на порядок полей: пульт и импорт пишут их в разном порядке */
const hash = (v: object) => createHash('sha1').update(JSON.stringify(Object.entries(v).filter(([k]) => k !== 'at').sort())).digest('hex').slice(0, 12);
type Verdict = { key: string | null; why?: string; film?: string; from?: string };
const verdicts = (): Record<string, Verdict> => {
  try { return (JSON.parse(readFileSync(process.env.TM_VERDICTS ?? join(ROOT, 'tools/markup-verdicts.json'), 'utf8')).videos ?? {}) as Record<string, Verdict>; } catch { return {}; }
};
const lastNumber = (s: string | undefined, re: RegExp) => { const m = s ? re.exec(s) : null; return m ? Number(m[1]) : undefined; };

/** git без замков: `--no-optional-locks` не трогает index.lock — панель спрашивает часто */
function gitDirty(): number | undefined {
  if (process.env.TM_NO_GIT) return undefined;
  const r = spawnSync('git', ['--no-optional-locks', 'status', '--porcelain', '--', ...DATA], { cwd: ROOT, encoding: 'utf8' });
  return r.status === 0 ? r.stdout.split('\n').filter(Boolean).length : undefined;
}

export const STAGES: Stage[] = [
  { id: 'tg', title: 'Посты Telegram', group: 'Сбор и индекс', auto: true, optional: true, maxAgeH: 24,
    what: 'новые посты каналов из tg-gateway основы (:8710) и у каких каналов есть комментарии',
    cmds: [tsx('tools/telegram-pull.mts'), { ...tsx('tools/telegram-comments.mts'), optional: true }], outputs: ['.cache/telegram/gateway.json', 'src/mocks/telegramComments.ts'] },
  { id: 'yt', title: 'Ролики YouTube', group: 'Сбор и индекс', auto: true, optional: true, maxAgeH: 24,
    what: 'новые ролики каналов (только новое, квота — по новым)',
    cmds: [tsx('tools/youtube-dump.mts'), { ...tsx('tools/youtube-playlists.mts'), optional: true }], outputs: ['.cache/youtube/videos.json'],
    needs: () => (process.env.YT_API_KEY ? undefined : 'нет YT_API_KEY в .env.local') },
  { id: 'typed', title: '«Нет у нас»', group: 'Разметка', auto: true, optional: true,
    what: 'вписанные в пультах фильмы, которых нет в справочнике, — опознать (Wikidata) и применить',
    cmds: [tsx('tools/apply-typed.mts')],
    pending: () => {
      const n = Object.values(verdicts()).filter((v) => (v.from === 'desk' || v.from === 'check') && !v.key && v.why === 'нет у нас' && v.film).length;
      return n ? { n, text: `ждут опознания: ${n}` } : undefined;
    } },
  { id: 'index', title: 'Индекс разборов', group: 'Сбор и индекс', auto: true,
    what: 'посты и ролики → фильмы, веса и соупоминания; решения разметки применяются здесь',
    cmds: [{ ...tsx('tools/build-ordinary.mts'), optional: true }, { ...tsx('tools/channel-profile.mts'), optional: true }, { ...tsx('tools/link-precision.mts'), optional: true }, tsx('tools/build-telegram-index.mts'),
      tsx('tools/build-essay-index.mts'), { ...tsx('tools/build-source-index.mts'), optional: true },
      { ...tsx('tools/build-comention-index.mts'), optional: true }],
    // справочник — тоже вход: новые карточки (filmBasePopular 05.10) ждут своих роликов и постов
    inputs: ['.cache/youtube/videos.json', '.cache/telegram/*.json', 'tools/markup-verdicts.json', 'tools/markup-resolved.json', 'tools/stopwords.json',
      'src/mocks/filmBaseWiki.ts', 'src/mocks/filmBaseMarkup.ts', 'src/mocks/filmBasePopular.ts', 'src/mocks/filmBaseWorld.ts'],
    outputs: ['src/mocks/essaysAuto.ts', 'src/mocks/postsAuto.ts', 'src/mocks/essaysAbout.ts'],
    pending: () => {
      let snap: Record<string, string> = {};
      try { snap = JSON.parse(readFileSync(SNAP, 'utf8')) as Record<string, string>; } catch { /* индекс ещё не собирали с отметкой */ }
      const now = verdicts();
      const n = Object.entries(now).filter(([id, v]) => snap[id] !== hash(v)).length + Object.keys(snap).filter((id) => !(id in now)).length;
      return n && Object.keys(snap).length ? { n, text: `решений после сборки: ${n}` } : undefined;
    } },
  { id: 'llm', title: 'Разметка LLM', group: 'Разметка', auto: true, optional: true,
    what: 'вид материала и названные произведения, рубрики роликов (ТВ-3) — моделью через llm-gateway основы (:8711)',
    cmds: [tsx('tools/llm-label.mts', '--limit', '300', '--minutes', '20'), { ...tsx('tools/build-media-mentions.mts'), optional: true },
      { ...tsx('tools/llm-lens.mts', '--limit', '300', '--minutes', '10'), optional: true },
      // просьбы «посоветуйте» (ТВ-12а/б): шлюз ищет их в 00:05 UTC, здесь — разметка новых находок и
      // очередь веток шлюзу (какие разговоры под просьбами забрать завтра)
      { ...tsx('tools/tg-asks.mts', '--minutes', '15'), optional: true }],
    inputs: ['src/mocks/essaysAuto.ts', 'tools/markup-verdicts.json', 'tools/prompts/media-label.md', 'tools/prompts/media-lens.md'],
    outputs: ['.cache/llm/labels.json', 'src/mocks/mediaMentions.ts', 'src/mocks/essayLenses.ts', '.cache/tg-asks/pairs.json'],
    pending: (last) => { const n = lastNumber(last?.summary, /ждут (\d+)/); return n ? { n, text: `ждут разметки: ${n}` } : undefined; } },
  { id: 'eval', title: 'Замер', group: 'Сбор и индекс', auto: true, optional: true,
    what: 'опознаватель и модель на ручной разметке; история — .cache/pipeline/eval.tsv',
    cmds: [{ ...tsx('tools/rubrics.mts'), optional: true }, { ...tsx('tools/stopwords.mts'), optional: true }, { ...tsx('tools/record-weights.mts'), optional: true }, { ...tsx('tools/markup-coverage.mts'), optional: true }, tsx('tools/markup-eval.mts')],
    inputs: ['src/mocks/essaysAuto.ts', 'tools/markup-verdicts.json', '.cache/llm/labels.json'],
    outputs: ['.cache/pipeline/eval.tsv'] },
  // реестр в базе (06.10): таблица разметки больше не источник — только форма ссылок, её забирает inbox.mts
  process.env.REGISTRY_MODE === 'server'
    ? { id: 'sheet', title: 'Форма Google', group: 'Разметка', optional: true,
      what: 'забрать ссылки из формы во входящие базы (разбор — вкладка «Ссылки»); форма чистится сама в 16:00',
      cmds: [tsx('tools/inbox.mts', 'take')],
      inputs: [], outputs: ['.cache/inbox/last.json'],
      needs: () => (process.env.INBOX_SHEET_ID ? undefined : 'нет INBOX_SHEET_ID в .env.local') }
    : { id: 'sheet', title: 'Google-таблица', group: 'Разметка', optional: true,
      what: 'забрать правки людей из таблицы, опознать, пересобрать и залить тем же файлом',
      cmds: [{ argv: ['bash', 'deploy/markup-sync.command'], env: { SKIP_DUMP: '1' } }],
      inputs: ['tools/markup-verdicts.json'], outputs: ['.cache/markup/google.meta.json'],
      needs: () => (process.env.MARKUP_SHEET_ID ? undefined : 'нет MARKUP_SHEET_ID в .env.local') },
  { id: 'publish', title: 'Публикация справочника', group: 'Выкладка', optional: true,
    what: 'свежие разборы и справочник — на сервер; приложение подхватит без перезаливки',
    cmds: [tsx('tools/publish-reference.mts')],
    inputs: ['src/mocks/essaysAuto.ts', 'src/mocks/postsAuto.ts', 'src/mocks/comentions.ts', 'src/mocks/filmBaseWiki.ts', 'src/mocks/filmBaseMarkup.ts', 'src/mocks/filmBasePopular.ts', 'src/mocks/filmBaseWorld.ts'],
    needs: () => (process.env.TM_ADMIN_TOKEN ? undefined : 'нет TM_ADMIN_TOKEN в .env.local') },
  { id: 'commit', title: 'Коммит данных', group: 'Выкладка', optional: true,
    confirm: 'Закоммитить src/mocks и решения разметки и отправить (git push)?',
    what: 'src/mocks и tools/markup-*.json — коммит и push',
    // в песочнице (TM_NO_GIT) git не трогаем вовсе: там замки git не снимаются
    needs: () => (process.env.TM_NO_GIT ? 'git отключён (TM_NO_GIT)' : undefined),
    cmds: [{ argv: ['bash', '-c', `git add -- ${DATA.join(' ')} && { git diff --cached --quiet || git commit -q -m "Данные: пульт $(date +%d.%m)"; } && git push`] }],
    pending: () => { const n = gitDirty(); return n ? { n, text: `не закоммичено файлов: ${n}` } : undefined; } },
  { id: 'build', title: 'Сборка bothost', group: 'Выкладка', optional: true,
    confirm: 'Собрать архив для bothost (deploy/tm-bothost.zip)?',
    what: 'npm run build:bothost → deploy/tm-bothost.zip',
    cmds: [{ argv: ['npm', 'run', 'build:bothost'] }],
    inputs: ['src/', 'index.html', 'package.json', 'server/'], outputs: ['deploy/tm-bothost.zip'] },
];

// ─── отметки ──────────────────────────────────────────────────────────────────
export function readMarks(): Record<string, Mark> {
  try { return (JSON.parse(readFileSync(STATE, 'utf8')).stages ?? {}) as Record<string, Mark>; } catch { return {}; }
}
/** Отметка шага. Пишут панель, CLI и сборщик по расписанию (tools/collect.mts). */
export function markStage(id: string, m: Mark): void {
  mkdirSync(DIR, { recursive: true });
  const all = readMarks();
  all[id] = m;
  writeFileSync(STATE, JSON.stringify({ stages: all }, null, 1));
  // индекс собран — запомнить, какие решения в нём уже учтены
  if (id === 'index' && m.code === 0) writeFileSync(SNAP, JSON.stringify(Object.fromEntries(Object.entries(verdicts()).map(([k, v]) => [k, hash(v)]))));
}

// ─── что устарело ─────────────────────────────────────────────────────────────
function files(p: string): string[] {
  const abs = join(ROOT, p);
  if (p.endsWith('/*.json')) {
    const dir = abs.slice(0, -'/*.json'.length);
    return existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => join(dir, f)) : [];
  }
  if (p.endsWith('/')) {
    const out: string[] = [];
    const walk = (d: string) => { if (!existsSync(d)) return; for (const e of readdirSync(d, { withFileTypes: true })) { if (e.name.startsWith('.') || e.name === 'node_modules') continue; const f = join(d, e.name); if (e.isDirectory()) walk(f); else out.push(f); } };
    walk(abs);
    return out;
  }
  return [abs];
}
const mtime = (f: string) => { try { return statSync(f).mtimeMs; } catch { return 0; } };
const newest = (paths: string[]) => paths.flatMap(files).reduce((best, f) => { const t = mtime(f); return t > best.t ? { t, f } : best; }, { t: 0, f: '' });

export interface StageStatus {
  id: string; title: string; group: Group; what: string; confirm?: string; auto: boolean;
  last?: Mark; lastAt?: string;
  state: 'ok' | 'stale' | 'error' | 'skipped' | 'never' | 'blocked' | 'running';
  why?: string; pending?: { n: number; text: string };
}

export function status(): StageStatus[] {
  const marks = readMarks();
  const now = Date.now();
  return STAGES.map((s) => {
    const last = marks[s.id];
    const out = s.outputs ? newest(s.outputs).t : 0;
    const ran = Math.max(out, last && last.code === 0 ? Date.parse(last.finishedAt) : 0);
    const base: StageStatus = { id: s.id, title: s.title, group: s.group, what: s.what, auto: Boolean(s.auto), state: 'ok',
      ...(s.confirm ? { confirm: s.confirm } : {}), ...(last ? { last } : {}), ...(ran ? { lastAt: new Date(ran).toISOString() } : {}) };
    let pending: StageStatus['pending'];
    try { pending = s.pending?.(last); } catch { pending = undefined; }
    if (pending) base.pending = pending;
    if (run?.current === s.id) return { ...base, state: 'running' };
    const need = s.needs?.();
    if (need) return { ...base, state: 'blocked', why: need };
    if (last && last.code !== 0 && Date.parse(last.finishedAt) >= ran) return { ...base, state: last.code === 2 ? 'skipped' : 'error', why: last.summary };
    if (!ran) {
      if (pending) return { ...base, state: 'stale', why: pending.text };
      // шагу без входов и выходов («нет у нас», коммит) делать нечего, пока ничего не ждёт
      return s.inputs?.length || s.outputs?.length || s.maxAgeH ? { ...base, state: 'never', why: 'ещё не запускался' } : base;
    }
    if (s.maxAgeH && now - ran > s.maxAgeH * 3600e3) return { ...base, state: 'stale', why: `старше ${s.maxAgeH} ч` };
    if (s.inputs) {
      const inp = newest(s.inputs);
      if (inp.t > ran + 1000) return { ...base, state: 'stale', why: `новее: ${inp.f.replace(ROOT, '')}` };
    }
    if (pending) return { ...base, state: 'stale', why: pending.text };
    return base;
  });
}

// ─── прогон ───────────────────────────────────────────────────────────────────
export interface RunState {
  ids: string[]; current?: string; startedAt: string; finishedAt?: string; stopped?: boolean;
  results: { id: string; code: number; s: number; summary?: string }[]; log: string[];
}
let run: RunState | undefined;
let child: ChildProcess | undefined;
const LOG_KEEP = 1500;

export const runState = (): RunState | undefined => run && { ...run, log: run.log.slice(-400) };

function locked(): string | undefined {
  if (!existsSync(LOCK)) return undefined;
  try {
    const l = JSON.parse(readFileSync(LOCK, 'utf8')) as { pid: number; ids: string[] };
    process.kill(l.pid, 0);               // жив ли
    return l.pid === process.pid ? undefined : `уже идёт прогон (pid ${l.pid}: ${l.ids.join(', ')})`;
  } catch { return undefined; }           // процесса нет — замок брошенный
}

/** Какие шаги «Обновить устаревшее» возьмёт сейчас. */
export const staleIds = (): string[] => status().filter((s) => s.auto && (s.state === 'stale' || s.state === 'never' || s.state === 'error' || s.state === 'skipped')).map((s) => s.id);

export function startRun(ids: string[], onLine?: (l: string) => void): Promise<RunState> {
  if (run && !run.finishedAt) throw new Error('прогон уже идёт');
  const lock = locked();
  if (lock) throw new Error(lock);
  const order = STAGES.map((s) => s.id).filter((id) => ids.includes(id));
  if (!order.length) throw new Error('нечего запускать');
  mkdirSync(DIR, { recursive: true });
  writeFileSync(LOCK, JSON.stringify({ pid: process.pid, ids: order, at: new Date().toISOString() }));
  const logFile = join(DIR, `${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.log`);
  const state: RunState = { ids: order, startedAt: new Date().toISOString(), results: [], log: [] };
  run = state;
  const say = (l: string) => {
    state.log.push(l);
    if (state.log.length > LOG_KEEP) state.log.splice(0, state.log.length - LOG_KEEP);
    appendFileSync(logFile, `${l}\n`);
    onLine?.(l);
  };
  const exec = (cmd: Cmd): Promise<{ code: number; out: string[] }> => new Promise((done) => {
    const out: string[] = [];
    say(`$ ${cmd.argv.slice(cmd.argv[0] === NPX ? 3 : 0).join(' ')}`);
    const p = spawn(cmd.argv[0], cmd.argv.slice(1), { cwd: ROOT, env: { ...process.env, ...cmd.env, FORCE_COLOR: '0', NO_COLOR: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
    child = p;
    const lines = (buf: { rest: string }, toOut: boolean) => (chunk: Buffer) => {
      const text = buf.rest + chunk.toString('utf8');
      const parts = text.split(/\r?\n|\r/);
      buf.rest = parts.pop() ?? '';
      for (const l of parts) { if (!l.trim()) continue; say(l); if (toOut) out.push(l); }
    };
    const so = { rest: '' }, se = { rest: '' };
    p.stdout!.on('data', lines(so, true));
    p.stderr!.on('data', lines(se, false));
    p.on('error', (e) => { say(`!! ${e.message}`); });
    p.on('close', (code, sig) => {
      if (so.rest.trim()) { say(so.rest); out.push(so.rest); }
      if (se.rest.trim()) say(se.rest);
      child = undefined;
      done({ code: code ?? (sig ? 143 : 1), out });
    });
  });
  const finished = (async () => {
    try {
      for (const id of order) {
        if (state.stopped) break;
        const s = STAGES.find((x) => x.id === id)!;
        const need = s.needs?.();
        say(`\n════ ${s.title} ════`);
        if (need) { say(`пропущено: ${need}`); state.results.push({ id, code: 2, s: 0, summary: need }); continue; }
        state.current = id;
        const t = Date.now();
        const startedAt = new Date().toISOString();
        let code = 0;
        let summary: string | undefined;
        for (const cmd of s.cmds) {
          const r = await exec(cmd);
          summary = r.out.at(-1) ?? summary;
          if (r.code !== 0 && !cmd.optional) { code = r.code; break; }
          if (state.stopped) { code = 143; break; }
        }
        const secs = Math.round((Date.now() - t) / 1000);
        if (code && !summary) summary = state.log.filter((l) => l.trim()).at(-1);
        markStage(id, { startedAt, finishedAt: new Date().toISOString(), code, ...(summary ? { summary: summary.slice(0, 300) } : {}), by: 'пульт' });
        state.results.push({ id, code, s: secs, ...(summary ? { summary } : {}) });
        say(`── ${code === 0 ? 'готово' : code === 2 ? 'пропущено' : `ОШИБКА (код ${code})`} за ${secs} с`);
        if (code !== 0 && code !== 2 && !s.optional) { say('обязательный шаг упал — дальше не идём'); break; }
      }
    } finally {
      state.current = undefined;
      state.finishedAt = new Date().toISOString();
      try { unlinkSync(LOCK); } catch { /* уже нет */ }
    }
    return state;
  })();
  return finished;
}

export function stopRun(): boolean {
  if (!run || run.finishedAt) return false;
  run.stopped = true;
  child?.kill('SIGTERM');
  return true;
}

// ─── Google-таблица: правил ли её кто-то после нашей синхронизации ────────────
let sheetProbe: { at: number; text: string; changed?: boolean } | undefined;
export function probeSheet(force = false): { at: number; text: string; changed?: boolean } {
  if (sheetProbe && !force && Date.now() - sheetProbe.at < 10 * 60e3) return sheetProbe;
  const py = join(ROOT, '.cache/venv/bin/python');
  if (!existsSync(py)) return (sheetProbe = { at: Date.now(), text: 'нет .cache/venv — один раз запустите синхронизацию' });
  const r = spawnSync(py, ['tools/markup-google.py', 'check'], { cwd: ROOT, encoding: 'utf8', timeout: 30e3 });
  const remote = /изменён (\S+)/.exec(`${r.stdout}${r.stderr}`)?.[1];
  const ours = read<{ modifiedTime?: string }>('.cache/markup/google.meta.json', {}).modifiedTime;
  if (!remote) return (sheetProbe = { at: Date.now(), text: `не проверить: ${(r.stderr || r.stdout).trim().split('\n').at(-1) ?? r.status}` });
  const changed = Boolean(ours && remote !== ours);
  return (sheetProbe = { at: Date.now(), changed, text: changed ? `в таблице есть правки после синхронизации (${remote.slice(0, 16).replace('T', ' ')})` : 'правок после синхронизации нет' });
}

// ─── командная строка ─────────────────────────────────────────────────────────
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === 'run') {
    const ids = rest.includes('stale') ? staleIds() : rest;
    if (!ids.length) { console.log('устаревшего нет'); process.exit(0); }
    const r = await startRun(ids, (l) => console.log(l));
    const bad = r.results.filter((x) => x.code !== 0 && x.code !== 2);
    console.log(`\nитог: ${r.results.map((x) => `${x.id} ${x.code === 0 ? 'ok' : x.code === 2 ? 'пропущен' : `код ${x.code}`}`).join(', ')}`);
    process.exit(bad.length ? 1 : 0);
  }
  const icon = { ok: '✓', stale: '•', error: '✗', skipped: '–', never: '○', blocked: '⊘', running: '▶' } as const;
  for (const s of status()) {
    const when = s.lastAt ? new Date(s.lastAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
    console.log(`${icon[s.state]} ${s.title.padEnd(24)} ${when.padEnd(18)} ${s.why ?? ''}${s.pending && s.why !== s.pending.text ? ` · ${s.pending.text}` : ''}`);
  }
  const st = staleIds();
  console.log(st.length ? `\nустарело: ${st.join(' ')} — npx tsx tools/pipeline.mts run stale` : '\nустаревшего нет');
}

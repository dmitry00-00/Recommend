// Выкладка на bothost через GitHub (07.10): собранный deploy/bothost/ — в ветку `bothost` репозитория,
// откуда его забирает бот (в панели: источник GitHub, ветка bothost). В корне ветки — index.js, package.json
// без "type": "module", worker.cjs, public/ — то же, что в tm-bothost.zip.
// Ветка — один коммит, перезаписывается каждый раз: сборка весит ~20 МБ, копить её в истории незачем.
//
//   npm run deploy:github                       — собрать (npm run build:bothost), снять копию базы и отправить
//   npm run deploy:github -- --no-build         — отправить уже собранное
//   npm run deploy:github -- --dry-run          — всё, кроме отправки и опроса сервера (копия базы — снимается)
//   npm run deploy:github -- --allow-dirty      — выкладывать и с незакоммиченным в отслеживаемых файлах
//   npm run deploy:github -- --no-backup        — без копии базы перед выкладкой
//   npm run deploy:github -- --verify           — только проверить, что сервер поднял сборку из deploy/bothost
//   npm run deploy:rollback                     — вернуть прошлую выкладку (ветка bothost-prev)
//
// С 17.10 (аудит, волна 1, п. 11) — выкладка с откатом и проверкой:
//   - грязное дерево (отслеживаемые файлы) — отказ: на сервере должно быть ровно то, что есть в коммите;
//   - перед отправкой — свежая копия базы (tools/db-backup.mts pull --fresh), не снялась — отказ;
//   - прежняя ветка bothost сохраняется как bothost-prev и тегом deploy-<время её сборки> (тегов — 10 последних);
//   - ассеты прежней выкладки (только её собственные, одно поколение) докладываются в public/assets: открытое до
//     выкладки приложение просит старые чанки (сборка кладёт их из прошлой локальной сборки, а здесь сверяется
//     с тем, что на самом деле в ветке — локальных сборок без выкладки могло быть несколько);
//   - после отправки — опрос TM_SERVER/api/version до 3 мин, пока не совпадёт коммит, затем /api/health.
//
// Ключей в сборке нет: ключ Кинопоиска и токены — только в переменных бота. Ключ TMDb (VITE_) есть —
// он и так открыт в браузере каждого, кто открыл приложение.
import { execSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { brotliCompressSync, constants as zlibConstants, gzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = process.cwd();
const out = join(root, 'deploy', 'bothost');
const BRANCH = process.env.TM_DEPLOY_BRANCH ?? 'bothost';
const PREV = `${BRANCH}-prev`;
const TAGS_KEEP = 10;
const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const DRY = flag('--dry-run');
const sh = (cmd, cwd = root) => execSync(cmd, { cwd, stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 256 << 20 }).toString().trim();
const shQuiet = (cmd, cwd = root) => { try { return execSync(cmd, { cwd, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return undefined; } };
const fail = (msg) => { console.error(`\n✖ ${msg}`); process.exit(1); };

const env = existsSync(join(root, '.env.local')) ? readFileSync(join(root, '.env.local'), 'utf8') : '';
const envVar = (k) => process.env[k] ?? [...env.matchAll(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/gm)].find((m) => m[1] === k)?.[2].replace(/^['"]|['"]$/g, '');
const server = (envVar('TM_SERVER') ?? 'https://bot-1791394986-4062-dmitriy-00.bothost.tech').replace(/\/+$/, '');

// ── опрос сервера: поднялась ли сборка с этим коммитом
async function getJson(path) {
  try {
    const res = await fetch(`${server}${path}`, { signal: AbortSignal.timeout(10e3), headers: { 'cache-control': 'no-cache' } });
    const text = await res.text();
    try { return { status: res.status, body: JSON.parse(text) }; } catch { return { status: res.status, text: text.slice(0, 120).replace(/\s+/g, ' ') }; }
  } catch (err) {
    return { status: 0, text: err.name === 'TimeoutError' ? 'нет ответа за 10 с' : err.message };
  }
}

async function verify(expected, { minutes = Number(process.env.TM_DEPLOY_WAIT_MIN) || 3 } = {}) {
  console.log(`\nжду на ${server} сборку ${expected ? expected.slice(0, 7) : '?'} (до ${minutes} мин)…`);
  const until = Date.now() + minutes * 60e3;
  let last = '';
  while (true) {
    const v = await getJson('/api/version');
    const got = v.body?.commit;
    if (expected && got === expected) break;
    const now = got ? `сервер отдаёт ${String(got).slice(0, 7)}` : `/api/version: ${v.status || ''} ${v.text ?? ''}`.trim();
    if (now !== last) { console.log(`  ${new Date().toLocaleTimeString('ru-RU')} ${now}`); last = now; }
    if (!expected || Date.now() > until) {
      const h = await getJson('/api/health');
      console.error([
        '',
        '████ ВЫКЛАДКА НЕ ПОДТВЕРЖДЕНА ████',
        `за ${minutes} мин сервер не отдал коммит ${expected ? expected.slice(0, 7) : '(неизвестен)'}: ${now}`,
        `/api/health: ${h.status} ${h.body ? JSON.stringify(h.body) : h.text ?? ''}`,
        'Если пересборку в панели bothost запускают руками — запустите её и проверьте: npm run deploy:github -- --verify',
        `Сломалось — откат: npm run deploy:rollback (ветка ${BRANCH} ← ${PREV})`,
      ].join('\n'));
      return false;
    }
    await new Promise((r) => setTimeout(r, 10e3));
  }
  const h = await getJson('/api/health');
  const healthy = h.status === 200 && h.body?.ok === true;
  console.log(`✔ сервер поднял ${expected.slice(0, 7)}; /api/health: ${h.status} ${h.body ? JSON.stringify(h.body) : h.text ?? ''}`);
  if (!healthy) console.error(`████ /api/health не в порядке — посмотрите журнал бота; откат: npm run deploy:rollback`);
  return healthy;
}

// ── удалённые ветки и теги
function fetchBranch(name) {
  if (shQuiet(`git fetch -q origin +refs/heads/${name}:refs/remotes/origin/${name}`) === undefined) return undefined;
  return shQuiet(`git rev-parse refs/remotes/origin/${name}`);
}
const remoteHead = (name) => shQuiet(`git ls-remote origin refs/heads/${name}`)?.split(/\s+/)[0] || undefined;
const versionAt = (sha) => { try { return JSON.parse(shQuiet(`git show ${sha}:version.json`) ?? ''); } catch { return undefined; } };
const tagName = (sha) => `deploy-${shQuiet(`git log -1 --date=format:%Y%m%d-%H%M --format=%cd ${sha}`)}`;

/** Тег на выкладку (её же время сборки) и чистка: остаются TAGS_KEEP последних deploy-*. */
function tagRemote(sha) {
  const name = tagName(sha);
  if (!shQuiet(`git ls-remote --tags origin refs/tags/${name}`)) execSync(`git push -q origin ${sha}:refs/tags/${name}`, { cwd: root, stdio: 'inherit' });
  const all = (shQuiet(`git ls-remote --tags origin 'refs/tags/deploy-*'`) ?? '').split('\n').map((l) => l.split(/\s+/)[1]).filter((r) => r && !r.endsWith('^{}')).sort();
  const old = all.slice(0, Math.max(0, all.length - TAGS_KEEP));
  if (old.length) execSync(`git push -q origin ${old.map((r) => `:${r}`).join(' ')}`, { cwd: root, stdio: 'inherit' });
  return name;
}

// ── только проверка
if (flag('--verify')) {
  const v = existsSync(join(out, 'version.json')) ? JSON.parse(readFileSync(join(out, 'version.json'), 'utf8')) : undefined;
  process.exit((await verify(v?.commit)) ? 0 : 1);
}

// ── откат: bothost ← bothost-prev; текущая (неудачная) остаётся тегом
if (flag('--rollback')) {
  const cur = fetchBranch(BRANCH);
  const prev = fetchBranch(PREV);
  if (!prev) fail(`нет ветки ${PREV} — откатываться не на что (её создаёт выкладка с 17.10)`);
  if (cur === prev) fail(`${BRANCH} уже совпадает с ${PREV} (${prev.slice(0, 7)}) — откат уже сделан?`);
  const expected = versionAt(prev)?.commit;
  console.log(`откат: ${BRANCH} ${cur?.slice(0, 7) ?? '(нет)'} → ${prev.slice(0, 7)} (${shQuiet(`git log -1 --format=%s ${prev}`)})`);
  if (DRY) { console.log('--dry-run: ничего не отправляю'); process.exit(0); }
  if (cur) console.log(`текущая сохранена тегом ${tagRemote(cur)}`);
  if (remoteHead(BRANCH) !== cur) fail(`${BRANCH} на GitHub изменилась, пока шёл откат — повторите`);
  execSync(`git push -f origin ${prev}:refs/heads/${BRANCH}`, { cwd: root, stdio: 'inherit' });
  if (!expected) { console.log('в откатной сборке нет version.json (до 17.10) — проверяю только /api/health через минуту'); await new Promise((r) => setTimeout(r, 60e3)); }
  process.exit((expected ? await verify(expected) : (await getJson('/api/health')).body?.ok === true) ? 0 : 1);
}

// ── выкладка
const allowDirty = flag('--allow-dirty');
const dirtyFiles = execSync('git status --porcelain --untracked-files=no', { cwd: root }).toString().replace(/\n+$/, '');
if (!flag('--no-build')) {
  if (dirtyFiles && !allowDirty) {
    fail(`незакоммиченное в отслеживаемых файлах — не выкладываю (закоммитьте или --allow-dirty):\n${dirtyFiles.split('\n').slice(0, 15).join('\n')}`);
  }
  execSync('npm run build:bothost', { cwd: root, stdio: 'inherit' });
}
if (!existsSync(join(out, 'index.js'))) fail('нет deploy/bothost/index.js — сначала npm run build:bothost');
if (!existsSync(join(out, 'version.json'))) fail('в сборке нет version.json (собрана до 17.10) — пересоберите: npm run build:bothost');
const version = JSON.parse(readFileSync(join(out, 'version.json'), 'utf8'));
if (version.dirty && !allowDirty) fail('сборка сделана из дерева с незакоммиченным (version.json: dirty) — пересоберите из чистого или --allow-dirty');
const head = sh('git rev-parse HEAD');
if (version.commit !== head) console.warn(`внимание: сборка из ${String(version.commit).slice(0, 7)}, а HEAD сейчас ${head.slice(0, 7)} (--no-build?)`);

// секретов в сборке быть не должно: токен админа и ключ Кинопоиска из .env.local — проверяем буквально
const secrets = [...env.matchAll(/^(TM_ADMIN_TOKEN|ADMIN_TOKEN|KP_API_KEY|VITE_KP_API_KEY|BOT_TOKEN|TELEGRAM_BOT_TOKEN)=(.+)$/gm)].map((m) => m[2].trim()).filter((s) => s.length >= 16);
const files = (dir) => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? files(p) : [p]; });
for (const f of files(out)) {
  const text = readFileSync(f, 'latin1');
  if (secrets.some((s) => text.includes(s))) fail(`в сборке секрет из .env.local: ${f} — не отправляю`);
}

// копия базы — перед выкладкой, свежая: миграции новой сборки идут по живой базе
if (!flag('--no-backup')) {
  console.log('\n── копия базы перед выкладкой');
  const b = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['--yes', 'tsx', 'tools/db-backup.mts', 'pull', '--fresh'], { cwd: root, stdio: 'inherit', env: process.env });
  if (b.status !== 0) fail(`копия базы не снята (код ${b.status ?? b.signal}) — не выкладываю; без копии: --no-backup`);
} else {
  console.log('\n── копия базы перед выкладкой: пропущена (--no-backup)');
}

const remote = sh('git remote get-url origin');
const remoteSha = fetchBranch(BRANCH);
const tmp = mkdtempSync(join(tmpdir(), 'tm-deploy-'));
let code = 0;
try {
  cpSync(out, tmp, { recursive: true });

  // ассеты прежней выкладки — по тому, что на самом деле в ветке, а не в прошлой локальной сборке
  const assets = join(tmp, 'public', 'assets');
  const manifestPath = join(tmp, 'assets.json');
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { own: readdirSync(assets), carried: [] };
  if (remoteSha) {
    let remoteOwn;
    try { remoteOwn = JSON.parse(shQuiet(`git show ${remoteSha}:assets.json`) ?? '').own; } catch { /* выкладка до 17.10 */ }
    const remoteFiles = (shQuiet(`git ls-tree --name-only ${remoteSha} public/assets/`) ?? '').split('\n').filter(Boolean).map((p) => p.slice('public/assets/'.length));
    // свои файлы прежней выкладки: по её assets.json (без перенесённых ею), у выкладки до 17.10 — все
    const theirs = new Set((remoteOwn ?? remoteFiles).filter((f) => remoteFiles.includes(f)));
    const own = new Set(manifest.own);
    const need = [...theirs].filter((f) => !own.has(f)).sort();
    // перенесённое сборкой из локальной сборки, которой на сервере не было, — лишнее
    // (18.10) вместе со сжатыми копиями .br/.gz рядом (tools/build-bothost.mjs, шаг 1в)
    for (const f of manifest.carried) if (!theirs.has(f)) for (const x of ['', '.br', '.gz']) rmSync(join(assets, f + x), { force: true });
    const missing = need.filter((f) => !existsSync(join(assets, f)));
    if (missing.length) {
      const x = mkdtempSync(join(tmpdir(), 'tm-deploy-prev-'));
      try {
        execSync(`git archive ${remoteSha} public/assets | tar -x -C ${JSON.stringify(x)}`, { cwd: root, stdio: ['ignore', 'ignore', 'inherit'], maxBuffer: 512 << 20 });
        for (const f of missing) cpSync(join(x, 'public', 'assets', f), join(assets, f));
      } finally { rmSync(x, { recursive: true, force: true }); }
    }
    manifest.carried = need;
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 1) + '\n');
    // докачанные из ветки — без сжатых копий: сжать здесь, чтобы сервер не сжимал их сам (18.10, аудит скорости, п. 31)
    for (const f of need) {
      const file = join(assets, f);
      if (!/\.(?:js|mjs|css|json|svg|txt|html)$/i.test(f) || existsSync(`${file}.br`) || !existsSync(file)) continue;
      const body = readFileSync(file);
      if (body.length <= 1024) continue;
      writeFileSync(`${file}.br`, brotliCompressSync(body, { params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 11 } }));
      writeFileSync(`${file}.gz`, gzipSync(body, { level: 9 }));
    }
    const mb = (list) => (list.reduce((n, f) => n + statSync(join(assets, f)).size, 0) / 1048576).toFixed(1);
    console.log(`\nассеты: своих ${manifest.own.length} (${mb(manifest.own)} МБ), от выкладки ${remoteSha.slice(0, 7)} — ${need.length} (${mb(need)} МБ; из ветки докачано ${missing.length})`);
  } else {
    console.log(`\nветки ${BRANCH} на GitHub нет — первая выкладка, прошлых ассетов нет`);
  }

  sh('git init -q -b ' + BRANCH, tmp);
  sh('git add -A', tmp);
  const msg = `bothost: сборка ${new Date().toISOString().slice(0, 16).replace('T', ' ')} из ${String(version.commit).slice(0, 7)}${version.dirty ? ' + незакоммиченное' : ''}`;
  sh(`git -c user.name="$(git -C '${root}' config user.name)" -c user.email="$(git -C '${root}' config user.email)" commit -q -m ${JSON.stringify(msg)}`, tmp);
  const size = (Number(sh('du -sk .', tmp).split(/\s+/)[0]) / 1024).toFixed(1);

  if (DRY) {
    console.log([
      '',
      `--dry-run: не отправляю. Было бы (${size} МБ, с .git):`,
      remoteSha ? `  ${PREV} ← ${remoteSha.slice(0, 7)} (нынешняя ${BRANCH}), тег ${tagName(remoteSha)}` : `  ${PREV}: не трогается (ветки ${BRANCH} нет)`,
      `  ${BRANCH} ← «${msg}»`,
      `  затем опрос ${server}/api/version до совпадения с ${String(version.commit).slice(0, 7)} и /api/health`,
    ].join('\n'));
  } else {
    if (remoteSha) {
      execSync(`git push -q -f origin ${remoteSha}:refs/heads/${PREV}`, { cwd: root, stdio: 'inherit' });
      console.log(`прежняя выкладка: ${PREV} ← ${remoteSha.slice(0, 7)}, тег ${tagRemote(remoteSha)}`);
      if (remoteHead(BRANCH) !== remoteSha) throw new Error(`${BRANCH} на GitHub изменилась во время выкладки — повторите`);
    }
    execSync(`git push -f ${JSON.stringify(remote)} HEAD:${BRANCH}`, { cwd: tmp, stdio: 'inherit' });
    console.log(`→ ${remote} ветка ${BRANCH}: ${msg}`);
    if (!(await verify(version.commit))) code = 1;
  }
} catch (err) {
  console.error(`\n✖ ${err.message}`);
  code = 1;
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
process.exit(code);

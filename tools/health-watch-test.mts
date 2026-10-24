// Проверка наблюдения за сервером (tools/health-watch.mts) на заглушках: адрес снаружи, сервер на Mac, Bot API —
// локальные http-серверы; launchctl и scutil — подменённые скрипты первыми в PATH (22.10, самопочинка туннеля).
//
//   npx tsx tools/health-watch-test.mts
//
// 1. Адрес отдаёт 530, сервер на Mac отвечает — туннель перезапущен, адрес ожил: сообщение «🔁 … снова отвечает»,
//    тревоги нет, неудачи не копятся. 2. Через минуту снова 530 — второй перезапуск не раньше чем через 10 мин: неудача
//    считается как обычно. 3. Включён Happ и перезапуск не помог — после двух неудач тревога с подсказкой про Happ.
// 4. Сервер на Mac лежит сам — туннель не трогаем. Токен бота и номер владельца — из настроек сервера (TM_SERVER_ENV).
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'tm-health-'));
const kicked = join(dir, 'kicked');
const happ = join(dir, 'happ');
const bin = join(dir, 'bin');
spawnSync('mkdir', ['-p', bin]);
// launchctl: print — агент есть; kickstart — отметка в файле
writeFileSync(join(bin, 'launchctl'), `#!/bin/sh\nif [ "$1" = kickstart ]; then echo "$@" >> "${kicked}"; fi\nexit 0\n`);
writeFileSync(join(bin, 'scutil'), `#!/bin/sh\nif [ -f "${happ}" ]; then echo '* (Connected)      948B VPN (su.ffg.happ.plus) "Happ Plus"'; fi\nexit 0\n`);
chmodSync(join(bin, 'launchctl'), 0o755); chmodSync(join(bin, 'scutil'), 0o755);
// свежая копия базы — чтобы суточная проверка копий не слала своё
const backups = join(dir, 'backups');
spawnSync('mkdir', ['-p', backups]);
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
writeFileSync(join(backups, `tm-${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}-${stamp.slice(9, 15)}-test.sqlite.gz`), '');
writeFileSync(join(dir, 'server.env'), 'BOT_TOKEN=test-token\nOWNER_TG_ID=42\nOTHER=secret\n');

let localUp = true;
/** снаружи: 530, пока туннель не перезапустили после `healedAt` перезапусков (отметка kicked), или всегда, если `stuck` */
let stuck = false;
const kicks = () => (existsSync(kicked) ? readFileSync(kicked, 'utf8').trim().split('\n').length : 0);
let healedAt = 0;
const listen = (s: Server) => new Promise<number>((r) => s.listen(0, '127.0.0.1', () => r((s.address() as { port: number }).port)));
const ok = (res: import('node:http').ServerResponse) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"ok":true}'); };
const pub = createServer((_, res) => { if (!stuck && kicks() > healedAt) ok(res); else { res.writeHead(530); res.end('<!doctype html> cloudflare'); } });
const local = createServer((_, res) => { if (localUp) ok(res); else { res.writeHead(503); res.end('down'); } });
const sent: { chat_id: string; text: string }[] = [];
const bot = createServer((req, res) => {
  let b = ''; req.on('data', (c) => { b += c; }); req.on('end', () => {
    assert.match(req.url ?? '', /^\/bottest-token\/sendMessage$/);
    sent.push(JSON.parse(b)); res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"ok":true}');
  });
});
const [pubPort, localPort, botPort] = await Promise.all([listen(pub), listen(local), listen(bot)]);

// заглушки живут в цикле событий этого процесса — наблюдателя запускаем асинхронно (spawnSync их бы заморозил)
const watch = () => new Promise<string>((resolve) => {
  {
    const child = spawn('npx', ['tsx', 'tools/health-watch.mts'], {
      env: {
        ...process.env, PATH: `${bin}:${process.env.PATH}`, TM_SERVER: `http://127.0.0.1:${pubPort}`, TM_LOCAL_ORIGIN: `http://127.0.0.1:${localPort}`,
        TG_API_BASE: `http://127.0.0.1:${botPort}`, TM_HEALTH_DIR: join(dir, 'health'), TM_SERVER_ENV: join(dir, 'server.env'),
        TM_DB_BACKUP_DIR: backups, TM_TUNNEL_WAIT_MS: '100', BOT_TOKEN: '', TELEGRAM_BOT_TOKEN: '', OWNER_TG_ID: '',
      },
    });
    let out = ''; child.stdout.on('data', (c) => { out += c; }); child.stderr.on('data', (c) => { out += c; });
    child.on('close', () => resolve(out));
  }
});
const state = () => JSON.parse(readFileSync(join(dir, 'health', 'state.json'), 'utf8')) as { fails: number; down: boolean; tunnelRestartAt?: string };

// 1. туннель залип — перезапуск помог
await watch();
assert.equal(kicks(), 1, 'туннель перезапущен один раз');
assert.equal(state().fails, 0);
assert.equal(state().down, false);
assert.equal(sent.length, 1);
assert.equal(sent[0].chat_id, '42', 'номер владельца — из настроек сервера');
assert.match(sent[0].text, /^🔁 recomend: адрес не отвечал .* туннель перезапущен — адрес снова отвечает/);

// 2. снова 530 через минуту — второй перезапуск рано: обычная неудача
healedAt = kicks();
await watch();
assert.equal(kicks(), 1, 'второй перезапуск — не раньше чем через 10 мин');
assert.equal(state().fails, 1);
assert.equal(sent.length, 1, 'одна неудача — ещё не тревога');

// 3. Happ, перезапуск не помогает — тревога с подсказкой (перезапуск разрешён: сдвигаем отметку на 11 мин назад)
writeFileSync(happ, '');
stuck = true;
const s = state(); s.tunnelRestartAt = new Date(Date.now() - 11 * 60e3).toISOString();
writeFileSync(join(dir, 'health', 'state.json'), JSON.stringify(s));
await watch();
assert.equal(kicks(), 2);
assert.equal(state().down, true);
assert.match(sent.at(-1)!.text, /^🔴 recomend: сервер не отвечает .*включён Happ/);

// 4. сервер на Mac лежит сам — туннель не трогаем
const s2 = state(); s2.tunnelRestartAt = new Date(Date.now() - 11 * 60e3).toISOString();
writeFileSync(join(dir, 'health', 'state.json'), JSON.stringify(s2));
localUp = false;
await watch();
assert.equal(kicks(), 2, 'сервер лежит сам — перезапуск туннеля не поможет');
// токен из настроек сервера не попал ни в журнал, ни в состояние
const logs = readFileSync(join(dir, 'health', 'health.log'), 'utf8') + readFileSync(join(dir, 'health', 'state.json'), 'utf8');
assert.ok(!logs.includes('test-token') && !logs.includes('secret'));

for (const x of [pub, local, bot]) x.close();
rmSync(dir, { recursive: true, force: true });
console.log('health-watch: ok');

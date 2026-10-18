// Копии базы участников (ЗП-4, 06.10). Раз в сутки после 00:30 UTC (03:30 МСК) — согласованная
// копия на ходу, сжатая, в DATA_DIR/backups; хранится BACKUP_KEEP последних (по умолчанию 14).
// Каждая копия сразу проверяется: открывается, `integrity_check` = ok, таблицы на месте.
//
// Копия на том же диске спасает от порчи файла и неудачной миграции, но не от потери диска,
// поэтому её же забирает к себе Mac: `npx tsx tools/db-backup.mts pull` (ручки ниже, по ADMIN_TOKEN).
//
//   GET  /api/admin/backups              — список копий
//   POST /api/admin/backups              — снять копию сейчас
//   GET  /api/admin/backups/<имя|latest> — скачать копию (.sqlite.gz)
//   POST /api/admin/restore              — восстановить: `{ "backup": "<имя>" }` или тело — сам .sqlite.gz
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { pipeline } = require('stream/promises');

const NIGHT_UTC = { h: 0, m: 30 };
const NAME = /^tm-(\d{4}-\d{2}-\d{2})-(\d{6})-(nightly|manual|start|before-restore)\.sqlite\.gz$/;

const stamp = (d = new Date()) => {
  const iso = d.toISOString();
  return `${iso.slice(0, 10)}-${iso.slice(11, 13)}${iso.slice(14, 16)}${iso.slice(17, 19)}`;
};

function createBackups({ getDb, dir, keep = 14, inspect, log = console }) {
  fs.mkdirSync(dir, { recursive: true });

  function list() {
    return fs.readdirSync(dir)
      .map((name) => ({ name, m: NAME.exec(name) }))
      .filter((x) => x.m)
      .map(({ name, m }) => {
        const st = fs.statSync(path.join(dir, name));
        return { name, kind: m[3], size: st.size, at: st.mtime.toISOString() };
      })
      .sort((a, b) => (a.at < b.at ? 1 : -1));
  }

  function rotate() {
    for (const old of list().slice(keep)) fs.rmSync(path.join(dir, old.name), { force: true });
  }

  let running = null;
  /** Снять копию. Две одновременно не делаем — вторая получает ту же. */
  function make(kind = 'manual') {
    running ??= (async () => {
      const t0 = Date.now();
      const raw = path.join(dir, `.tmp-${process.pid}-${Date.now()}.sqlite`);
      const name = `tm-${stamp()}-${kind}.sqlite.gz`;
      const out = path.join(dir, name);
      try {
        getDb().backup(raw);
        const check = inspect ? inspect(raw) : undefined;
        if (check && !check.ok) throw new Error(`копия не прошла проверку: ${check.integrity}`);
        await pipeline(fs.createReadStream(raw), zlib.createGzip({ level: 6 }), fs.createWriteStream(`${out}.tmp`));
        fs.renameSync(`${out}.tmp`, out);
        rotate();
        const info = { name, kind, size: fs.statSync(out).size, rawSize: fs.statSync(raw).size, ms: Date.now() - t0, check };
        log.log(`копия базы: ${name}, ${(info.size / 1024).toFixed(0)} КБ сжатой (${(info.rawSize / 1024).toFixed(0)} КБ), ${info.ms} мс`
          + (check ? `, участников ${check.users}` : ''));
        return info;
      } finally {
        fs.rmSync(raw, { force: true });
        fs.rmSync(`${out}.tmp`, { force: true });
      }
    })().finally(() => { running = null; });
    return running;
  }

  const pathOf = (name) => {
    if (name === 'latest') name = list()[0]?.name;
    return name && NAME.test(name) && fs.existsSync(path.join(dir, name)) ? path.join(dir, name) : undefined;
  };

  /** Распаковать копию рядом с базой и проверить; вернуть путь к готовому файлу. */
  async function unpack(source, target) {
    const tmp = `${target}.restore-${Date.now()}`;
    try {
      const input = typeof source === 'string' ? fs.createReadStream(source) : source;
      // .sqlite.gz или голый .sqlite — по первым байтам
      const head = typeof source === 'string' ? fs.readFileSync(source).subarray(0, 2) : null;
      const gz = head ? head[0] === 0x1f && head[1] === 0x8b : true;
      await pipeline(input, ...(gz ? [zlib.createGunzip()] : []), fs.createWriteStream(tmp));
      const check = (inspect && inspect(tmp)) || { ok: true };
      if (!check.ok) throw new Error(`копия не годится: ${check.integrity ?? 'нет таблиц user/session'}`);
      return { tmp, check };
    } catch (err) {
      fs.rmSync(tmp, { force: true });
      throw err;
    }
  }

  /**
   * Восстановить базу из копии: сначала копия текущей (before-restore), потом подмена файла и
   * переоткрытие. `reopen(file)` закрывает прежнюю базу и открывает новую — это знает сервер.
   */
  async function restore(source, { file, reopen }) {
    const { tmp, check } = await unpack(source, file);
    try {
      const before = await make('before-restore');
      await reopen(() => {
        for (const ext of ['', '-wal', '-shm']) fs.rmSync(`${file}${ext}`, { force: true });
        fs.renameSync(tmp, file);
      });
      log.log(`база восстановлена из копии (участников ${check.users}); прежняя — ${before.name}`);
      return { ok: true, restored: check, before: before.name };
    } finally {
      fs.rmSync(tmp, { force: true });
    }
  }

  /** Ночная копия: раз в 10 минут смотрим, есть ли сегодняшняя; после старта — если суток без копии. */
  function schedule() {
    const tick = () => {
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const due = now.getUTCHours() * 60 + now.getUTCMinutes() >= NIGHT_UTC.h * 60 + NIGHT_UTC.m;
      const have = list().some((b) => b.kind === 'nightly' && b.name.startsWith(`tm-${today}`));
      if (due && !have) make('nightly').catch((err) => log.error('ночная копия базы:', err && (err.stack || err.message)));
    };
    setInterval(tick, 10 * 60e3).unref();
    setTimeout(() => {
      const last = list()[0];
      if (!last || Date.now() - Date.parse(last.at) > 24 * 3600e3) {
        make('start').catch((err) => log.error('копия базы при старте:', err && (err.stack || err.message)));
      }
      tick();
    }, 2 * 60e3).unref();
  }

  return { list, make, pathOf, restore, schedule, dir };
}

module.exports = { createBackups };

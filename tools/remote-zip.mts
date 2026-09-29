// Чтение zip прямо с HTTP: берём оглавление и отдельные файлы Range-запросами, а не качаем
// архив целиком. Так корпус субтитров на 3.8 ГБ обошёлся в 120 МБ, а Tag Genome на 1.8 ГБ —
// в 95 МБ. Работает с любым сервером, который отдаёт Accept-Ranges (object storage, files.*).
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { createInflateRaw, inflateRawSync } from 'node:zlib';

export interface ZipEntry {
  name: string;
  /** смещение локального заголовка в архиве */
  offset: number;
  compressed: number;
  size: number;
  method: number;
}

async function range(url: string, from: number, to: number): Promise<Buffer> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { Range: `bytes=${from}-${to}` } });
      if (!res.ok && res.status !== 206) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      if (attempt >= 3) throw err;
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
}

async function sizeOf(url: string): Promise<number> {
  const res = await fetch(url, { method: 'HEAD' });
  if (!res.ok) throw new Error(`HEAD ${res.status}`);
  return Number(res.headers.get('content-length'));
}

/** Оглавление архива: читаем хвост (EOCD, при нужде ZIP64) и сам каталог. */
export async function zipIndex(url: string): Promise<ZipEntry[]> {
  const total = await sizeOf(url);
  const tail = await range(url, Math.max(0, total - 66_000), total - 1);
  const eocd = tail.lastIndexOf(Buffer.from('PK\x05\x06', 'latin1'));
  if (eocd < 0) throw new Error('не нашли конец каталога zip');
  let count = tail.readUInt16LE(eocd + 10);
  let cdSize = tail.readUInt32LE(eocd + 12);
  let cdOffset = tail.readUInt32LE(eocd + 16);
  const z64 = tail.lastIndexOf(Buffer.from('PK\x06\x06', 'latin1'));
  if (z64 >= 0) {
    count = Number(tail.readBigUInt64LE(z64 + 32));
    cdSize = Number(tail.readBigUInt64LE(z64 + 40));
    cdOffset = Number(tail.readBigUInt64LE(z64 + 48));
  }
  const cd = await range(url, cdOffset, cdOffset + cdSize - 1);
  const out: ZipEntry[] = [];
  let p = 0;
  while (p + 46 <= cd.length && cd.readUInt32LE(p) === 0x02014b50) {
    const method = cd.readUInt16LE(p + 10);
    let compressed = cd.readUInt32LE(p + 20);
    let size = cd.readUInt32LE(p + 24);
    const nameLen = cd.readUInt16LE(p + 28);
    const extraLen = cd.readUInt16LE(p + 30);
    const commentLen = cd.readUInt16LE(p + 32);
    let offset = cd.readUInt32LE(p + 42);
    const name = cd.toString('utf8', p + 46, p + 46 + nameLen);
    if (size === 0xffffffff || compressed === 0xffffffff || offset === 0xffffffff) {
      // ZIP64: настоящие значения лежат в дополнительном поле 0x0001, по порядку
      let q = p + 46 + nameLen;
      const end = q + extraLen;
      while (q + 4 <= end) {
        const id = cd.readUInt16LE(q);
        const len = cd.readUInt16LE(q + 2);
        if (id === 0x0001) {
          let r = q + 4;
          if (size === 0xffffffff) { size = Number(cd.readBigUInt64LE(r)); r += 8; }
          if (compressed === 0xffffffff) { compressed = Number(cd.readBigUInt64LE(r)); r += 8; }
          if (offset === 0xffffffff) offset = Number(cd.readBigUInt64LE(r));
          break;
        }
        q += 4 + len;
      }
    }
    if (!name.endsWith('/')) out.push({ name, offset, compressed, size, method });
    p += 46 + nameLen + extraLen + commentLen;
  }
  if (out.length === 0 || count === 0) throw new Error('каталог zip пуст');
  return out;
}

/** Один файл из архива: берём локальный заголовок и данные одним запросом. */
export async function zipRead(entry: ZipEntry, url: string): Promise<string> {
  const head = 30 + 512; // имя и extra локального заголовка бывают длиннее, чем в каталоге
  const buf = await range(url, entry.offset, entry.offset + head + entry.compressed - 1);
  if (buf.readUInt32LE(0) !== 0x04034b50) throw new Error(`${entry.name}: не локальный заголовок`);
  const start = 30 + buf.readUInt16LE(26) + buf.readUInt16LE(28);
  const data = buf.subarray(start, start + entry.compressed);
  const raw = entry.method === 0 ? data : inflateRawSync(data);
  return raw.toString('utf8');
}


/** То же, но крупный файл кладём на диск потоком: держать в памяти строку на 300 МБ незачем. */
export async function zipSave(entry: ZipEntry, url: string, dest: URL | string): Promise<void> {
  const head = 30 + 512;
  const first = await range(url, entry.offset, entry.offset + head - 1);
  if (first.readUInt32LE(0) !== 0x04034b50) throw new Error(`${entry.name}: не локальный заголовок`);
  const start = entry.offset + 30 + first.readUInt16LE(26) + first.readUInt16LE(28);
  const res = await fetch(url, { headers: { Range: `bytes=${start}-${start + entry.compressed - 1}` } });
  if (!res.ok && res.status !== 206) throw new Error(`HTTP ${res.status}`);
  const source = Readable.fromWeb(res.body as never);
  await (entry.method === 0
    ? pipeline(source, createWriteStream(dest))
    : pipeline(source, createInflateRaw(), createWriteStream(dest)));
}

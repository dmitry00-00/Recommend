// Замер доступности из российских сетей (ХЮ-1, 13.10). С 09.06.2025 провайдеры России режут соединения с частью
// зарубежных хостингов на ~16 КБ: рукопожатие и первый ответ проходят, дальше соединение замирает. Внешние зонды
// (Globalping — у Ростелекома, МТС, Билайна, Дом.ру) читают тело только до 10 КБ, поэтому большой файл порог не
// покажет. Обход: ответ в gzip, а перед сжатыми данными в заголовке gzip — поле FEXTRA на `kb` килобайт. Распаковщик
// обязан принять весь балласт, прежде чем отдать первый байт тела; зонд видит строку «tm-probe ok» только если
// соединение пропустило больше `kb` КБ. `kb=0` — то же без балласта: сервер вообще отвечает.
//
//   GET /api/probe?kb=32  →  Content-Encoding: gzip, тело после распаковки — `tm-probe ok 32`
//
// Сжатие — без библиотек: один «хранимый» блок deflate и CRC-32, чтобы одинаково работало в Node и в Workers.

const MAX_KB = 63; // поле FEXTRA — не больше 65 535 байт

let table: Uint32Array | undefined;
function crc32(data: Uint8Array): number {
  if (!table) {
    table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (const b of data) c = table[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** gzip из одного хранимого блока; перед ним — поле FEXTRA с подполем «TM» на `pad` байт. */
export function paddedGzip(text: string, pad: number): Uint8Array {
  const body = new TextEncoder().encode(text);
  const sub = Math.max(0, Math.min(pad, 0xffff - 4));
  const xlen = pad > 0 ? sub + 4 : 0;
  const out = new Uint8Array(10 + (xlen ? 2 + xlen : 0) + 5 + body.length + 8);
  const v = new DataView(out.buffer);
  let i = 0;
  out.set([0x1f, 0x8b, 0x08, xlen ? 0x04 : 0x00, 0, 0, 0, 0, 0x00, 0xff], 0); i = 10;
  if (xlen) {
    v.setUint16(i, xlen, true); i += 2;
    out[i++] = 0x54; out[i++] = 0x4d; // подполе «TM»
    v.setUint16(i, sub, true); i += 2;
    // балласт — не нули: на пути не должно быть соблазна его сжать
    for (let k = 0; k < sub; k++) out[i++] = 0x21 + ((k * 7919) % 94);
  }
  out[i++] = 0x01; // последний блок, без сжатия
  v.setUint16(i, body.length, true); i += 2;
  v.setUint16(i, ~body.length & 0xffff, true); i += 2;
  out.set(body, i); i += body.length;
  v.setUint32(i, crc32(body), true); i += 4;
  v.setUint32(i, body.length, true);
  return out;
}

export function probe(url: URL, head: Record<string, string>): Response {
  const kb = Math.max(0, Math.min(MAX_KB, Math.floor(Number(url.searchParams.get('kb') ?? '32')) || 0));
  const body = paddedGzip(`tm-probe ok ${kb}\n`, kb * 1024);
  return new Response(body, {
    status: 200,
    headers: { ...head, 'content-type': 'text/plain; charset=utf-8', 'content-encoding': 'gzip', 'cache-control': 'no-store' },
    // Workers иначе сожмёт ещё раз; Node поле не знает и пропускает
    ...({ encodeBody: 'manual' } as ResponseInit),
  });
}

// Справочник «лицо и пара слов» целиком — для инструментов (25.10): в приложении он частями (src/mocks/peopleInfo/<nn>.ts,
// src/lib/peopleShard.ts), а инструментам удобнее один словарь.
import { readdirSync } from 'node:fs';
import type { PersonInfo } from '../src/mocks/peopleInfo/00.ts';

const dir = new URL('../src/mocks/peopleInfo/', import.meta.url);
const parts = await Promise.all(readdirSync(dir).filter((f) => f.endsWith('.ts')).sort()
  .map((f) => import(new URL(f, dir).href) as Promise<{ peopleInfo: Record<string, PersonInfo> }>));
export const peopleInfo: Record<string, PersonInfo> = Object.assign({}, ...parts.map((p) => p.peopleInfo));
export type { PersonInfo };

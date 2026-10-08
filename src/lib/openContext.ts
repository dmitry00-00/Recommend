import { createContext, useContext } from 'react';
import { noteOpen, type OpenPlace } from '@/api';
import type { ExternalAnalysis, ID } from '@/types/tmdf';

/** Откуда открывают материал (ТВ-3г): экран ставит место и произведение, полка — свою рубрику.
 *  Ссылка на материал берёт их отсюда и пишет открытие, не зная, на каком она экране. */
export interface OpenWhere { place: OpenPlace; workId?: ID; shelf?: string; shelves?: boolean }
export const OpenContext = createContext<OpenWhere>({ place: 'sheet' });

export function useNoteOpen(): (a: ExternalAnalysis) => void {
  const where = useContext(OpenContext);
  return (a) => noteOpen(a, where);
}

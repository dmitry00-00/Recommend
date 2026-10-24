// Документы (ЗП-5, 07.10): кто владелец сервиса и куда писать. Это обязательная часть правил рекомендательных
// технологий (149-ФЗ, ст. 10.2-2) и политики данных (152-ФЗ), но в код её не пишем: владелец решает, от чьего
// имени работает сервис (ИП или ООО), и задаёт это при сборке — VITE_LEGAL_OPERATOR и VITE_LEGAL_EMAIL в
// .env.local. Пока не задано — документы честно говорят «будет указано до открытого запуска».
import { EXPERIMENTS } from '@/lib/model/experiments';

const env = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

export const LEGAL = {
  operator: env(import.meta.env.VITE_LEGAL_OPERATOR),
  email: env(import.meta.env.VITE_LEGAL_EMAIL),
  /** дата редакции — менять вместе с текстами в ru.legal */
  edition: '24.10.2026', // 24.10: штрафы по ст. 13.56 КоАП с 07.2026 — «применяются рекомендательные технологии» словами закона, как отказаться, совместный подбор, приглушение громкого и подписки, почта для юридически значимых сообщений, отдельное согласие на обработку данных; 14.10: выгрузка дневника (ДФ-14), МА-3; 13.10: МА-1/МА-2
} as const;

export const legalComplete = Boolean(LEGAL.operator && LEGAL.email);

export type LegalDoc = 'rules' | 'privacy' | 'consent';
export const LEGAL_DOCS: readonly LegalDoc[] = ['rules', 'privacy', 'consent'];
export const isLegalDoc = (s: string | undefined): s is LegalDoc => LEGAL_DOCS.includes(s as LegalDoc);

/** Подбор учитывает чужие оценки (24.10): опыты над счётом (src/lib/model/experiments.ts), которые берут истории других
 *  зрителей, — «как оценили другие», похожие фильмы, соседи по вкусу, обученный счёт, отбор «что смотрят все», порядок
 *  колоды. Пока все выключены, правила об этом молчат; включили — в правилах и политике сам появляется раздел об
 *  обобщённых оценках (секции с `collab`), и тексты не отстают от ленты. */
export const collabOn = (): boolean => EXPERIMENTS.consensus || EXPERIMENTS.itemSim || EXPERIMENTS.neighbors
  || EXPERIMENTS.learnedBlend || EXPERIMENTS.twoStage || EXPERIMENTS.deckOrder;

/** Раздел документа; `collab` — только когда подбор учитывает чужие оценки (collabOn). */
export type LegalSection = { h: string; p: string[]; collab?: boolean };

// Документы (ЗП-5, 07.10): кто владелец сервиса и куда писать. Это обязательная часть правил рекомендательных
// технологий (149-ФЗ, ст. 10.2-2) и политики данных (152-ФЗ), но в код её не пишем: владелец решает, от чьего
// имени работает сервис (ИП или ООО), и задаёт это при сборке — VITE_LEGAL_OPERATOR и VITE_LEGAL_EMAIL в
// .env.local. Пока не задано — документы честно говорят «будет указано до открытого запуска».
const env = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

export const LEGAL = {
  operator: env(import.meta.env.VITE_LEGAL_OPERATOR),
  email: env(import.meta.env.VITE_LEGAL_EMAIL),
  /** дата редакции — менять вместе с текстами в ru.legal */
  edition: '07.10.2026',
} as const;

export const legalComplete = Boolean(LEGAL.operator && LEGAL.email);

export type LegalDoc = 'rules' | 'privacy';
export const isLegalDoc = (s: string | undefined): s is LegalDoc => s === 'rules' || s === 'privacy';

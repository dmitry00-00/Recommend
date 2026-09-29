import ru from './ru';
import en from './en';

export const dictionaries = { ru, en } as const;
export type Language = keyof typeof dictionaries;
export const t = (lang: Language = 'ru') => dictionaries[lang];

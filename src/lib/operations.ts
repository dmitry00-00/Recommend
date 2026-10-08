// Восемь операций: имя, строка для пользователя и форма глифа.
// Формы выгружены из дизайн-системы — они и есть вторая, независимая от цвета
// половина идентичности операции.
import type { CognitiveOperation } from '@/types/tmdf';
import ui from '@/i18n';

export interface OperationMeta {
  name: string;
  short: string;
  line: string;
  paths: string[];
  dots?: [number, number][];
  rings?: [number, number][];
}

export const operations: Record<CognitiveOperation, OperationMeta> = {
  pattern_recognition: {
    name: "Видеть закономерности",
    short: "Закономерности",
    line: "замечать повторы, рифмы и скрытую структуру",
    paths: ["M3 12.5V7.5", "M6.5 12.5V5", "M10 12.5V8.5", "M13.5 12.5V6"],
    dots: [[6.5, 2.4]],
  },
  causal_reasoning: {
    name: "Понимать причины",
    short: "Причины",
    line: "прослеживать, что к чему привело и почему",
    paths: ["M5.6 10.4 10.4 5.6"],
    rings: [[3.6, 12.4], [12.4, 3.6]],
  },
  perspective_taking: {
    name: "Смотреть чужими глазами",
    short: "Чужие глаза",
    line: "удерживать несколько точек зрения на одно событие",
    paths: ["M3.4 2.8 8 8.6", "M12.6 2.8 8 8.6", "M8 8.6V13.6"],
    dots: [[8, 8.6]],
  },
  analogical_thinking: {
    name: "Находить аналогии",
    short: "Аналогии",
    line: "переносить устройство одной истории на другую ситуацию",
    paths: ["M2.4 6.2h3.4v3.6H2.4z", "M10.2 5.2h3.4v5.6h-3.4z", "M5.8 8h4.4"],
  },
  synthesis: {
    name: "Собирать целое",
    short: "Целое",
    line: "связывать разрозненные фрагменты в общую картину",
    paths: ["M12.4 4.2a5.4 5.4 0 1 0 1.1 4.3"],
  },
  abstraction: {
    name: "Обобщать",
    short: "Обобщение",
    line: "видеть за частным случаем общую модель",
    paths: ["M2.6 12h10.8"],
    dots: [[4.6, 8.2], [8, 6.4], [11.4, 8.2]],
  },
  metacognition: {
    name: "Замечать своё мышление",
    short: "Своё мышление",
    line: "ловить, как ты сам интерпретируешь и где ошибаешься",
    paths: ["M11.8 4.6a2.8 2.8 0 0 0-2.8-2.4H7.6a2.9 2.9 0 0 0 0 5.8h1a2.9 2.9 0 0 1 0 5.8H7.4a2.8 2.8 0 0 1-2.8-2.4"],
  },
  critical_analysis: {
    name: "Проверять и сомневаться",
    short: "Проверка",
    line: "проверять допущения, аргументы и собственные выводы",
    paths: ["M8 2.4v8.4", "M4.2 13.6 8 8.2l3.8 5.4", "M5.6 11.6h4.8"],
  },
};

export const operationKeys = Object.keys(operations) as CognitiveOperation[];

export const opVar = (op: CognitiveOperation, suffix?: 'ink' | 'wash') =>
  `var(--tm-op-${op}${suffix ? '-' + suffix : ''})`;

// имя и строка — на языке интерфейса (ЗП-20): словарь `ui.operations`, здесь — русский запас и формы
for (const [k, v] of Object.entries(ui.operations)) Object.assign(operations[k as keyof typeof operations] ?? {}, v);

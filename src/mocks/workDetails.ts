// Страницы произведений (WorkDetail §16). В бандле системы моки только на уровне
// карточек, поэтому детали собраны здесь: две полные — для кадров, которые есть в
// сценарии («Двенадцать разгневанных мужчин» пройден, «Расёмон» — следующий), остальные
// достраиваются из карточки: пустые разделы экран не показывает.
import type { ID, WorkCard, WorkDetail } from '@/types/tmdf';
import { works, trajectories, tropeInsights, externalAnalyses } from './index';

/** Где произведение стоит в маршрутах — собирается из самих маршрутов, а не дублируется. */
function inTrajectoriesOf(workId: ID): WorkDetail['inTrajectories'] {
  return trajectories.flatMap((t) =>
    t.steps.filter((s) => s.work.id === workId)
      .map((s) => ({ trajectoryId: t.id, title: t.title, stepOrder: s.order })));
}

/** Деталь без размеченного содержания: только то, что уже есть в карточке. */
export function bare(card: WorkCard): WorkDetail {
  return {
    ...card,
    synopsis: '',
    whatItDoes: [],
    tropeInsights: [],
    prerequisites: [],
    inTrajectories: inTrajectoriesOf(card.id),
    relatedWorks: [],
    externalAnalyses: [],
    contributorsCredit: [],
  };
}

/** Размеченные разделы — частично: чего нет, достраивается из карточки. */
type Detail = Partial<Omit<WorkDetail, keyof WorkCard | 'inTrajectories'>>;

const full: Record<string, Detail> = {
  w01: {
    synopsis: 'Двенадцать присяжных заперты в комнате, чтобы вынести приговор юноше, обвинённому в убийстве отца. Одиннадцать уверены. Один просит сначала поговорить.',
    whatItDoes: [
      { op: 'critical_analysis', description: 'Каждую улику разбирают второй раз — и фильм показывает, на чём именно держалась уверенность и как она рушится.' },
      { op: 'perspective_taking', description: 'Одиннадцать разных причин голосовать «виновен», и почти ни одна не про дело: за каждым голосом — человек и его день.' },
    ],
    tropeInsights: tropeInsights.map((t) => ({
      ...t, charge: t.tropeId === 'tr-03' ? 'contradictory' : 'positive',
    })),
    prerequisites: [],
    relatedWorks: [
      { relation: 'continues', work: works.w02 },
      { relation: 'similar_structure', work: works.w09 },
    ],
    externalAnalyses: externalAnalyses.filter((a) => a.id === 'ea1' || a.id === 'ea2'),
    contributorsCredit: ['Марк Лаврентьев', 'Ника'],
    desireModel: 'goal_driven',
    characters: [
      { character: 'Присяжный № 8', explicit: 'Поговорить, прежде чем отправить парня на смерть.',
        visibility: 0, spoilerLevel: 0, confidence: 'high' },
      { character: 'Присяжный № 3', explicit: 'Осудить: факты очевидны, дело ясное.',
        suppressed: 'Наказать собственного сына — через чужого.',
        visibility: 1, spoilerLevel: 2, confidence: 'high' },
      { character: 'Присяжный № 10', explicit: 'Защитить город от «таких, как он».',
        suppressed: 'Не остаться одному со своим презрением.',
        visibility: 1, spoilerLevel: 1, confidence: 'medium' },
    ],
  },
  w02: {
    synopsis: 'У разрушенных ворот трое пережидают ливень и пересказывают одно убийство в лесу — четырьмя версиями, которые не складываются в одну.',
    whatItDoes: [
      { op: 'perspective_taking', description: 'Каждый рассказ выстроен так, что ему веришь, пока не начнётся следующий; фильм заставляет держать все четыре разом.' },
      { op: 'critical_analysis', description: 'Правильной версии нет — проверять приходится собственное желание её найти.' },
    ],
    tropeInsights: [
      {
        tropeId: 'tr-04',
        tropePath: ['Структура', 'Повествование', 'Несколько рассказчиков', 'Несовместимые показания'],
        name: 'Несовместимые показания',
        usage: 'deconstruction',
        charge: 'contradictory',
        operations: ['perspective_taking', 'critical_analysis'],
        spoilerLevel: 0,
        plainExplanation: 'Одно событие рассказано несколько раз, и версии противоречат друг другу — не чтобы запутать, а чтобы показать, что каждый рассказывает о себе.',
      },
      {
        tropeId: 'tr-05',
        tropePath: ['Структура', 'Повествование', 'Рамка', 'Разговор у ворот'],
        name: 'Разговор у ворот',
        usage: 'straight',
        operations: ['synthesis', 'metacognition'],
        spoilerLevel: 2,
        plainExplanation: 'Финальная сцена под воротами не разрешает спор о лесе — она переводит его в вопрос о том, зачем мы вообще хотим знать, кто прав.',
      },
    ],
    prerequisites: [
      { kind: 'work', label: '«Двенадцать разгневанных мужчин»', work: works.w01, necessity: 'helpful', met: true },
    ],
    relatedWorks: [
      { relation: 'prepares_for', work: works.w04 },
      { relation: 'similar_structure', work: works.w14 },
    ],
    externalAnalyses: externalAnalyses.filter((a) => a.id === 'ea3'),
    contributorsCredit: ['Марк Лаврентьев'],
    desireModel: 'goal_driven',
    characters: [
      { character: 'Тадзёмару', explicit: 'Признаться в убийстве — как в подвиге.',
        suppressed: 'Быть грозным разбойником, а не жалким.',
        visibility: 2, spoilerLevel: 1, confidence: 'medium' },
      { character: 'Жена самурая', explicit: 'Рассказать, как стала жертвой.',
        suppressed: 'Не оказаться той, кто подтолкнул к убийству.',
        visibility: 2, spoilerLevel: 2, confidence: 'medium' },
      { character: 'Дровосек', explicit: 'Быть сторонним свидетелем.',
        suppressed: 'Скрыть, что унёс кинжал.',
        visibility: 1, spoilerLevel: 2, confidence: 'high' },
    ],
  },
  // «Помни»: образец четвёртой позиции — месть, которая выглядит как справедливость
  w03: {
    synopsis: 'Леонард ищет убийцу жены, не умея запоминать ничего нового: заметки, полароиды и татуировки заменяют ему память, а фильм идёт задом наперёд.',
    whatItDoes: [
      { op: 'causal_reasoning', description: 'Каждая сцена — причина предыдущей: зритель собирает цепочку в обратном порядке и сам проверяет её на разрывы.' },
      { op: 'metacognition', description: 'Леонард доверяет своим записям так же, как мы доверяем своей памяти; фильм заставляет усомниться в обоих.' },
    ],
    tropeInsights: [
      {
        tropeId: 'tr-06',
        tropePath: ['Структура', 'Порядок', 'Обратная хронология'],
        name: 'Обратная хронология',
        usage: 'straight',
        charge: 'positive',
        operations: ['causal_reasoning', 'synthesis'],
        spoilerLevel: 0,
        plainExplanation: 'Сцены идут от конца к началу: вы знаете, что случилось, и не знаете почему — ровно как герой.',
      },
      {
        tropeId: 'tr-07',
        tropePath: ['Мотив', 'Месть', 'Месть как самообман'],
        name: 'Месть как самообман',
        usage: 'subversion',
        charge: 'negation_of_negation',
        operations: ['critical_analysis', 'metacognition'],
        spoilerLevel: 2,
        plainExplanation: 'Поиск справедливости оказывается способом никогда её не найти: герой сам устраивает себе цель, потому что цель — единственное, что у него осталось.',
      },
    ],
    relatedWorks: [{ relation: 'similar_structure', work: works.w02 }],
    desireModel: 'goal_driven',
    characters: [
      { character: 'Леонард', explicit: 'Найти и убить Джона Г.',
        suppressed: 'Никогда не закончить поиск: без него нечем жить.',
        visibility: 1, spoilerLevel: 2, confidence: 'high' },
    ],
  },
  // «Зеркало»: героя с целью нет — и это надо сказать словами, а не списком барьеров
  w07: { desireModel: 'none' },
};

export function workDetail(id: ID): WorkDetail | undefined {
  const card = works[id];
  if (!card) return undefined;
  return { ...bare(card), ...full[id] };
}

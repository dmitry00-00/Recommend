// Решения куратора по черновой разметке (трек Г3): id аннотации → утверждена / отклонена.
// Собирает tools/apply-review.mts из файла «Скачать решения» кураторской — так решения,
// принятые на одном устройстве, едут со сборкой ко всем. Не править руками.
// id: `draft:tmdb:<id>` — черновик фильма (draftAnnotations.ts), `own:<id карточки>` — первичная
// разметка истории владельца (userAnnotations.ts).

export interface ReviewMark { status: 'approved' | 'rejected'; at: string }

export const draftReview: Record<string, ReviewMark> = {};

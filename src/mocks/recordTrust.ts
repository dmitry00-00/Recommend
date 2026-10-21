// Сгенерировано tools/record-weights.mts (2026-10-19): доверие к привязке по виду
// улики — доля верных на решениях людей, сжатая к априорному (src/lib/weights.ts). Не править руками.
import type { TrustKind } from '@/lib/weights';

export const recordTrust: Partial<Record<TrustKind, number>> = {"none":0.949,"tag":0.966,"year":0.995,"original":0.98,"playlist":0.973,"lore":0.981};

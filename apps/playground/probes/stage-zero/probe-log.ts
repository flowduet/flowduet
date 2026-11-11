import { ref } from "vue";
import type { EntityRef } from "./probe-contracts";
export const entries = ref<
  {
    caseId: string;
    action: string;
    documentEpoch: number | null;
    entity?: EntityRef;
    observed: unknown;
  }[]
>([]);
export function record(
  caseId: string,
  action: string,
  observed: unknown,
  entity?: EntityRef,
  documentEpoch?: number,
) {
  // 无文档上下文的主题事件明确记为未知，不再用固定1冒充真实世代。
  entries.value.push({
    caseId,
    action,
    documentEpoch: documentEpoch ?? entity?.documentEpoch ?? null,
    ...(entity ? { entity } : {}),
    observed,
  });
}

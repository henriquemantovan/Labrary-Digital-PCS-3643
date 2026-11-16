import { api } from "./api";
import type { GroupResult, PublicProject } from "../../api/src/models/readModels";
import type { GroupResult as ConsolidatedGroupResult } from "../../api/src/models/consolidation";
export type { PublicProject };
export type ResultView = Omit<GroupResult, "rubricVersionId"> & { rubricVersionId: string | null };
export const readClient = {
  result: async (id: number): Promise<ResultView> => {
    const result = await api<ResultView | ConsolidatedGroupResult>(`/projects/${id}/result`);
    if (!("resultReleased" in result)) return result;
    const hidden: ResultView = { projectId: id, groupId: 0, round: 0, expected: 0, received: 0, pending: 0, complete: false, released: false, grade: null, rubricVersionId: null, criteria: [] };
    if (!result.resultReleased) return hidden;
    return { ...hidden, round: result.round ?? 0, expected: result.expectedEvaluatorIds.length,
      received: result.receivedEvaluatorIds.length, pending: result.pendingEvaluatorIds.length,
      complete: result.allEvaluationsCompleted, released: true, grade: result.grade,
      rubricVersionId: String(result.rubricVersionId),
      criteria: result.rubric.criteria.map(criterion => {
        const scores = result.evaluations.flatMap(e => e.scores.filter(s => s.criterionId === criterion.id));
        return { title: criterion.title, weight: criterion.weight,
          grade: scores.length ? scores.reduce((sum, s) => sum + s.score, 0) / scores.length : null,
          comment: scores.map(s => s.comment).filter(Boolean).join("\n") };
      }) };
  },
  catalog: (filters: Record<string, string>) => api<PublicProject[]>(`/public/projects?${new URLSearchParams(Object.entries(filters).filter(([, value]) => value))}`),
  detail: (id: number) => api<PublicProject>(`/public/projects/${id}`),
};

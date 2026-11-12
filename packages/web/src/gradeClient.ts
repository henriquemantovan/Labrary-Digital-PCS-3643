import { ApiError } from "./api";
export type { GradeRow, ConsolidatedResult } from "../../api/src/models/consolidation";

export async function downloadGrades(classId: number): Promise<Blob> {
  let response: Response;
  try {
    response = await fetch(`/api/classes/${classId}/grades?format=csv`, {
      credentials: "same-origin", cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "Não foi possível conectar. Tente exportar novamente.");
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(response.status, body?.error?.message ?? "Não foi possível exportar as notas.");
  }
  return response.blob();
}

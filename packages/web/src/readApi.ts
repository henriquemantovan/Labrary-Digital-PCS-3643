import { api } from "./api";
import type { GroupResult, PublicProject } from "../../api/src/models/readModels";
export type { PublicProject };
export type ResultView = Omit<GroupResult, "rubricVersionId"> & { rubricVersionId: string | null };
export const readClient = {
  result: (id: number) => api<ResultView>(`/projects/${id}/result`),
  catalog: (filters: Record<string, string>) => api<PublicProject[]>(`/public/projects?${new URLSearchParams(Object.entries(filters).filter(([, value]) => value))}`),
  detail: (id: number) => api<PublicProject>(`/public/projects/${id}`),
};

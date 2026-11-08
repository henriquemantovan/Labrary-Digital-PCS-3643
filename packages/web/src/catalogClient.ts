import { publicProjectSchema } from "../../api/src/models/publication";
import type {
  CatalogFilter,
  PublicProject,
  PublicPublicationProvider,
} from "../../api/src/models/publication";
import { api, ApiError } from "./api";

export type { CatalogFilter, PublicProject, PublicPublicationProvider };

/** C4 is shared with the producer; reject private fields and unsafe URLs. */
export function parsePublicProject(value: unknown): PublicProject {
  const result = publicProjectSchema.safeParse(value);
  if (!result.success)
    throw new Error(
      "O catálogo retornou dados incompatíveis. Tente novamente mais tarde.",
    );
  return result.data;
}

export function filterCatalog(
  projects: PublicProject[],
  filter: CatalogFilter,
) {
  const query = (filter.q ?? "").trim().toLocaleLowerCase("pt-BR");
  return projects.filter(
    (project) =>
      project.title.toLocaleLowerCase("pt-BR").includes(query) &&
      (filter.academicYear === undefined ||
        project.academicYear === filter.academicYear) &&
      (filter.classId === undefined || project.class.id === filter.classId) &&
      (filter.category === undefined || project.category === filter.category),
  );
}

/** No fixture fallback. These endpoints are supplied by publication in S6. */
export const httpCatalog: PublicPublicationProvider = {
  async list(filter) {
    const query = new URLSearchParams();
    if (filter.q?.trim()) query.set("q", filter.q.trim());
    if (filter.academicYear !== undefined)
      query.set("academicYear", String(filter.academicYear));
    if (filter.classId !== undefined)
      query.set("classId", String(filter.classId));
    if (filter.category !== undefined) query.set("category", filter.category);
    const data = await api<unknown>(`/catalog${query.size ? `?${query}` : ""}`);
    if (!Array.isArray(data))
      throw new Error("O catálogo retornou uma lista inválida.");
    return data.map(parsePublicProject);
  },
  async get(id) {
    try {
      const project = parsePublicProject(await api<unknown>(`/catalog/${id}`));
      if (project.id !== id)
        throw new Error("O catálogo retornou outro projeto.");
      return project;
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return undefined;
      throw error;
    }
  },
};

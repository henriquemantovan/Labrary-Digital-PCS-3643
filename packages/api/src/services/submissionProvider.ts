import type { DataRepository } from "../repositories/asyncRepository.js";
import { ProjectRepository } from "../repositories/projectRepository.js";
import { PublicationProviders } from "./publicationProviders.js";

/**
 * Adapter C1 real para a HU11: entrega a rodada mais recente persistida pela HU05.
 * Não filtra por estado; recusar rodada devolvida é responsabilidade do consumidor.
 */
export function createSubmissionProvider(
  repository: Pick<DataRepository<ProjectRepository>, "listSubmissions">,
): PublicationProviders["submissions"] {
  return {
    async latest(projectId) {
      // listSubmissions já devolve cópias ordenadas por rodada.
      return (await repository.listSubmissions(projectId)).at(-1);
    },
  };
}

import {
  NewPublicationDecision,
  PublicationDecision,
  publicationDecisionSchema,
} from "../models/publicationDecision.js";
import { NewMessage, ProjectMessage } from "../models/message.js";
import { ApiError } from "../errors.js";
import {
  MaterialVersion,
  NewMaterial,
  NewMaterialVersion,
  NewProject,
  Project,
  ProjectMaterial,
  ProjectStatus,
} from "../models/project.js";

export interface ProjectFilter {
  status?: ProjectStatus;
  classId?: number;
}

export interface ProjectRepository {
  publicationHistory(projectId: number): PublicationDecision[];
  recordPublicationDecision(input: NewPublicationDecision): PublicationDecision;
  list(filter: ProjectFilter): Project[];
  get(id: number): Project | undefined;
  create(input: NewProject): Project;
  listMaterials(projectId: number): ProjectMaterial[];
  getMaterial(
    projectId: number,
    materialId: number,
  ): ProjectMaterial | undefined;
  createMaterial(
    projectId: number,
    material: NewMaterial,
    version: NewMaterialVersion,
  ): ProjectMaterial;
  addVersion(
    projectId: number,
    materialId: number,
    version: NewMaterialVersion,
  ): ProjectMaterial;
  listMessages(projectId: number): ProjectMessage[];
  createMessage(input: NewMessage): {
    message: ProjectMessage;
    created: boolean;
  };
}

export interface ProjectSnapshot {
  publicationDecisions?: PublicationDecision[];
  projects: Project[];
  materials: ProjectMaterial[];
  messages: ProjectMessage[];
}
export interface ProjectStorage {
  load(): ProjectSnapshot | undefined;
  save(snapshot: ProjectSnapshot): void;
}

const sameTitle = (left: string, right: string) =>
  left.trim().toLocaleLowerCase("pt-BR") ===
  right.trim().toLocaleLowerCase("pt-BR");

const demoTimestamp = "2026-10-15T12:00:00.000Z";

export function createMemoryProjectRepository(
  withDemo = true,
  storage?: ProjectStorage,
): ProjectRepository {
  let projects: Project[] = withDemo
    ? [
        {
          id: 1,
          classId: 1,
          groupId: 1,
          title: "Controlador de semáforo inteligente",
          description:
            "Controlador digital com temporização configurável e modo de travessia para pedestres.",
          category: "Sistemas digitais",
          status: "EM_AVALIACAO",
          dueAt: null,
          createdAt: demoTimestamp,
          updatedAt: demoTimestamp,
        },
        {
          id: 2,
          classId: 1,
          groupId: 2,
          title: "Monitor de consumo energético",
          description:
            "Protótipo de leitura e sinalização local do consumo de um circuito.",
          category: "Instrumentação",
          status: "PREPARACAO",
          dueAt: null,
          createdAt: demoTimestamp,
          updatedAt: demoTimestamp,
        },
      ]
    : [];
  let materials: ProjectMaterial[] = [];
  let messages: ProjectMessage[] = [];
  const saved = storage?.load();
  if (saved) ({ projects, materials, messages } = saved);
  let nextProjectId = Math.max(2, ...projects.map((item) => item.id)) + 1;
  let nextMaterialId = Math.max(0, ...materials.map((item) => item.id)) + 1;
  // Inclui versões citadas em mensagens, que podem vir de materiais legados descartados.
  let nextVersionId =
    Math.max(
      0,
      ...materials.flatMap((item) => item.versions.map(({ id }) => id)),
      ...messages.map((item) => item.materialVersion?.id ?? 0),
    ) + 1;
  let nextMessageId = Math.max(0, ...messages.map((item) => item.id)) + 1;
  let decisions = saved?.publicationDecisions ?? [];
  const commit = (snapshot: ProjectSnapshot) => {
    const next = {
      ...snapshot,
      ...(snapshot.publicationDecisions || decisions.length
        ? { publicationDecisions: snapshot.publicationDecisions ?? decisions }
        : {}),
    };
    storage?.save(next);
    ({ projects, materials, messages } = next);
    decisions = next.publicationDecisions ?? [];
  };
  const buildVersion = (
    materialId: number,
    versionNumber: number,
    input: NewMaterialVersion,
  ): MaterialVersion => ({
    id: nextVersionId,
    materialId,
    versionNumber,
    ...input,
    uploadedAt: new Date().toISOString(),
  });

  return {
    publicationHistory(projectId) {
      return structuredClone(
        decisions.filter((event) => event.projectId === projectId),
      );
    },
    recordPublicationDecision(input) {
      const event = publicationDecisionSchema.parse({
        ...input,
        id: Math.max(0, ...decisions.map((event) => event.id)) + 1,
      });
      if (!projects.some((project) => project.id === event.projectId))
        throw new ApiError(404, "PROJECT_NOT_FOUND", "Projeto não encontrado.");
      commit({
        projects: projects.map((project) =>
          project.id === event.projectId && event.action === "FINALIZADO"
            ? { ...project, status: "FINALIZADO", updatedAt: event.createdAt }
            : project,
        ),
        materials,
        messages,
        publicationDecisions: [...decisions, event],
      });
      return structuredClone(event);
    },
    listMessages(projectId) {
      return messages
        .filter((item) => item.projectId === projectId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id);
    },
    createMessage(input) {
      const existing = messages.find(
        (item) =>
          item.projectId === input.projectId &&
          item.author.id === input.author.id &&
          item.clientMessageId === input.clientMessageId,
      );
      if (existing) {
        if (
          existing.body !== input.body ||
          existing.materialVersion?.id !== input.materialVersion?.id
        ) {
          throw new ApiError(
            409,
            "MESSAGE_ID_CONFLICT",
            "Este identificador já foi usado para outra mensagem.",
          );
        }
        return { message: existing, created: false };
      }
      const message = { ...input, id: nextMessageId };
      commit({ projects, materials, messages: [...messages, message] });
      nextMessageId += 1;
      return { message, created: true };
    },
    list(filter) {
      return projects.filter((project) => {
        return (
          (!filter.status || project.status === filter.status) &&
          (!filter.classId || project.classId === filter.classId)
        );
      });
    },
    get(id) {
      return projects.find((project) => project.id === id);
    },
    create(input) {
      if (projects.some((project) => project.groupId === input.groupId)) {
        throw new ApiError(
          409,
          "GROUP_ALREADY_HAS_PROJECT",
          "Este grupo já possui um projeto.",
        );
      }

      const timestamp = new Date().toISOString();
      const project: Project = {
        id: nextProjectId,
        ...input,
        dueAt: input.dueAt ?? null,
        status: "PREPARACAO",
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      commit({ projects: [...projects, project], materials, messages });
      nextProjectId += 1;
      return project;
    },
    listMaterials(projectId) {
      return materials.filter((material) => material.projectId === projectId);
    },
    getMaterial(projectId, materialId) {
      return materials.find(
        (item) => item.id === materialId && item.projectId === projectId,
      );
    },
    createMaterial(projectId, input, version) {
      if (
        materials.some(
          (material) =>
            material.projectId === projectId &&
            material.kind === input.kind &&
            sameTitle(material.title, input.title),
        )
      ) {
        throw new ApiError(
          409,
          "MATERIAL_ALREADY_EXISTS",
          "Já existe um material com este tipo e título. Envie uma nova versão para substituí-lo.",
        );
      }
      const material: ProjectMaterial = {
        id: nextMaterialId,
        projectId,
        ...input,
        createdAt: new Date().toISOString(),
        versions: [buildVersion(nextMaterialId, 1, version)],
      };
      commit({ projects, materials: [...materials, material], messages });
      nextMaterialId += 1;
      nextVersionId += 1;
      return material;
    },
    addVersion(projectId, materialId, version) {
      const material = materials.find(
        (item) => item.id === materialId && item.projectId === projectId,
      );
      if (!material) {
        throw new ApiError(
          404,
          "MATERIAL_NOT_FOUND",
          "Material não encontrado.",
        );
      }
      const updated: ProjectMaterial = {
        ...material,
        versions: [
          buildVersion(
            material.id,
            material.versions[0].versionNumber + 1,
            version,
          ),
          ...material.versions,
        ],
      };
      commit({
        projects,
        materials: materials.map((item) =>
          item === material ? updated : item,
        ),
        messages,
      });
      nextVersionId += 1;
      return updated;
    },
  };
}

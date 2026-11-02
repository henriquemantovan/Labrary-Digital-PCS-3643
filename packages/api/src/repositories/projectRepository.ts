import { NewMessage, ProjectMessage } from "../models/message.js";
import { ApiError } from "../errors.js";
import {
  NewMaterial,
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
  list(filter: ProjectFilter): Project[];
  get(id: number): Project | undefined;
  create(input: NewProject): Project;
  listMaterials(projectId: number): ProjectMaterial[];
  createMaterial(projectId: number, input: NewMaterial): ProjectMaterial;
  listMessages(projectId: number): ProjectMessage[];
  createMessage(input: NewMessage): {
    message: ProjectMessage;
    created: boolean;
  };
}

export interface ProjectSnapshot {
  projects: Project[];
  materials: ProjectMaterial[];
  messages: ProjectMessage[];
}
export interface ProjectStorage {
  load(): ProjectSnapshot | undefined;
  save(snapshot: ProjectSnapshot): void;
}

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
  let nextMessageId = Math.max(0, ...messages.map((item) => item.id)) + 1;
  const commit = (snapshot: ProjectSnapshot) => {
    storage?.save(snapshot);
    ({ projects, materials, messages } = snapshot);
  };

  return {
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
    createMaterial(projectId, input) {
      const relatedMaterials = materials.filter(
        (material) => material.projectId === projectId,
      );
      const versionNumber =
        relatedMaterials
          .filter((material) => material.title === input.title)
          .reduce(
            (highest, material) => Math.max(highest, material.versionNumber),
            0,
          ) + 1;
      const material: ProjectMaterial = {
        id: nextMaterialId,
        projectId,
        ...input,
        versionNumber,
        storageKey: `mock/${projectId}/${nextMaterialId}`,
        uploadedAt: new Date().toISOString(),
      };
      commit({ projects, materials: [...materials, material], messages });
      nextMaterialId += 1;
      return material;
    },
  };
}

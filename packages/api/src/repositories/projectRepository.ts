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
}

const demoTimestamp = "2026-10-15T12:00:00.000Z";

export function createMemoryProjectRepository(
  withDemo = true,
): ProjectRepository {
  const projects: Project[] = withDemo
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
  const materials: ProjectMaterial[] = [];
  let nextProjectId = 3;
  let nextMaterialId = 1;

  return {
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
        id: nextProjectId++,
        ...input,
        dueAt: input.dueAt ?? null,
        status: "PREPARACAO",
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      projects.push(project);
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
      nextMaterialId += 1;
      materials.push(material);
      return material;
    },
  };
}

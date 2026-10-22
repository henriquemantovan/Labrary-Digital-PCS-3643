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
}

type StoredMaterial = Omit<ProjectMaterial, "versions">;

const sameTitle = (left: string, right: string) =>
  left.trim().toLocaleLowerCase("pt-BR") ===
  right.trim().toLocaleLowerCase("pt-BR");

const demoTimestamp = "2026-10-15T12:00:00.000Z";

export function createMemoryProjectRepository(): ProjectRepository {
  const projects: Project[] = [
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
  ];
  const materials: StoredMaterial[] = [];
  const versions: MaterialVersion[] = [];
  let nextProjectId = 3;
  let nextMaterialId = 1;
  let nextVersionId = 1;

  const withVersions = (material: StoredMaterial): ProjectMaterial => ({
    ...material,
    versions: versions
      .filter((version) => version.materialId === material.id)
      .sort((left, right) => right.versionNumber - left.versionNumber),
  });
  const storeVersion = (materialId: number, input: NewMaterialVersion) => {
    const versionNumber =
      versions
        .filter((version) => version.materialId === materialId)
        .reduce(
          (highest, version) => Math.max(highest, version.versionNumber),
          0,
        ) + 1;
    versions.push({
      id: nextVersionId++,
      materialId,
      versionNumber,
      ...input,
      uploadedAt: new Date().toISOString(),
    });
  };

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
      return materials
        .filter((material) => material.projectId === projectId)
        .map(withVersions);
    },
    getMaterial(projectId, materialId) {
      const material = materials.find(
        (item) => item.id === materialId && item.projectId === projectId,
      );
      return material && withVersions(material);
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
      const material: StoredMaterial = {
        id: nextMaterialId++,
        projectId,
        ...input,
        createdAt: new Date().toISOString(),
      };
      materials.push(material);
      storeVersion(material.id, version);
      return withVersions(material);
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
      storeVersion(material.id, version);
      return withVersions(material);
    },
  };
}

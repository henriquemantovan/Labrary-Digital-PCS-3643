export const projectStatuses = [
  "PREPARACAO",
  "EM_AVALIACAO",
  "AJUSTES",
  "FINALIZADO",
] as const;
export type ProjectStatus = (typeof projectStatuses)[number];

export const materialKinds = ["VIDEO", "RELATORIO", "MANUAL", "OUTRO"] as const;
export type MaterialKind = (typeof materialKinds)[number];

export interface Project {
  id: number;
  classId: number;
  groupId: number;
  title: string;
  description: string;
  category: string;
  status: ProjectStatus;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MaterialVersion {
  id: number;
  materialId: number;
  versionNumber: number;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  checksumSha256: string | null;
  uploadedBy: number;
  uploadedAt: string;
}

export interface ProjectMaterial {
  id: number;
  projectId: number;
  kind: MaterialKind;
  title: string;
  createdBy: number;
  createdAt: string;
  /** Histórico completo, da versão mais recente para a mais antiga. */
  versions: MaterialVersion[];
}

export interface NewProject {
  classId: number;
  groupId: number;
  title: string;
  description: string;
  category: string;
  dueAt?: string;
}

export interface NewMaterial {
  kind: MaterialKind;
  title: string;
  createdBy: number;
}

export interface NewMaterialVersion {
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  checksumSha256: string | null;
  uploadedBy: number;
}

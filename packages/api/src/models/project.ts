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

export interface ProjectMaterial {
  id: number;
  projectId: number;
  kind: MaterialKind;
  title: string;
  versionNumber: number;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  uploadedAt: string;
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
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
}

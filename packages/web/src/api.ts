export interface User {
  id: number;
  fullName: string;
  email: string;
  role: "ALUNO" | "AVALIADOR" | "PROFESSOR" | "ADMIN";
  viewRole?: "ALUNO" | "AVALIADOR" | "PROFESSOR";
  googleLinked?: boolean;
}
export interface ManagedUser {
  id: number;
  fullName: string;
  email: string;
  role: User["role"];
  active: boolean;
}
export interface Project {
  id: number;
  classId: number;
  groupId: number;
  title: string;
  description: string;
  category: string;
  status: string;
  dueAt: string | null;
  groupName?: string;
  missingMaterials?: string[];
}
export interface Scope {
  classes: { id: number; name: string; academicYear: number }[];
  groups: { id: number; classId: number; name: string }[];
}
export interface MaterialVersion {
  id: number;
  versionNumber: number;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: { id: number; fullName: string | null };
  uploadedAt: string;
}
export interface Material {
  id: number;
  title: string;
  kind: string;
  currentVersion: MaterialVersion;
  versions: MaterialVersion[];
}
export interface ProjectMessage {
  id: number;
  projectId: number;
  clientMessageId: string;
  author: Pick<User, "id" | "fullName" | "role">;
  body: string;
  createdAt: string;
  materialVersion: { id: number; title: string; versionNumber: number } | null;
}
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Protection": "1",
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError(
      0,
      "Não foi possível conectar. Verifique sua conexão e tente novamente.",
    );
  }
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => null);
  if (!response.ok)
    throw new ApiError(
      response.status,
      body?.error?.message ?? "Não foi possível concluir. Tente novamente.",
    );
  return body.data as T;
}

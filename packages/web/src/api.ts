export interface User {
  id: number;
  fullName: string;
  email: string;
  role: "ALUNO" | "AVALIADOR" | "PROFESSOR";
}
export interface Project {
  id: number;
  classId: number;
  academicYear?: number | null;
  groupId: number;
  title: string;
  description: string;
  category: string;
  status: string;
  dueAt: string | null;
}
export interface Scope {
  classes: { id: number; name: string; academicYear: number }[];
  groups: { id: number; classId: number; name: string }[];
}
export interface Material {
  id: number;
  title: string;
  kind: string;
  versionNumber: number;
  originalFilename: string;
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

export interface Person {
  id: number;
  fullName: string;
  role: "ALUNO" | "AVALIADOR";
}
export interface LinkChange {
  before: number[];
  after: number[];
  changedBy: number;
  changedAt: string;
}
export interface ManagedGroup {
  id: number;
  classId: number;
  name: string;
  memberIds: number[];
  history: LinkChange[];
}
export interface Administration {
  groups: ManagedGroup[];
  people: Person[];
}
export interface Requirement {
  kind: "VIDEO" | "RELATORIO" | "MANUAL";
  label: string;
  required: true;
  allowedMimeTypes: string[];
  maxSizeBytes: number;
  dueAt: string;
}
export interface Criterion {
  title: string;
  description: string;
  weight: number;
  minScore: 0;
  maxScore: 10;
}
export interface RubricVersion {
  id: number;
  versionNumber: number;
  title: string;
  criteria: Criterion[];
  createdAt: string;
  createdBy: number;
}
export interface Evaluators {
  evaluatorIds: number[];
  history: LinkChange[];
}

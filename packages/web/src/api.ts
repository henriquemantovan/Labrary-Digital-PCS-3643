export interface User {
  id: number;
  fullName: string;
  email: string;
  role: "ALUNO" | "AVALIADOR" | "PROFESSOR";
  uspNumber?: string;
  uspAffiliations?: {
    tipoVinculo: string;
    nomeVinculo?: string;
    tipoFuncao?: string;
    codigoUnidade?: string;
    nomeUnidade?: string;
  }[];
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

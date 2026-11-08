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
  academicYear?: number | null;
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
  downloadUrl: string;
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
export interface MaterialRule {
  kind: string;
  defaultTitle: string;
  required: boolean;
  formats: { label: string; mimeType: string; extensions: string[] }[];
  maxSizeBytes: number;
}
export interface MaterialRules {
  dueAt: string | null;
  lock: "PROJECT_LOCKED" | "DEADLINE_PASSED" | null;
  canUpload: boolean;
  rules: MaterialRule[];
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

/**
 * Envia um formulário com arquivo. Usa XMLHttpRequest porque o fetch não
 * informa o progresso do envio.
 */
export function uploadFile<T>(
  path: string,
  body: FormData,
  onProgress: (percent: number) => void,
) {
  const request = new XMLHttpRequest();
  const promise = new Promise<T>((resolve, reject) => {
    request.open("POST", `/api${path}`);
    request.setRequestHeader("X-CSRF-Protection", "1");
    request.upload.onprogress = (event) => {
      if (event.lengthComputable)
        onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => {
      let payload: { data?: T; error?: { message?: string } } | null = null;
      try {
        payload = JSON.parse(request.responseText);
      } catch {
        payload = null;
      }
      if (request.status >= 200 && request.status < 300 && payload)
        resolve(payload.data as T);
      else
        reject(
          new ApiError(
            request.status,
            payload?.error?.message ??
              "Não foi possível enviar o arquivo. Tente novamente.",
          ),
        );
    };
    request.onerror = () =>
      reject(
        new ApiError(
          0,
          "Não foi possível conectar. Verifique sua conexão e tente novamente.",
        ),
      );
    request.onabort = () => reject(new ApiError(0, "Envio cancelado."));
    request.send(body);
  });
  return { promise, abort: () => request.abort() };
}

export interface Person {
  id: number;
  fullName: string;
  role: "ALUNO" | "AVALIADOR" | "ADMIN";
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
export interface Evaluators {
  evaluatorIds: number[];
  history: LinkChange[];
}

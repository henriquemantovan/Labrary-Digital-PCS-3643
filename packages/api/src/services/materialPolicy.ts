import { extname } from "node:path";
import { ApiError } from "../errors.js";
import { MaterialKind, Project } from "../models/project.js";

export interface FileFormat {
  label: string;
  mimeType: string;
  extensions: string[];
}

export const fileFormats = {
  pdf: { label: "PDF", mimeType: "application/pdf", extensions: [".pdf"] },
  mp4: { label: "MP4", mimeType: "video/mp4", extensions: [".mp4"] },
  webm: { label: "WebM", mimeType: "video/webm", extensions: [".webm"] },
  zip: { label: "ZIP", mimeType: "application/zip", extensions: [".zip"] },
  png: { label: "PNG", mimeType: "image/png", extensions: [".png"] },
  jpeg: {
    label: "JPEG",
    mimeType: "image/jpeg",
    extensions: [".jpg", ".jpeg"],
  },
} satisfies Record<string, FileFormat>;

export interface MaterialRule {
  kind: MaterialKind;
  defaultTitle: string;
  required: boolean;
  formats: FileFormat[];
  maxSizeBytes: number;
}

/**
 * Regras usadas enquanto a HU03 não permite ao professor configurar os
 * requisitos de cada projeto (`project_requirement`).
 */
export interface MaterialPolicy {
  rulesFor(project: Project): MaterialRule[];
}

const megabytes = (value: number) => value * 1024 * 1024;

export const defaultMaterialRules: MaterialRule[] = [
  {
    kind: "VIDEO",
    defaultTitle: "Vídeo de apresentação",
    required: true,
    formats: [fileFormats.mp4, fileFormats.webm],
    maxSizeBytes: megabytes(500),
  },
  {
    kind: "RELATORIO",
    defaultTitle: "Relatório do projeto",
    required: true,
    formats: [fileFormats.pdf],
    maxSizeBytes: megabytes(20),
  },
  {
    kind: "MANUAL",
    defaultTitle: "Manual de uso",
    required: true,
    formats: [fileFormats.pdf],
    maxSizeBytes: megabytes(20),
  },
  {
    kind: "OUTRO",
    defaultTitle: "Material complementar",
    required: false,
    formats: [
      fileFormats.pdf,
      fileFormats.zip,
      fileFormats.png,
      fileFormats.jpeg,
    ],
    maxSizeBytes: megabytes(50),
  },
];

export function createDefaultMaterialPolicy(
  rules: MaterialRule[] = defaultMaterialRules,
): MaterialPolicy {
  return { rulesFor: () => rules };
}

export function ruleFor(
  policy: MaterialPolicy,
  project: Project,
  kind: MaterialKind,
) {
  const rule = policy.rulesFor(project).find((item) => item.kind === kind);
  if (!rule)
    throw new ApiError(
      422,
      "MATERIAL_KIND_NOT_ACCEPTED",
      "Este projeto não recebe materiais deste tipo.",
    );
  return rule;
}

export const unsupportedFormat = (rule: MaterialRule) =>
  new ApiError(
    415,
    "UNSUPPORTED_FORMAT",
    `Formato não aceito. Envie ${rule.formats.map((format) => format.label).join(", ")}.`,
  );

/** Confere extensão, tipo e tamanho; o tipo deve ser o detectado pelo servidor. */
export function assertFileAccepted(
  rule: MaterialRule,
  file: { originalFilename: string; mimeType: string; sizeBytes: number },
) {
  if (file.sizeBytes === 0)
    throw new ApiError(400, "EMPTY_FILE", "O arquivo enviado está vazio.");
  if (file.sizeBytes > rule.maxSizeBytes)
    throw new ApiError(
      413,
      "FILE_TOO_LARGE",
      "O arquivo excede o tamanho permitido.",
    );
  const extension = extname(file.originalFilename).toLowerCase();
  const format = rule.formats.find(
    (item) => item.mimeType === file.mimeType.toLowerCase(),
  );
  if (!format || !format.extensions.includes(extension))
    throw unsupportedFormat(rule);
  return format;
}

export type UploadLock = "PROJECT_LOCKED" | "DEADLINE_PASSED";

/**
 * Entrega aberta: Preparação antes do prazo, ou Ajustes (reabertura pelo
 * professor, que vale mesmo depois do prazo original).
 */
export function uploadLock(project: Project, now: number): UploadLock | null {
  if (project.status === "AJUSTES") return null;
  if (project.status !== "PREPARACAO") return "PROJECT_LOCKED";
  if (project.dueAt && now >= Date.parse(project.dueAt))
    return "DEADLINE_PASSED";
  return null;
}

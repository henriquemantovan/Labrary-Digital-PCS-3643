import { z } from "zod";

const id = z.number().int().positive().safe();
const allowedFormats = {
  VIDEO: ["video/mp4", "video/webm"],
  RELATORIO: ["application/pdf"],
  MANUAL: ["application/pdf"],
} as const;

// Continua os requisitos e a validação de pesos de Yuhang no PR #26.
export const requirementSchema = z.object({
  kind: z.enum(["VIDEO", "RELATORIO", "MANUAL"]),
  label: z.string().trim().min(1).max(160),
  required: z.literal(true),
  allowedMimeTypes: z.array(z.string()).min(1).max(2),
  maxSizeBytes: id,
  dueAt: z.iso.datetime({ offset: true }),
}).strict().refine(
  (item) => new Set(item.allowedMimeTypes).size === item.allowedMimeTypes.length &&
    item.allowedMimeTypes.every((mime) => (allowedFormats[item.kind] as readonly string[]).includes(mime)),
  "Escolha formatos suportados para este material.",
);

export const criterionSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
  title: z.string().trim().min(1).max(160),
  description: z.string().max(10000),
  weight: z.number().positive().max(100).multipleOf(0.01),
  minScore: z.literal(0),
  maxScore: z.literal(10),
}).strict();

export const configurationInputSchema = z.object({
  title: z.string().trim().min(1).max(160),
  requirements: z.array(requirementSchema).length(3).refine(
    (items) => new Set(items.map((item) => item.kind)).size === 3,
    "Informe vídeo, relatório e manual, uma vez cada.",
  ),
  criteria: z.array(criterionSchema).min(1).max(100)
    .refine((items) => new Set(items.map((item) => item.id)).size === items.length,
      "Os identificadores de critérios devem ser únicos.")
    .refine((items) => items.reduce((sum, item) => sum + Math.round(item.weight * 100), 0) === 10000,
      "Os pesos devem somar 100%."),
}).strict();

export const rubricVersionSchema = configurationInputSchema.extend({
  id,
  classId: id,
  projectId: id,
  versionNumber: id,
  createdBy: id,
  createdAt: z.iso.datetime(),
}).strict();

export const rubricSnapshotSchema = z.object({
  versions: z.array(rubricVersionSchema),
}).strict().superRefine(({ versions }, ctx) => {
  const ids = new Set<number>();
  const counters = new Map<number, number>();
  const classes = new Map<number, number>();
  for (const item of versions) {
    const expectedVersion = (counters.get(item.projectId) ?? 0) + 1;
    const expectedClass = classes.get(item.projectId) ?? item.classId;
    if (ids.has(item.id) || item.versionNumber !== expectedVersion || item.classId !== expectedClass) {
      ctx.addIssue({ code: "custom", message: "Histórico de rubricas inválido." });
    }
    ids.add(item.id);
    counters.set(item.projectId, item.versionNumber);
    classes.set(item.projectId, item.classId);
  }
});

export type Requirement = z.infer<typeof requirementSchema>;
export type Criterion = z.infer<typeof criterionSchema>;
export type RubricVersion = z.infer<typeof rubricVersionSchema>;
export type ConfigurationInput = z.infer<typeof configurationInputSchema>;
export type RubricSnapshot = z.infer<typeof rubricSnapshotSchema>;

/** Sugestão de edição; não cria silenciosamente uma configuração persistida. */
export function defaultRequirements(dueAt: string): Requirement[] {
  return [
    { kind: "VIDEO", label: "Vídeo de apresentação", required: true,
      allowedMimeTypes: ["video/mp4", "video/webm"], maxSizeBytes: 500 * 1024 * 1024, dueAt },
    { kind: "RELATORIO", label: "Relatório do projeto", required: true,
      allowedMimeTypes: ["application/pdf"], maxSizeBytes: 20 * 1024 * 1024, dueAt },
    { kind: "MANUAL", label: "Manual de uso", required: true,
      allowedMimeTypes: ["application/pdf"], maxSizeBytes: 20 * 1024 * 1024, dueAt },
  ];
}

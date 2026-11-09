import { z } from "zod";
import { materialKinds } from "./project.js";
import { rubricVersionSchema } from "./rubric.js";

const id = z.number().int().positive().safe();

export const submittedMaterialSchema = z.object({
  materialId: id,
  kind: z.enum(materialKinds),
  title: z.string(),
  versionId: id,
  versionNumber: id,
  originalFilename: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().positive(),
  checksumSha256: z.string().nullable(),
}).strict();

/** C1: rodada submetida com snapshot imutável dos materiais e da rubrica. */
export const submissionSchema = z.object({
  id,
  projectId: id,
  round: id,
  clientSubmissionId: z.uuid(),
  status: z.enum(["SUBMETIDA", "DEVOLVIDA"]),
  submittedBy: id,
  submittedAt: z.iso.datetime(),
  returnedAt: z.iso.datetime().nullable(),
  rubricVersionId: id,
  rubric: rubricVersionSchema,
  materials: z.array(submittedMaterialSchema).min(1),
}).strict().superRefine((value, ctx) => {
  if (value.rubricVersionId !== value.rubric.id || value.projectId !== value.rubric.projectId)
    ctx.addIssue({ code: "custom", message: "Referência de rubrica incompatível com C0." });
  if ((value.status === "DEVOLVIDA") !== (value.returnedAt !== null))
    ctx.addIssue({ code: "custom", message: "Data de devolução incompatível com o estado." });
  if (new Set(value.materials.map((item) => item.materialId)).size !== value.materials.length)
    ctx.addIssue({ code: "custom", message: "Material repetido no snapshot." });
  const kinds = new Set(value.materials.map((item) => item.kind));
  if (value.rubric.requirements.some((requirement) => !kinds.has(requirement.kind)))
    ctx.addIssue({ code: "custom", message: "Material obrigatório ausente no snapshot." });
});

export type SubmittedMaterial = z.infer<typeof submittedMaterialSchema>;
export type Submission = z.infer<typeof submissionSchema>;
export type NewSubmission = Omit<Submission, "id">;

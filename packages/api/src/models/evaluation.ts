import { z } from "zod";
import { rubricVersionSchema } from "./rubric.js";

const id = z.number().int().positive().safe();
export const criterionScoreSchema = z.object({
  criterionId: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
  score: z.number().min(0).max(10),
  comment: z.string().trim().max(4000).default(""),
}).strict();
export const scoresSchema = z.array(criterionScoreSchema).max(100)
  .refine((items) => new Set(items.map((item) => item.criterionId)).size === items.length,
    "Critérios duplicados.");
export type CriterionScore = z.infer<typeof criterionScoreSchema>;

/** Proposta C2 da S5: formatos para combinar com consumidores, sem serviço/rotas. */
export const evaluationSchema = z.object({
  evaluatorId: id,
  status: z.enum(["PENDENTE", "RASCUNHO", "FINALIZADA", "REABERTA"]),
  revision: z.number().int().nonnegative().safe(),
  scores: scoresSchema,
  finalizedAt: z.iso.datetime().nullable(),
  history: z.array(z.object({
    action: z.enum(["RASCUNHO", "FINALIZADA", "REABERTA"]),
    actorId: id,
    at: z.iso.datetime(),
    reason: z.string().trim().min(1).max(2000).nullable(),
    revision: id,
    scores: scoresSchema,
  }).strict()),
}).strict().superRefine((value, ctx) => {
  if (value.status === "PENDENTE" &&
    (value.revision !== 0 || value.scores.length !== 0 || value.history.length !== 0))
    ctx.addIssue({ code: "custom", message: "Avaliação pendente ainda não possui notas ou histórico." });
  if ((value.status === "FINALIZADA") !== (value.finalizedAt !== null))
    ctx.addIssue({ code: "custom", message: "Data de finalização incompatível com o estado." });
  if (value.status === "REABERTA" && !value.history.some((event) => event.action === "REABERTA" && event.reason))
    ctx.addIssue({ code: "custom", message: "O exemplo reaberto deve registrar uma justificativa." });
});
export type Evaluation = z.infer<typeof evaluationSchema>;

export const evaluationContractSchema = z.object({
  projectId: id,
  submissionId: id,
  round: id,
  rubricVersionId: id,
  rubric: rubricVersionSchema,
  expectedEvaluatorIds: z.array(id).min(1)
    .refine((values) => new Set(values).size === values.length),
  evaluations: z.array(evaluationSchema),
}).strict().superRefine((value, ctx) => {
  if (value.rubricVersionId !== value.rubric.id || value.projectId !== value.rubric.projectId)
    ctx.addIssue({ code: "custom", message: "Referência de rubrica incompatível com C0." });
  if (new Set(value.evaluations.map((item) => item.evaluatorId)).size !== value.evaluations.length ||
    value.evaluations.some((item) => !value.expectedEvaluatorIds.includes(item.evaluatorId)))
    ctx.addIssue({ code: "custom", message: "Avaliadores duplicados ou fora da lista prevista." });
});
export type EvaluationContract = z.infer<typeof evaluationContractSchema>;

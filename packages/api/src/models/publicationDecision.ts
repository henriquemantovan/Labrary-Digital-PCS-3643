import { z } from "zod";
import { publicProjectSchema } from "./publication.js";
import { submissionSchema } from "./submission.js";
const id = z.number().int().positive().safe();
const base = z.object({
  id,
  projectId: id,
  submissionId: id,
  actorId: id,
  createdAt: z.iso.datetime(),
});
export const publicationDecisionSchema = z
  .discriminatedUnion("action", [
    base
      .extend({ action: z.literal("FINALIZADO"), submission: submissionSchema })
      .strict(),
    base
      .extend({
        action: z.literal("PUBLICADO"),
        groupAuthorization: z
          .object({
            groupId: id,
            reference: z.string().trim().min(5).max(1000),
          })
          .strict(),
        publicProject: publicProjectSchema,
      })
      .strict(),
    base.extend({ action: z.literal("RETIRADO") }).strict(),
  ])
  .superRefine((event, ctx) => {
    if (
      (event.action === "FINALIZADO" &&
        (event.submission.id !== event.submissionId ||
          event.submission.projectId !== event.projectId)) ||
      (event.action === "PUBLICADO" &&
        (event.publicProject.id !== event.projectId ||
          event.publicProject.publishedAt !== event.createdAt))
    )
      ctx.addIssue({
        code: "custom",
        message: "Decisão de publicação com referências incompatíveis.",
      });
  });
export type PublicationDecision = z.infer<typeof publicationDecisionSchema>;
export type NewPublicationDecision = PublicationDecision extends infer E
  ? E extends PublicationDecision
    ? Omit<E, "id">
    : never
  : never;
export const publicationHistorySchema = z
  .array(publicationDecisionSchema)
  .superRefine((events, ctx) => {
    const ids = new Set<number>();
    const last = new Map<number, PublicationDecision>();
    for (const event of events) {
      const previous = last.get(event.projectId);
      if (
        ids.has(event.id) ||
        (event.action === "FINALIZADO"
          ? !!previous
          : !previous ||
            previous.submissionId !== event.submissionId ||
            (event.action === "PUBLICADO"
              ? previous.action === "PUBLICADO"
              : previous.action !== "PUBLICADO"))
      )
        ctx.addIssue({
          code: "custom",
          message: "Histórico de publicação inválido.",
        });
      ids.add(event.id);
      last.set(event.projectId, event);
    }
  });

export interface PublicationManagement {
  status: string;
  submissionId: number | null;
  canFinalize: boolean;
  canPublish: boolean;
  reason: string | null;
  materials: {
    id: number;
    versionId: number;
    versionNumber: number;
    kind: string;
    title: string;
  }[];
  history: {
    id: number;
    action: PublicationDecision["action"];
    actorId: number;
    createdAt: string;
    authorizationReference?: string;
  }[];
}

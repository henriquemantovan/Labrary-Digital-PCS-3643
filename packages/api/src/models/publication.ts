import { z } from "zod";
const id = z.number().int().positive().safe();

/** C4: projeção pública estrita. Nenhum modelo privado deve ser serializado por spread. */
export const publicProjectSchema = z
  .object({
    id,
    title: z.string().min(1).max(200),
    description: z.string().max(10000),
    academicYear: z.number().int().min(2000).max(2200),
    class: z.object({ id, name: z.string().min(1).max(120) }).strict(),
    category: z.string().min(1).max(100),
    publicationStatus: z.literal("PUBLICADO"),
    publishedAt: z.iso.datetime(),
    materials: z.array(
      z
        .object({
          id,
          versionId: id,
          kind: z.enum(["VIDEO", "RELATORIO", "MANUAL", "OUTRO"]),
          title: z.string().min(1).max(200),
          mimeType: z.enum([
            "video/mp4",
            "video/webm",
            "application/pdf",
            "application/zip",
            "image/png",
            "image/jpeg",
          ]),
          sizeBytes: z.number().int().positive().safe(),
          contentUrl: z
            .string()
            .regex(/^\/api\/catalog\/[1-9]\d*\/materials\/[1-9]\d*\/file$/),
        })
        .strict(),
    ),
  })
  .strict()
  .superRefine((project, ctx) => {
    const ids = new Set<number>();
    for (const material of project.materials) {
      if (
        ids.has(material.versionId) ||
        material.contentUrl !==
          `/api/catalog/${project.id}/materials/${material.versionId}/file`
      )
        ctx.addIssue({
          code: "custom",
          message:
            "Versão duplicada ou endereço público incompatível com o projeto.",
        });
      ids.add(material.versionId);
    }
  });
export type PublicProject = z.infer<typeof publicProjectSchema>;
export interface CatalogFilter {
  q?: string;
  academicYear?: number;
  classId?: number;
  category?: string;
}
/** Porta a conectar na S6. Retirada deve afetar listagem, detalhe e bytes. */
export interface PublicPublicationProvider {
  list(filter: CatalogFilter): Promise<PublicProject[]>;
  get(projectId: number): Promise<PublicProject | undefined>;
}

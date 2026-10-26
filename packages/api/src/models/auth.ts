import { z } from "zod";

const optionalUspString = z
  .string()
  .nullish()
  .transform((value) => value ?? undefined);
export const affiliationSchema = z.object({
  tipoVinculo: z.string(),
  nomeVinculo: optionalUspString,
  tipoFuncao: optionalUspString,
  codigoUnidade: z
    .union([z.string(), z.number()])
    .nullish()
    .transform((value) => (value == null ? undefined : String(value))),
  nomeUnidade: optionalUspString,
});
export type UspAffiliation = z.infer<typeof affiliationSchema>;
export const roles = ["ALUNO", "AVALIADOR", "PROFESSOR"] as const;
const id = z.number().int().positive();
export const directorySchema = z
  .object({
    users: z.array(
      z
        .object({
          id,
          fullName: z.string().trim().min(1).max(160),
          email: z
            .email()
            .max(254)
            .transform((value) => value.toLowerCase()),
          passwordHash: z
            .string()
            .regex(/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/)
            .nullable(),
          uspNumber: z.string().optional(),
          uspAffiliations: z.array(affiliationSchema).optional(),
          role: z.enum(roles),
          active: z.boolean(),
        })
        .strict(),
    ),
    classes: z.array(
      z
        .object({
          id,
          name: z.string().min(1),
          academicYear: z.number().int(),
          professorId: id,
        })
        .strict(),
    ),
    groups: z.array(
      z
        .object({
          id,
          classId: id,
          name: z.string().min(1),
          memberIds: z.array(id),
        })
        .strict(),
    ),
    assignments: z.array(z.object({ projectId: id, evaluatorId: id }).strict()),
  })
  .strict()
  .superRefine((data, ctx) => {
    const fail = () =>
      ctx.addIssue({
        code: "custom",
        message:
          "Identificadores duplicados ou vínculos inválidos no diretório.",
      });
    for (const rows of [data.users, data.classes, data.groups]) {
      if (new Set(rows.map((row) => row.id)).size !== rows.length) fail();
    }
    if (
      new Set(data.users.map((user) => user.email)).size !== data.users.length
    )
      fail();
    const hasRole = (userId: number, role: string) =>
      data.users.some((user) => user.id === userId && user.role === role);
    if (data.classes.some((item) => !hasRole(item.professorId, "PROFESSOR")))
      fail();
    if (
      data.groups.some(
        (group) =>
          !data.classes.some((item) => item.id === group.classId) ||
          group.memberIds.some((userId) => !hasRole(userId, "ALUNO")),
      )
    )
      fail();
    if (
      data.assignments.some((item) => !hasRole(item.evaluatorId, "AVALIADOR"))
    )
      fail();
  });

export type Directory = z.infer<typeof directorySchema>;
export type User = Directory["users"][number];
export type PublicUser = Omit<User, "passwordHash" | "active">;
export function publicUser(user: User): PublicUser {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    ...(user.uspNumber
      ? { uspNumber: user.uspNumber, uspAffiliations: user.uspAffiliations }
      : {}),
  };
}

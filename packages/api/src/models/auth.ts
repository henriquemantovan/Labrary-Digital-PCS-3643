import { z } from "zod";

export const academicRoles = ["ALUNO", "AVALIADOR", "PROFESSOR"] as const;
export type AcademicRole = (typeof academicRoles)[number];
export const roles = [...academicRoles, "ADMIN"] as const;
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
          googleLinked: z.boolean().optional(),
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
      data.users.some(
        (user) =>
          user.id === userId && (user.role === role || user.role === "ADMIN"),
      );
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
export type PublicUser = Omit<User, "passwordHash" | "active"> & {
  viewRole?: AcademicRole;
};
export function publicUser(user: User, viewRole?: AcademicRole): PublicUser {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    ...(user.role === "ADMIN" && viewRole ? { viewRole } : {}),
    ...(user.googleLinked ? { googleLinked: true } : {}),
  };
}

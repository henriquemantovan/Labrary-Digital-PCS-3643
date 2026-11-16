import { ApiError } from "../errors.js";
import { User } from "../models/auth.js";
import { AuthRepository } from "./authRepository.js";
export type ManagedUser = Pick<
  User,
  "id" | "fullName" | "email" | "role" | "active"
>;
export interface AdminRepository {
  listUsers(): Promise<ManagedUser[]>;
  changeRole(
    actorId: number,
    targetId: number,
    role: User["role"],
    now: number,
  ): Promise<ManagedUser>;
}
export const managedUser = ({
  id,
  fullName,
  email,
  role,
  active,
}: User): ManagedUser => ({ id, fullName, email, role, active });
export function assertRoleChange(
  actor: Pick<User, "role" | "active"> | undefined,
  target: Pick<User, "role" | "active"> | undefined,
  role: User["role"],
  activeAdmins: number,
) {
  if (!actor?.active || actor.role !== "ADMIN")
    throw new ApiError(
      403,
      "ADMIN_REQUIRED",
      "Apenas administradores podem realizar esta ação.",
    );
  if (!target)
    throw new ApiError(404, "USER_NOT_FOUND", "Usuário não encontrado.");
  if (
    target.active &&
    target.role === "ADMIN" &&
    role !== "ADMIN" &&
    activeAdmins <= 1
  )
    throw new ApiError(
      409,
      "LAST_ADMIN",
      "Não é possível remover o último administrador ativo.",
    );
}
export function createMemoryAdminRepository(
  auth: AuthRepository,
): AdminRepository {
  return {
    async listUsers() {
      return auth.directory.users.map(managedUser).sort((a, b) => a.id - b.id);
    },
    async changeRole(actorId, targetId, role) {
      const actor = auth.findById(actorId),
        target = auth.findById(targetId);
      assertRoleChange(
        actor,
        target,
        role,
        auth.directory.users.filter((u) => u.active && u.role === "ADMIN")
          .length,
      );
      target!.role = role;
      return managedUser(target!);
    },
  };
}

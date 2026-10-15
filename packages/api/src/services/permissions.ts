import { ApiError } from "../errors.js";
import { User } from "../models/auth.js";
import { Project } from "../models/project.js";
import { AuthRepository } from "../repositories/authRepository.js";

export function createPermissions(auth: AuthRepository) {
  const ownsClass = (user: User, classId: number) =>
    user.role === "PROFESSOR" &&
    auth.directory.classes.some(
      (item) => item.id === classId && item.professorId === user.id,
    );
  const belongsToGroup = (user: User, project: Project) =>
    auth.directory.groups.some(
      (group) =>
        group.id === project.groupId &&
        group.classId === project.classId &&
        group.memberIds.includes(user.id),
    );
  return {
    ownsClass,
    canRead(user: User, project: Project) {
      if (user.role === "PROFESSOR") return ownsClass(user, project.classId);
      if (user.role === "ALUNO") return belongsToGroup(user, project);
      return auth.directory.assignments.some(
        (item) => item.projectId === project.id && item.evaluatorId === user.id,
      );
    },
    assertCreate(user: User, classId: number, groupId: number) {
      if (
        !ownsClass(user, classId) ||
        !auth.directory.groups.some(
          (group) => group.id === groupId && group.classId === classId,
        )
      ) {
        throw new ApiError(
          403,
          "FORBIDDEN",
          "Você não tem permissão para esta ação.",
        );
      }
    },
    assertUpload(user: User, project: Project) {
      if (user.role !== "ALUNO" || !belongsToGroup(user, project)) {
        throw new ApiError(
          403,
          "FORBIDDEN",
          "Você não tem permissão para esta ação.",
        );
      }
      if (project.status !== "PREPARACAO" && project.status !== "AJUSTES") {
        throw new ApiError(
          409,
          "PROJECT_LOCKED",
          "Este projeto não está aberto para entregas.",
        );
      }
    },
  };
}

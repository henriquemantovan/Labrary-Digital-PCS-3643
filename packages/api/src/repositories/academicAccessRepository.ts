import { ApiError } from "../errors.js";
import {
  academicProfileInputSchema,
  guestEmailSchema,
  isUspEmail,
  type AcademicProfileInput,
  type GuestInvitation,
} from "../models/academicAccess.js";
import type { User } from "../models/auth.js";
import type { AuthRepository } from "./authRepository.js";
import { isDevelopmentProfileAccount } from "../services/developmentTestAccounts.js";

export interface AcademicAccessRepository {
  isGuest(email: string): Promise<boolean>;
  saveProfile(
    userId: number,
    input: AcademicProfileInput,
    now: number,
  ): Promise<void>;
  listInvitations(): Promise<GuestInvitation[]>;
  invite(actorId: number, email: string, now: number): Promise<GuestInvitation>;
  revoke(actorId: number, invitationId: number, now: number): Promise<void>;
}
export function assertGuestAdministrator(user: User | undefined) {
  if (
    !user?.active ||
    user.role !== "ADMIN" ||
    (user.googleLinked && !isUspEmail(user.email) && !user.guest)
  )
    throw new ApiError(
      403,
      "ADMIN_REQUIRED",
      "Apenas administradores podem autorizar convidados.",
    );
}
export function assertAcademicStudent(user: User | undefined, developmentTestLogin = false) {
  if (
    !user?.active ||
    user.role !== "ALUNO" ||
    user.guest ||
    !((user.googleLinked && isUspEmail(user.email)) ||
      (developmentTestLogin && isDevelopmentProfileAccount(user)))
  )
    throw new ApiError(
      403,
      "ACADEMIC_PROFILE_UNAVAILABLE",
      "O cadastro acadêmico é exclusivo dos alunos com conta USP.",
    );
}
export const duplicatedUspNumber = () =>
  new ApiError(
    409,
    "USP_NUMBER_IN_USE",
    "Este NUSP já está vinculado a outra conta. Contate o responsável.",
  );
export function createMemoryAcademicAccessRepository(
  auth: AuthRepository,
): AcademicAccessRepository {
  const invitations: GuestInvitation[] = [];
  return {
    async isGuest(email) {
      return invitations.some(
        (item) => item.email === email.toLowerCase() && !item.revokedAt,
      );
    },
    async saveProfile(userId, input, now) {
      const user = auth.findById(userId);
      assertAcademicStudent(user, auth.developmentTestLogin);
      const parsed = academicProfileInputSchema(now).parse(input);
      if (
        auth.directory.users.some(
          (item) => item.id !== userId && item.uspNumber === parsed.uspNumber,
        )
      )
        throw duplicatedUspNumber();
      Object.assign(user!, parsed, { academicProfileCompleted: true });
    },
    async listInvitations() {
      return structuredClone(invitations);
    },
    async invite(actorId, input, now) {
      assertGuestAdministrator(auth.findById(actorId));
      const email = guestEmailSchema.parse(input);
      if (isUspEmail(email))
        throw new ApiError(
          400,
          "GUEST_NOT_REQUIRED",
          "Contas USP não precisam de convite.",
        );
      let invitation = invitations.find(
        (item) => item.email === email && !item.revokedAt,
      );
      if (!invitation) {
        invitation = {
          id: invitations.length + 1,
          email,
          invitedBy: actorId,
          createdAt: new Date(now).toISOString(),
          revokedAt: null,
          revokedBy: null,
        };
        invitations.push(invitation);
      }
      const user = auth.findByEmail(email);
      if (user) user.guest = true;
      return structuredClone(invitation);
    },
    async revoke(actorId, invitationId, now) {
      const actor = auth.findById(actorId);
      assertGuestAdministrator(actor);
      const invitation = invitations.find((item) => item.id === invitationId);
      if (!invitation)
        throw new ApiError(
          404,
          "INVITATION_NOT_FOUND",
          "Convite não encontrado.",
        );
      if (actor!.email === invitation.email)
        throw new ApiError(
          409,
          "OWN_INVITATION",
          "Outro administrador deve revogar seu acesso de convidado.",
        );
      if (!invitation.revokedAt) {
        invitation.revokedAt = new Date(now).toISOString();
        invitation.revokedBy = actorId;
        const user = auth.findByEmail(invitation.email);
        if (user) user.guest = false;
      }
    },
  };
}

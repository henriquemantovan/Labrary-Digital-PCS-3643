import { ApiError } from "../errors.js";
import { User } from "../models/auth.js";
import { Project } from "../models/project.js";
import {
  CatalogFilter,
  PublicProject,
  publicProjectSchema,
} from "../models/publication.js";
import { PublicationManagement } from "../models/publicationDecision.js";
import { Submission, submissionSchema } from "../models/submission.js";
import { AuthRepository } from "../repositories/authRepository.js";
import { ProjectRepository } from "../repositories/projectRepository.js";
import { createPermissions } from "./permissions.js";
import { FileStorage } from "./fileStorage.js";
import {
  PublicationProviders,
  publicationCompletenessSchema,
} from "./publicationProviders.js";
const unavailable = () =>
  new ApiError(
    503,
    "PUBLICATION_INTEGRATION_UNAVAILABLE",
    "Finalização e publicação indisponíveis enquanto a integração das entregas e avaliações não estiver concluída.",
  );
const notReady = () =>
  new ApiError(
    409,
    "PUBLICATION_NOT_READY",
    "A finalização exige uma entrega completa e todas as avaliações concluídas.",
  );
const conflict = () =>
  new ApiError(
    409,
    "PUBLICATION_VERSION_CONFLICT",
    "A rodada ou seus vínculos mudaram. Recarregue os dados antes de continuar.",
  );
const sameIds = (a: number[], b: number[]) =>
  a.length === b.length && a.every((id) => b.includes(id));
export function createPublicationService(
  projects: ProjectRepository,
  auth: AuthRepository,
  storage: FileStorage,
  now: () => number,
  providers?: PublicationProviders,
) {
  const permissions = createPermissions(auth);
  const locks = new Map<number, Promise<unknown>>();
  function serialized<T>(id: number, action: () => Promise<T>): Promise<T> {
    const pending = (locks.get(id) ?? Promise.resolve())
      .catch(() => undefined)
      .then(action);
    locks.set(id, pending);
    return pending.finally(() => {
      if (locks.get(id) === pending) locks.delete(id);
    });
  }
  const managed = (id: number, user: User) => {
    if (!["PROFESSOR", "ADMIN"].includes(user.role))
      throw new ApiError(
        403,
        "FORBIDDEN",
        "Você não tem permissão para esta ação.",
      );
    const project = projects.get(id);
    if (!project || !permissions.ownsClass(user, project.classId))
      throw new ApiError(404, "PROJECT_NOT_FOUND", "Projeto não encontrado.");
    return project;
  };
  const history = (id: number) => projects.publicationHistory(id);
  const finalized = (id: number) =>
    history(id).find((event) => event.action === "FINALIZADO");
  async function fromProvider<T>(read: () => Promise<T>): Promise<T> {
    try {
      return await read();
    } catch {
      throw unavailable();
    }
  }
  async function ready(project: Project): Promise<Submission> {
    if (!providers) throw unavailable();
    const input = await fromProvider(() =>
      providers.submissions.latest(project.id),
    );
    if (!input) throw notReady();
    const parsed = submissionSchema.safeParse(input);
    if (!parsed.success) throw notReady();
    const submission = parsed.data;
    if (
      submission.projectId !== project.id ||
      submission.status !== "SUBMETIDA" ||
      submission.rubric.classId !== project.classId
    )
      throw notReady();
    const status = publicationCompletenessSchema.safeParse(
      await fromProvider(() =>
        providers.evaluations.completeness(project.id, submission.id),
      ),
    );
    if (!status.success) throw notReady();
    const evaluations = status.data;
    const expected = auth.directory.assignments
      .filter((link) => link.projectId === project.id)
      .map((link) => link.evaluatorId);
    if (
      evaluations.projectId !== project.id ||
      evaluations.submissionId !== submission.id ||
      evaluations.round !== submission.round ||
      evaluations.rubricVersionId !== submission.rubricVersionId
    )
      throw conflict();
    if (
      !expected.length ||
      !sameIds(expected, evaluations.expectedEvaluatorIds) ||
      !sameIds(expected, evaluations.completedEvaluatorIds) ||
      !evaluations.allEvaluationsCompleted
    )
      throw notReady();
    for (const requirement of submission.rubric.requirements) {
      const material = submission.materials.find(
        (material) => material.kind === requirement.kind,
      );
      if (
        !material ||
        !requirement.allowedMimeTypes.includes(material.mimeType) ||
        material.sizeBytes > requirement.maxSizeBytes
      )
        throw notReady();
    }
    for (const material of submission.materials) {
      const stored = projects.getMaterial(project.id, material.materialId);
      const version = stored?.versions.find(
        (version) => version.id === material.versionId,
      );
      if (
        !version ||
        stored!.kind !== material.kind ||
        stored!.title !== material.title ||
        version.versionNumber !== material.versionNumber ||
        version.mimeType !== material.mimeType ||
        version.sizeBytes !== material.sizeBytes ||
        version.originalFilename !== material.originalFilename ||
        version.checksumSha256 !== material.checksumSha256
      )
        throw conflict();
      const file = await storage.open(version.storageKey);
      if (!file) throw notReady();
      file.stream.on("error", () => undefined).destroy();
      if (file.sizeBytes !== material.sizeBytes) throw notReady();
    }
    const currentExpected = auth.directory.assignments
      .filter((link) => link.projectId === project.id)
      .map((link) => link.evaluatorId);
    if (!sameIds(expected, currentExpected)) throw conflict();
    const latest = projects.get(project.id);
    if (
      !latest ||
      latest.status !== project.status ||
      latest.updatedAt !== project.updatedAt
    )
      throw conflict();
    return submission;
  }
  async function current(project: Project) {
    const submission = await ready(project);
    const previous = finalized(project.id);
    if (
      previous &&
      JSON.stringify(previous.submission) !== JSON.stringify(submission)
    )
      throw conflict();
    return submission;
  }
  const active = (id: number): PublicProject | undefined => {
    if (projects.get(id)?.status !== "FINALIZADO") return undefined;
    const last = history(id).at(-1);
    return last?.action === "PUBLICADO"
      ? structuredClone(last.publicProject)
      : undefined;
  };
  return {
    async management(id: number, user: User): Promise<PublicationManagement> {
      const project = managed(id, user),
        events = history(id),
        final = finalized(id),
        last = events.at(-1);
      let reason: string | null = null,
        submission: Submission | undefined;
      try {
        submission =
          last?.action === "PUBLICADO"
            ? final?.submission
            : await current(project);
      } catch (error) {
        if (!(error instanceof ApiError)) throw error;
        reason = error.message;
      }
      const isFinal = project.status === "FINALIZADO" && !!final;
      return {
        status: last?.action ?? project.status,
        submissionId: submission?.id ?? final?.submissionId ?? null,
        canFinalize: !reason && !final && project.status === "EM_AVALIACAO",
        canPublish: !reason && isFinal && last?.action !== "PUBLICADO",
        reason:
          reason ??
          (!isFinal && project.status !== "EM_AVALIACAO"
            ? "Aguarde a submissão do projeto para avaliação."
            : null),
        materials: (
          final?.submission.materials ??
          submission?.materials ??
          []
        ).map((material) => ({
          id: material.materialId,
          versionId: material.versionId,
          versionNumber: material.versionNumber,
          kind: material.kind,
          title: material.title,
        })),
        history: events.map((event) => ({
          id: event.id,
          action: event.action,
          actorId: event.actorId,
          createdAt: event.createdAt,
          ...(event.action === "PUBLICADO"
            ? { authorizationReference: event.groupAuthorization.reference }
            : {}),
        })),
      };
    },
    finalize(id: number, user: User, actorId: number, submissionId: number) {
      return serialized(id, async () => {
        const project = managed(id, user);
        const submission = await current(project);
        if (submission.id !== submissionId) throw conflict();
        const previous = finalized(id);
        if (previous) return previous;
        if (project.status !== "EM_AVALIACAO") throw notReady();
        managed(id, user);
        return projects.recordPublicationDecision({
          action: "FINALIZADO",
          projectId: id,
          submissionId,
          actorId,
          createdAt: new Date(now()).toISOString(),
          submission,
        });
      });
    },
    publish(
      id: number,
      user: User,
      actorId: number,
      input: {
        submissionId: number;
        materialVersionIds: number[];
        groupAuthorization: { confirmed: true; reference: string };
      },
    ) {
      return serialized(id, async () => {
        const project = managed(id, user);
        if (project.status !== "FINALIZADO" || !finalized(id)) throw notReady();
        const submission = await current(project);
        if (submission.id !== input.submissionId) throw conflict();
        const versions = submission.materials.filter((material) =>
          input.materialVersionIds.includes(material.versionId),
        );
        if (versions.length !== input.materialVersionIds.length)
          throw conflict();
        const course = auth.directory.classes.find(
          (item) => item.id === project.classId,
        )!;
        const timestamp = new Date(now()).toISOString();
        const dto = publicProjectSchema.parse({
          id,
          title: project.title,
          description: project.description,
          academicYear: course.academicYear,
          class: { id: course.id, name: course.name },
          category: project.category,
          publicationStatus: "PUBLICADO",
          publishedAt: timestamp,
          materials: versions.map((material) => ({
            id: material.materialId,
            versionId: material.versionId,
            kind: material.kind,
            title: material.title,
            mimeType: material.mimeType,
            sizeBytes: material.sizeBytes,
            contentUrl: `/api/catalog/${id}/materials/${material.versionId}/file`,
          })),
        });
        const last = history(id).at(-1);
        if (last?.action === "PUBLICADO") {
          if (
            sameIds(
              last.publicProject.materials.map((item) => item.versionId),
              input.materialVersionIds,
            ) &&
            last.groupAuthorization.reference ===
              input.groupAuthorization.reference
          )
            return last;
          throw new ApiError(
            409,
            "PUBLICATION_ALREADY_ACTIVE",
            "Retire a publicação atual antes de alterar os materiais autorizados.",
          );
        }
        managed(id, user);
        return projects.recordPublicationDecision({
          action: "PUBLICADO",
          projectId: id,
          submissionId: submission.id,
          actorId,
          createdAt: timestamp,
          groupAuthorization: {
            groupId: project.groupId,
            reference: input.groupAuthorization.reference,
          },
          publicProject: dto,
        });
      });
    },
    withdraw(id: number, user: User, actorId: number) {
      return serialized(id, async () => {
        managed(id, user);
        const last = history(id).at(-1);
        if (last?.action !== "PUBLICADO") return;
        projects.recordPublicationDecision({
          action: "RETIRADO",
          projectId: id,
          submissionId: last.submissionId,
          actorId,
          createdAt: new Date(now()).toISOString(),
        });
      });
    },
    async list(filter: CatalogFilter) {
      const query = (filter.q ?? "").trim().toLocaleLowerCase("pt-BR");
      return projects
        .list({})
        .map((project) => active(project.id))
        .filter((item): item is PublicProject => !!item)
        .filter(
          (project) =>
            project.title.toLocaleLowerCase("pt-BR").includes(query) &&
            (filter.academicYear === undefined ||
              filter.academicYear === project.academicYear) &&
            (filter.classId === undefined ||
              filter.classId === project.class.id) &&
            (filter.category === undefined ||
              filter.category === project.category),
        );
    },
    async get(id: number) {
      return active(id);
    },
    publicVersion(id: number, versionId: number) {
      const publication = active(id);
      const material = publication?.materials.find(
        (item) => item.versionId === versionId,
      );
      const version =
        material &&
        projects
          .getMaterial(id, material.id)
          ?.versions.find((item) => item.id === versionId);
      if (
        !material ||
        !version ||
        version.sizeBytes !== material.sizeBytes ||
        version.mimeType !== material.mimeType
      )
        throw new ApiError(
          404,
          "PUBLICATION_NOT_FOUND",
          "Publicação não encontrada.",
        );
      return version;
    },
  };
}
export type PublicationService = ReturnType<typeof createPublicationService>;

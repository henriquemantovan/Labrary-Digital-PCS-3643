import { ApiError } from "../errors.js";
import { Directory } from "../models/auth.js";
import { LinkChange } from "../models/group.js";

type Awaitable<T> = T | Promise<T>;
export type Group = Directory["groups"][number];
export interface GroupSnapshot {
  groups: Group[];
  assignments: Directory["assignments"];
  changes: LinkChange[];
}
export interface GroupStorage {
  load(): GroupSnapshot | undefined;
  save(snapshot: GroupSnapshot): void;
}
export interface GroupRepository {
  createGroup(classId: number, name: string, actorId: number): Awaitable<Group>;
  setLinks(
    classId: number,
    change: Omit<LinkChange, "before">,
  ): Awaitable<void>;
  history(
    target: LinkChange["target"],
    targetId: number,
  ): Awaitable<LinkChange[]>;
}
export function assertPeople(
  directory: Directory,
  ids: number[],
  target: LinkChange["target"],
) {
  const role = target === "GROUP" ? "ALUNO" : "AVALIADOR";
  if (
    ids.some(
      (id) =>
        !directory.users.some(
          (user) =>
            user.id === id &&
            user.active &&
            (user.role === role || user.role === "ADMIN"),
        ),
    )
  )
    throw new ApiError(
      400,
      "INVALID_LINK",
      "Selecione contas ativas do perfil correto.",
    );
}
export function createMemoryGroupRepository(
  directory: Directory,
  storage?: GroupStorage,
): GroupRepository {
  let changes: LinkChange[] = [];
  const saved = storage?.load();
  if (saved) {
    directory.groups = saved.groups;
    directory.assignments = saved.assignments;
    changes = saved.changes;
  }
  const commit = (snapshot: GroupSnapshot) => {
    storage?.save(snapshot);
    directory.groups = snapshot.groups;
    directory.assignments = snapshot.assignments;
    changes = snapshot.changes;
  };
  return {
    createGroup(classId, name) {
      if (
        directory.groups.some(
          (group) => group.classId === classId && group.name === name,
        )
      )
        throw new ApiError(
          409,
          "GROUP_EXISTS",
          "Já existe um grupo com este nome na turma.",
        );
      const group = {
        id: Math.max(0, ...directory.groups.map((group) => group.id)) + 1,
        classId,
        name,
        memberIds: [],
      };
      commit({
        groups: [...directory.groups, group],
        assignments: directory.assignments,
        changes,
      });
      return structuredClone(group);
    },
    setLinks(classId, input) {
      assertPeople(directory, input.after, input.target);
      const group = directory.groups.find(
        (group) => group.id === input.targetId && group.classId === classId,
      );
      if (input.target === "GROUP" && !group)
        throw new ApiError(404, "GROUP_NOT_FOUND", "Grupo não encontrado.");
      const before =
        input.target === "GROUP"
          ? group!.memberIds
          : directory.assignments
              .filter((link) => link.projectId === input.targetId)
              .map((link) => link.evaluatorId);
      if (
        before.length === input.after.length &&
        before.every((id) => input.after.includes(id))
      )
        return;
      const change = structuredClone({ ...input, before });
      commit({
        groups:
          input.target === "GROUP"
            ? directory.groups.map((group) =>
                group.id === input.targetId
                  ? { ...group, memberIds: [...input.after] }
                  : group,
              )
            : directory.groups,
        assignments:
          input.target === "PROJECT"
            ? [
                ...directory.assignments.filter(
                  (link) => link.projectId !== input.targetId,
                ),
                ...input.after.map((evaluatorId) => ({
                  projectId: input.targetId,
                  evaluatorId,
                })),
              ]
            : directory.assignments,
        changes: [...changes, change],
      });
    },
    history(target, targetId) {
      return structuredClone(
        changes.filter(
          (change) => change.target === target && change.targetId === targetId,
        ),
      );
    },
  };
}

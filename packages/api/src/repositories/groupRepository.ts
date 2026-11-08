import { LinkChange } from "../models/group.js";

export function createMemoryGroupRepository() {
  const changes: LinkChange[] = [];
  return {
    recordChange(change: LinkChange) { changes.push(structuredClone(change)); },
    history(target: LinkChange["target"], targetId: number) {
      return structuredClone(changes.filter(item => item.target === target && item.targetId === targetId));
    },
  };
}
export type GroupRepository = ReturnType<typeof createMemoryGroupRepository>;

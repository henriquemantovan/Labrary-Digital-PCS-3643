import { User } from "./auth.js";

export interface ProjectMessage {
  id: number;
  projectId: number;
  clientMessageId: string;
  author: Pick<User, "id" | "fullName" | "role">;
  body: string;
  createdAt: string;
  materialVersion: { id: number; title: string; versionNumber: number } | null;
}
export type NewMessage = Omit<ProjectMessage, "id">;

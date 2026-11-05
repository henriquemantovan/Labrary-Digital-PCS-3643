export interface Requirement {
  kind: "VIDEO" | "RELATORIO" | "MANUAL";
  label: string;
  required: true;
  allowedMimeTypes: string[];
  maxSizeBytes: number;
  dueAt: string;
}
export interface Criterion {
  title: string;
  description: string;
  weight: number;
  minScore: 0;
  maxScore: 10;
}
export interface RubricVersion {
  id: number;
  classId: number;
  projectId: number;
  versionNumber: number;
  title: string;
  criteria: Criterion[];
  createdBy: number;
  createdAt: string;
}
export interface LinkChange {
  target: "GROUP" | "PROJECT";
  targetId: number;
  before: number[];
  after: number[];
  changedBy: number;
  changedAt: string;
}

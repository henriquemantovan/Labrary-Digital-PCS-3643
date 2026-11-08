export interface RubricCriterion {
  id: string;
  title: string;
  description: string;
  weight: number;
  minScore: 0;
  maxScore: 10;
}
export interface Requirement {
  kind: "VIDEO" | "RELATORIO" | "MANUAL";
  label: string;
  required: true;
  allowedMimeTypes: string[];
  maxSizeBytes: number;
  dueAt: string;
}
export interface RubricVersion {
  id: number;
  classId: number;
  projectId: number;
  versionNumber: number;
  title: string;
  requirements: Requirement[];
  criteria: RubricCriterion[];
  createdBy: number;
  createdAt: string;
}

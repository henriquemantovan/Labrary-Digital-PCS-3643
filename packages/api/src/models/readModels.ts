// Contratos consumidores provisórios C3/C4; produtores devem confirmar antes do aceite.
export interface GroupResult {
  projectId: number;
  groupId: number;
  round: number;
  expected: number;
  received: number;
  pending: number;
  complete: boolean;
  released: boolean;
  grade: number | null;
  rubricVersionId: string;
  criteria: { title: string; weight: number; grade: number | null; comment: string }[];
}
export interface PublicProject {
  id: number;
  title: string;
  description: string;
  year: number;
  className: string;
  category: string;
  published: boolean;
  materials: { versionId: number; title: string; kind: "VIDEO" | "RELATORIO" | "MANUAL"; url: string }[];
}
export interface ReadProviders {
  result?: { get(projectId: number): Promise<GroupResult | null> };
  publications?: { list(): Promise<PublicProject[]>; get(id: number): Promise<PublicProject | null> };
}

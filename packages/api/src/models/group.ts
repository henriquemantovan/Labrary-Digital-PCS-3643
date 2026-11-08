export interface LinkChange {
  target: "GROUP" | "PROJECT";
  targetId: number;
  before: number[];
  after: number[];
  changedBy: number;
  changedAt: string;
}

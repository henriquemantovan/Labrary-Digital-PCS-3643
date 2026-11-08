import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { publicProjectSchema } from "./publication.js";
const example = JSON.parse(
  readFileSync(
    new URL("../../../../docs/contratos/c4-exemplo.json", import.meta.url),
    "utf8",
  ),
);
describe("C4 — contrato público", () => {
  it("valida o exemplo compartilhado com o catálogo e permite publicação sem materiais", () => {
    expect(publicProjectSchema.parse(example)).toEqual(example);
    expect(
      publicProjectSchema.parse({ ...example, materials: [] }),
    ).toMatchObject({ materials: [] });
  });
  it("rejeita campos privados em todos os níveis e estados sem publicação", () => {
    for (const field of [
      "storageKey",
      "messages",
      "grade",
      "memberIds",
      "evaluations",
      "submissionId",
    ])
      expect(
        publicProjectSchema.safeParse({ ...example, [field]: "privado" })
          .success,
      ).toBe(false);
    expect(
      publicProjectSchema.safeParse({
        ...example,
        class: { ...example.class, professorId: 1 },
      }).success,
    ).toBe(false);
    expect(
      publicProjectSchema.safeParse({
        ...example,
        materials: [{ ...example.materials[0], storageKey: "segredo" }],
      }).success,
    ).toBe(false);
    for (const publicationStatus of ["RETIRADO", "FINALIZADO", "PREPARACAO"])
      expect(
        publicProjectSchema.safeParse({ ...example, publicationStatus })
          .success,
      ).toBe(false);
  });
  it("vincula o endereço ao projeto e à versão e rejeita duplicatas e URLs privadas", () => {
    for (const contentUrl of [
      "/api/projects/17/materials/61/file",
      "https://storage.example/segredo",
      "/api/catalog/18/materials/61/file",
      "/api/catalog/17/materials/99/file",
    ])
      expect(
        publicProjectSchema.safeParse({
          ...example,
          materials: [{ ...example.materials[0], contentUrl }],
        }).success,
      ).toBe(false);
    expect(
      publicProjectSchema.safeParse({
        ...example,
        materials: [example.materials[0], example.materials[0]],
      }).success,
    ).toBe(false);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import example from "../../../docs/contratos/c4-exemplo.json";
import {
  filterCatalog,
  httpCatalog,
  parsePublicProject,
} from "./catalogClient";
import { catalogExamples, demoCatalog } from "./fixtures/catalog";

afterEach(() => vi.unstubAllGlobals());
const response = (data: unknown, status = 200) =>
  new Response(JSON.stringify({ data }), { status });

describe("consumidor C4", () => {
  it("aceita o mesmo exemplo do produtor, rejeitando dados privados e URLs não autorizadas", () => {
    expect(parsePublicProject(example)).toEqual(example);
    for (const invalid of [
      { ...example, grade: 9 },
      { ...example, publicationStatus: "RETIRADO" },
      { ...example, class: { ...example.class, email: "privado" } },
      {
        ...example,
        materials: [{ ...example.materials[0], storageKey: "segredo" }],
      },
      {
        ...example,
        materials: [
          { ...example.materials[0], contentUrl: "javascript:alert(1)" },
        ],
      },
      {
        ...example,
        materials: [
          {
            ...example.materials[0],
            contentUrl: "/api/catalog/18/materials/61/file",
          },
        ],
      },
    ])
      expect(() => parsePublicProject(invalid)).toThrow(/incompatíveis/);
  });
  it("combina filtros por AND e busca somente no título, sem diferenciar caixa", async () => {
    expect(
      filterCatalog(catalogExamples, {
        q: "  SEMÁFORO ",
        academicYear: 2026,
        classId: 3,
        category: "Sistemas digitais",
      }),
    ).toEqual([catalogExamples[0]]);
    expect(filterCatalog(catalogExamples, { q: "pedestres" })).toEqual([]);
    expect(filterCatalog(catalogExamples, { academicYear: 2025 })).toEqual([
      catalogExamples[2],
    ]);
    expect(filterCatalog(catalogExamples, { classId: 4 })).toEqual([
      catalogExamples[2],
    ]);
    expect(
      filterCatalog(catalogExamples, { category: "Instrumentação" }),
    ).toEqual([catalogExamples[1]]);
    expect(await demoCatalog.list({ q: "monitor" })).toEqual([
      catalogExamples[1],
    ]);
    const project = await demoCatalog.get(17);
    project!.title = "alterado";
    expect((await demoCatalog.get(17))!.title).toBe(example.title);
    expect(await demoCatalog.get(999)).toBeUndefined();
  });
  it("serializa os filtros, mantém no-store e valida lista e detalhe HTTP", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response([example]))
      .mockResolvedValueOnce(response(example))
      .mockResolvedValueOnce(response([]));
    vi.stubGlobal("fetch", fetch);
    expect(
      await httpCatalog.list({
        q: " semáforo ",
        academicYear: 2026,
        classId: 3,
        category: "Sistemas digitais",
      }),
    ).toEqual([example]);
    expect(fetch).toHaveBeenCalledWith(
      "/api/catalog?q=sem%C3%A1foro&academicYear=2026&classId=3&category=Sistemas+digitais",
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(await httpCatalog.get(17)).toEqual(example);
    expect(await httpCatalog.list({})).toEqual([]);
    expect(fetch).toHaveBeenLastCalledWith("/api/catalog", expect.anything());
  });
  it("não troca falhas HTTP, dados inválidos ou retirada por fixtures", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response(null, 404))
      .mockResolvedValueOnce(response(null, 503))
      .mockResolvedValueOnce(response(null))
      .mockResolvedValueOnce(response([{ ...example, messages: [] }]))
      .mockResolvedValueOnce(response({ ...example, id: 18, materials: [] }))
      .mockRejectedValueOnce(new Error("offline"));
    vi.stubGlobal("fetch", fetch);
    expect(await httpCatalog.get(17)).toBeUndefined();
    await expect(httpCatalog.get(17)).rejects.toThrow();
    await expect(httpCatalog.list({})).rejects.toThrow(/lista inválida/);
    await expect(httpCatalog.list({})).rejects.toThrow(/incompatíveis/);
    await expect(httpCatalog.get(17)).rejects.toThrow(/outro projeto/);
    await expect(httpCatalog.list({})).rejects.toThrow(/conectar/);
  });
});

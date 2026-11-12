import { afterEach, expect, it, vi } from "vitest";
import { downloadGrades } from "./gradeClient";
afterEach(() => vi.unstubAllGlobals());
it("baixa CSV com cookie e sem cache", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response("Grupo,Nota\r\nA,8.06\r\n", { headers: { "Content-Type": "text/csv" } }));
  vi.stubGlobal("fetch", fetcher);
  const blob = await downloadGrades(1);
  const content = await new Promise<string>(resolve => {
    const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsText(blob);
  });
  expect(content).toContain("A,8.06");
  expect(fetcher).toHaveBeenCalledWith("/api/classes/1/grades?format=csv", { credentials: "same-origin", cache: "no-store" });
});
it("preserva status da sessão e relata falhas recuperáveis", async () => {
  const fetcher = vi.fn().mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: "Entre novamente" } }), { status: 401 }))
    .mockResolvedValueOnce(new Response("inválido", { status: 500 }));
  vi.stubGlobal("fetch", fetcher);
  await expect(downloadGrades(1)).rejects.toMatchObject({ status: 0 });
  await expect(downloadGrades(1)).rejects.toMatchObject({ status: 401, message: "Entre novamente" });
  await expect(downloadGrades(1)).rejects.toThrow("Não foi possível exportar as notas.");
});

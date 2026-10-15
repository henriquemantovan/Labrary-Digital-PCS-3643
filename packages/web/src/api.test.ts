import { afterEach, expect, it, vi } from "vitest";
import { api } from "./api";
afterEach(() => vi.unstubAllGlobals());
it("não persiste credenciais e envia cookie e proteção CSRF", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ data: { id: 1 } })));
  vi.stubGlobal("fetch", fetch);
  expect(await api("/test")).toEqual({ id: 1 });
  expect(fetch).toHaveBeenCalledWith(
    "/api/test",
    expect.objectContaining({
      cache: "no-store",
      credentials: "same-origin",
      headers: expect.objectContaining({ "X-CSRF-Protection": "1" }),
    }),
  );
});
it("trata erros de rede, corpo não JSON e resposta sem corpo", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  await expect(api("/test")).rejects.toThrow("Não foi possível conectar");
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response("bad gateway", { status: 502 })),
  );
  await expect(api("/test")).rejects.toThrow("Não foi possível concluir");
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
  );
  expect(await api("/auth/logout", { method: "POST" })).toBeUndefined();
});

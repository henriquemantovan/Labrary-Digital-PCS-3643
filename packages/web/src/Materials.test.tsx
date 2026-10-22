import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { formatBytes, MaterialsPanel, validateFile } from "./Materials";
import type { Material, MaterialRule, MaterialRules } from "./api";
import { FakeXHR } from "./test/fakeXhr";

const lastRequest = () => FakeXHR.instances[FakeXHR.instances.length - 1];

const pdf = { label: "PDF", mimeType: "application/pdf", extensions: [".pdf"] };
const rule = (overrides: Partial<MaterialRule>): MaterialRule => ({
  kind: "RELATORIO",
  defaultTitle: "Relatório do projeto",
  required: true,
  formats: [pdf],
  maxSizeBytes: 20 * 1024 * 1024,
  ...overrides,
});
const rules: MaterialRules = {
  dueAt: "2026-10-28T23:59:00.000Z",
  lock: null,
  canUpload: true,
  rules: [
    rule({
      kind: "VIDEO",
      defaultTitle: "Vídeo de apresentação",
      formats: [
        { label: "MP4", mimeType: "video/mp4", extensions: [".mp4"] },
        { label: "WebM", mimeType: "video/webm", extensions: [".webm"] },
      ],
      maxSizeBytes: 500 * 1024 * 1024,
    }),
    rule({}),
    rule({ kind: "MANUAL", defaultTitle: "Manual de uso" }),
    rule({
      kind: "OUTRO",
      defaultTitle: "Material complementar",
      required: false,
      maxSizeBytes: 50 * 1024 * 1024,
    }),
  ],
};
const version = (number: number, filename: string) => ({
  id: number,
  versionNumber: number,
  originalFilename: filename,
  mimeType: "application/pdf",
  sizeBytes: 2048,
  uploadedBy: { id: 1, fullName: "Marina Oliveira" },
  uploadedAt: "2026-10-22T15:00:00.000Z",
  downloadUrl: `/api/projects/2/materials/1/versions/${number}/file`,
});
const report: Material = {
  id: 1,
  title: "Relatório do projeto",
  kind: "RELATORIO",
  currentVersion: version(2, "relatorio-v2.pdf"),
  versions: [version(2, "relatorio-v2.pdf"), version(1, "relatorio.pdf")],
};
const pdfFile = (name = "manual.pdf") =>
  new File(["%PDF-1.7 conteúdo"], name, { type: "application/pdf" });

let onSaved: Mock<(material: Material) => void>;
let expired: Mock<() => void>;
const renderPanel = (
  materials: Material[] = [],
  overrides: Partial<MaterialRules> = {},
) =>
  render(
    <MaterialsPanel
      projectId={2}
      materials={materials}
      rules={{ ...rules, ...overrides }}
      onSaved={onSaved}
      expired={expired}
    />,
  );
beforeEach(() => {
  FakeXHR.instances = [];
  vi.stubGlobal("XMLHttpRequest", FakeXHR);
  onSaved = vi.fn<(material: Material) => void>();
  expired = vi.fn<() => void>();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("painel de materiais", () => {
  it("lista obrigatórios pendentes com formatos, limite e prazo", () => {
    renderPanel();
    expect(
      screen.getByText(
        "0 de 3 obrigatórios enviados · faltam: Vídeo de apresentação, Relatório do projeto, Manual de uso",
      ),
    ).toBeDefined();
    expect(screen.getByText("MP4, WebM · até 500 MB")).toBeDefined();
    expect(screen.getAllByText("Pendente")).toHaveLength(3);
    expect(screen.getByText(/Prazo de entrega:/)).toBeDefined();
    expect(
      screen.getAllByRole("button", { name: "Enviar arquivo" }),
    ).toHaveLength(3);
  });
  it("envia arquivo novo com tipo antes do arquivo e mostra o progresso", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(
      within(screen.getByText("Manual de uso").closest("li")!).getByRole(
        "button",
        { name: "Enviar arquivo" },
      ),
    );
    await user.upload(
      screen.getByLabelText("Arquivo para Manual de uso"),
      pdfFile(),
    );
    const request = lastRequest();
    expect(request.method).toBe("POST");
    expect(request.url).toBe("/api/projects/2/materials");
    expect(request.headers["X-CSRF-Protection"]).toBe("1");
    expect([...request.body!.keys()]).toEqual(["kind", "file"]);
    expect(request.body!.get("kind")).toBe("MANUAL");
    request.progress(1, 4);
    expect(
      (screen.getByLabelText("Enviando Manual de uso") as HTMLProgressElement)
        .value,
    ).toBe(25);
    expect(screen.getByText("25%")).toBeDefined();
    request.progress(3, 4, false);
    expect(screen.getByText("25%")).toBeDefined();
    const saved = { ...report, id: 3, kind: "MANUAL", title: "Manual de uso" };
    await request.respond(201, { data: saved });
    expect(onSaved).toHaveBeenCalledWith(saved);
    expect(screen.queryByLabelText("Enviando Manual de uso")).toBeNull();
  });
  it("valida no navegador antes de enviar", async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderPanel();
    const input = screen.getByLabelText("Arquivo para Relatório do projeto");
    await user.upload(input, pdfFile("relatorio.docx"));
    expect(screen.getByRole("alert").textContent).toContain(
      "Formato não aceito. Envie PDF.",
    );
    const huge = pdfFile("grande.pdf");
    Object.defineProperty(huge, "size", { value: 21 * 1024 * 1024 });
    await user.upload(input, huge);
    expect(screen.getByRole("alert").textContent).toContain(
      "excede o limite de 20 MB",
    );
    await user.upload(input, new File([], "vazio.pdf"));
    expect(screen.getByRole("alert").textContent).toContain("vazio");
    expect(FakeXHR.instances).toHaveLength(0);
    expect(
      screen.queryByRole("button", { name: "Tentar novamente" }),
    ).toBeNull();
  });
  it("mostra a recusa do servidor e permite tentar novamente", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.upload(
      screen.getByLabelText("Arquivo para Relatório do projeto"),
      pdfFile("relatorio.pdf"),
    );
    await lastRequest().respond(415, {
      error: { message: "Formato não aceito. Envie PDF." },
    });
    expect(screen.getByRole("alert").textContent).toContain(
      "Formato não aceito. Envie PDF.",
    );
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(FakeXHR.instances).toHaveLength(2);
    expect(lastRequest().body!.get("kind")).toBe("RELATORIO");
    await lastRequest().respond(500, "<html>erro</html>");
    expect(screen.getByRole("alert").textContent).toContain(
      "Não foi possível enviar o arquivo. Tente novamente.",
    );
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await lastRequest().fail();
    expect(screen.getByRole("alert").textContent).toContain(
      "Não foi possível conectar",
    );
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await lastRequest().respond(201, { data: report });
    expect(onSaved).toHaveBeenCalledWith(report);
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("cancela o envio e trata sessão expirada", async () => {
    const user = userEvent.setup();
    renderPanel();
    const input = screen.getByLabelText("Arquivo para Relatório do projeto");
    await user.upload(input, pdfFile("relatorio.pdf"));
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Envio cancelado.",
    );
    await user.upload(input, pdfFile("relatorio.pdf"));
    await lastRequest().respond(401, { error: { message: "Entre." } });
    expect(expired).toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });
  it("mostra a versão atual, substitui e exibe o histórico", async () => {
    const user = userEvent.setup();
    renderPanel([report]);
    expect(
      screen.getByText("1 de 3 obrigatórios enviados", { exact: false }),
    ).toBeDefined();
    const card = screen.getByText("Relatório do projeto").closest("li")!;
    expect(
      within(card).getByText(/Enviado · versão 2 · Marina Oliveira/),
    ).toBeDefined();
    expect(within(card).getByText("relatorio-v2.pdf · 2 KB")).toBeDefined();
    expect(
      within(card).getByRole("link", { name: "Baixar" }).getAttribute("href"),
    ).toBe("/api/projects/2/materials/1/versions/2/file");
    await user.upload(
      screen.getByLabelText("Arquivo para Relatório do projeto"),
      pdfFile("relatorio-v3.pdf"),
    );
    expect(lastRequest().url).toBe("/api/projects/2/materials/1/versions");
    expect([...lastRequest().body!.keys()]).toEqual(["file"]);
    await lastRequest().respond(201, { data: report });
    const toggle = within(card).getByRole("button", { name: "Histórico (2)" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    await user.click(toggle);
    const history = screen.getByRole("list", {
      name: "Versões de Relatório do projeto",
    });
    expect(within(history).getAllByRole("listitem")).toHaveLength(2);
    expect(
      within(history)
        .getByRole("link", { name: "Baixar versão 1 de Relatório do projeto" })
        .getAttribute("href"),
    ).toBe("/api/projects/2/materials/1/versions/1/file");
    await user.click(toggle);
    expect(screen.queryByRole("list", { name: /Versões/ })).toBeNull();
  });
  it("mostra autor removido e esconde envio para quem só consulta", () => {
    const orphan = {
      ...report,
      currentVersion: {
        ...report.currentVersion,
        uploadedBy: { id: 9, fullName: null },
      },
    };
    renderPanel([orphan], { canUpload: false });
    expect(screen.getByText(/Autor removido/)).toBeDefined();
    expect(screen.queryByRole("button", { name: "Substituir" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Enviar arquivo" })).toBeNull();
    expect(screen.queryByText("Adicionar material complementar")).toBeNull();
    expect(screen.getByRole("link", { name: "Baixar" })).toBeDefined();
  });
  it("explica quando a entrega está bloqueada", () => {
    const { unmount } = renderPanel([], {
      lock: "DEADLINE_PASSED",
      canUpload: false,
    });
    expect(screen.getByText(/O prazo de entrega terminou em/)).toBeDefined();
    expect(screen.queryByText(/Prazo de entrega:/)).toBeNull();
    unmount();
    renderPanel([], { lock: "DEADLINE_PASSED", canUpload: false, dueAt: null });
    expect(screen.getByText(/terminou\. Fale com o professor/)).toBeDefined();
    renderPanel([], { lock: "PROJECT_LOCKED", canUpload: false });
    expect(screen.getByText(/ficam bloqueados/)).toBeDefined();
  });
  it("adiciona material complementar com título e lista os existentes", async () => {
    const user = userEvent.setup();
    const extra: Material = {
      ...report,
      id: 7,
      kind: "OUTRO",
      title: "Esquemático",
    };
    renderPanel([extra]);
    expect(screen.getByText("Esquemático")).toBeDefined();
    const form = screen
      .getByText("Adicionar material complementar")
      .closest("form")!;
    await user.click(within(form).getByRole("button", { name: /Enviar/ }));
    expect(FakeXHR.instances).toHaveLength(0);
    expect(within(form).getByRole("alert").textContent).toContain(
      "Selecione um arquivo",
    );
    await user.type(within(form).getByLabelText("Título"), "  Fotos  ");
    await user.upload(within(form).getByLabelText("Arquivo"), pdfFile());
    await user.click(within(form).getByRole("button", { name: /Enviar/ }));
    expect([...lastRequest().body!.entries()].slice(0, 2)).toEqual([
      ["kind", "OUTRO"],
      ["title", "Fotos"],
    ]);
    await lastRequest().respond(201, { data: extra });
    expect(onSaved).toHaveBeenCalledWith(extra);
    expect(
      (within(form).getByLabelText("Arquivo") as HTMLInputElement).value,
    ).toBe("");
    await user.clear(within(form).getByLabelText("Título"));
    await user.upload(within(form).getByLabelText("Arquivo"), pdfFile());
    await user.click(within(form).getByRole("button", { name: /Enviar/ }));
    expect([...lastRequest().body!.keys()]).toEqual(["kind", "file"]);
  });
  it("aborta o envio ao sair da tela", async () => {
    const user = userEvent.setup();
    const { unmount } = renderPanel();
    await user.upload(
      screen.getByLabelText("Arquivo para Relatório do projeto"),
      pdfFile("relatorio.pdf"),
    );
    const abort = vi.spyOn(lastRequest(), "abort");
    unmount();
    expect(abort).toHaveBeenCalled();
  });
});

describe("utilitários de materiais", () => {
  it("formata tamanhos e valida extensão sem diferenciar maiúsculas", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1,5 KB");
    expect(formatBytes(20 * 1024 * 1024)).toBe("20 MB");
    expect(validateFile(rule({}), pdfFile("FINAL.PDF"))).toBe("");
    expect(validateFile(rule({}), pdfFile("sem-extensao"))).toContain(
      "Formato",
    );
  });
});

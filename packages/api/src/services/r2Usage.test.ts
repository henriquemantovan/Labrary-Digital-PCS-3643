import { afterEach, describe, expect, it } from "vitest";
import {
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createR2UsageLimiter,
  initializeR2Usage,
  r2OperationLimits,
} from "./r2Usage.js";

const roots: string[] = [];
const scope = "conta/bucket";
const november = Date.UTC(2026, 10, 22);
function setup() {
  const root = mkdtempSync(join(tmpdir(), "labrary-r2-usage-"));
  roots.push(root);
  const path = join(root, "privado", "uso.json");
  initializeR2Usage(path, scope, november);
  return { root, path, load: () => JSON.parse(readFileSync(path, "utf8")) };
}
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

describe("controle conservador de operações R2", () => {
  it("persiste reservas privadas e preserva contadores após reiniciar", () => {
    const c = setup();
    const first = createR2UsageLimiter(c.path, scope, () => november);
    first.reserve("A");
    first.reserve("B");
    first.reserve("B");
    expect(c.load()).toMatchObject({ month: "2026-11", A: 1, B: 2 });
    createR2UsageLimiter(c.path, scope, () => november).reserve("A");
    expect(c.load()).toMatchObject({ A: 2, B: 2 });
    expect(statSync(c.path).mode & 0o777).toBe(0o600);
    expect(() => initializeR2Usage(c.path, scope, november)).toThrow();
    expect(c.load().A).toBe(2);
  });
  it("bloqueia cada classe no limite, sem reiniciar a franquia ao abrir o arquivo", () => {
    const c = setup();
    writeFileSync(
      c.path,
      JSON.stringify({
        ...c.load(),
        A: r2OperationLimits.A - 1,
        B: r2OperationLimits.B,
      }),
    );
    const limiter = createR2UsageLimiter(c.path, scope, () => november);
    expect(() => limiter.reserve("A")).not.toThrow();
    expect(() => limiter.reserve("A")).toThrow(
      expect.objectContaining({ status: 503, code: "STORAGE_OPERATION_LIMIT" }),
    );
    expect(() => limiter.reserve("B")).toThrow(
      expect.objectContaining({ status: 503 }),
    );
    const reloaded = createR2UsageLimiter(c.path, scope, () => november);
    expect(() => reloaded.reserve("A")).toThrow();
    expect(c.load()).toMatchObject({
      A: r2OperationLimits.A,
      B: r2OperationLimits.B,
    });
  });
  it("renova no mês UTC seguinte, mas recusa relógio retrocedido", () => {
    const c = setup();
    let now = november;
    const limiter = createR2UsageLimiter(c.path, scope, () => now);
    limiter.reserve("A");
    now = Date.UTC(2026, 11, 1);
    limiter.reserve("B");
    expect(c.load()).toMatchObject({ month: "2026-12", A: 0, B: 1 });
    now = november;
    expect(() => limiter.reserve("A")).toThrow("Relógio anterior");
    expect(c.load().month).toBe("2026-12");
  });
  it("não recria silenciosamente arquivo ausente, inválido ou de outro bucket", () => {
    const c = setup();
    expect(() => createR2UsageLimiter(c.path, "outra/conta")).toThrow(
      "outra conta",
    );
    expect(() =>
      createR2UsageLimiter(join(c.root, "ausente"), scope),
    ).toThrow();
    writeFileSync(c.path, "corrompido");
    expect(() => createR2UsageLimiter(c.path, scope)).toThrow();
    writeFileSync(
      c.path,
      JSON.stringify({ version: 1, scope, month: "2026-11", A: -1, B: 0 }),
    );
    expect(() => createR2UsageLimiter(c.path, scope)).toThrow();
  });
  it("recusa a operação quando a reserva não pode ser gravada", () => {
    const c = setup();
    const limiter = createR2UsageLimiter(c.path, scope, () => november);
    const backup = `${c.root}-moved`;
    roots.push(backup);
    renameSync(c.root, backup);
    expect(() => limiter.reserve("A")).toThrow();
    renameSync(backup, c.root);
    expect(c.load().A).toBe(0);
    limiter.reserve("A");
    expect(c.load().A).toBe(1);
  });
});

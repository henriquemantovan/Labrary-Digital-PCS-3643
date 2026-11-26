import { describe, expect, it } from "vitest";
import { developmentTestAccounts, isDevelopmentTestAccount, isDevelopmentTestEmail, isDevelopmentProfileAccount, isDevelopmentGuestAccount, loadDevelopmentTestLogin } from "./developmentTestAccounts.js";

const enabled = { DEV_TEST_LOGIN: "true", NODE_ENV: "development" };
describe("configuração das contas fictícias no ambiente Google", () => {
  it("exige opção explícita e não interfere na demonstração local", () => {
    expect(loadDevelopmentTestLogin({}, true, "http://localhost:5173")).toBe(false);
    expect(loadDevelopmentTestLogin({ DEV_TEST_LOGIN: "false" }, true, "http://localhost:5173")).toBe(false);
    expect(loadDevelopmentTestLogin(enabled, false, "http://localhost:5173")).toBe(false);
    expect(() => loadDevelopmentTestLogin({ ...enabled, DEV_TEST_LOGIN: "yes" }, true, "http://localhost:5173")).toThrow("true ou false");
  });
  it("só permite desenvolvimento explícito em origem local", () => {
    for (const origin of ["http://localhost:5173", "https://127.0.0.1:5173"])
      expect(loadDevelopmentTestLogin(enabled, true, origin)).toBe(true);
    for (const NODE_ENV of [undefined, "test", "production"])
      expect(() => loadDevelopmentTestLogin({ ...enabled, NODE_ENV }, true, "http://localhost:5173")).toThrow("NODE_ENV=development");
    for (const origin of ["https://labrary.example", "ftp://localhost", "http://user@localhost", "http://user:password@localhost", "http://localhost?query=1", "http://localhost#hash", "http://localhost/path"])
      expect(() => loadDevelopmentTestLogin(enabled, true, origin)).toThrow("APP_ORIGIN local");
  });
  it("limita a exceção aos oito endereços e não aceita identidade Google ou senha ausente", () => {
    expect(developmentTestAccounts).toHaveLength(8);
    expect(isDevelopmentTestEmail("ALUNO@LABRARY.TEST")).toBe(true);
    expect(isDevelopmentTestEmail("qualquer@labrary.test")).toBe(false);
    expect(isDevelopmentTestEmail("aluno@usp.br")).toBe(false);
    const user = { id: 1, ...developmentTestAccounts[3], active: true, passwordHash: "hash", googleLinked: false };
    expect(isDevelopmentTestAccount(user)).toBe(true);
    expect(isDevelopmentTestAccount({ ...user, googleLinked: true })).toBe(false);
    expect(isDevelopmentTestAccount({ ...user, passwordHash: null })).toBe(false);
    expect(isDevelopmentTestAccount({ ...user, email: "outro@labrary.test" })).toBe(false);
    expect(isDevelopmentProfileAccount(user)).toBe(false);
    expect(isDevelopmentProfileAccount({ ...user, email: "cadastro@labrary.test" })).toBe(true);
    expect(isDevelopmentGuestAccount(user)).toBe(false);
    expect(isDevelopmentGuestAccount({ ...user, email: "convidado@labrary.test" })).toBe(true);
  });
});

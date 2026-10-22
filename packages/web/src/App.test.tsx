import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App";
import type { Material, MaterialRules, Project, Scope, User } from "./api";
import { FakeXHR } from "./test/fakeXhr";

const student: User = {
  id: 1,
  fullName: "Marina Oliveira",
  email: "aluno@labrary.local",
  role: "ALUNO",
};
const teacher: User = {
  ...student,
  id: 3,
  fullName: "Helena Almeida",
  role: "PROFESSOR",
};
const projects: Project[] = [
  {
    id: 1,
    classId: 1,
    groupId: 1,
    title: "Semáforo inteligente",
    description: "Um circuito digital.",
    category: "Sistemas digitais",
    status: "EM_AVALIACAO",
    dueAt: null,
  },
  {
    id: 2,
    classId: 1,
    groupId: 2,
    title: "Monitor de energia",
    description: "Um novo projeto.",
    category: "Instrumentação",
    status: "PREPARACAO",
    dueAt: null,
  },
];
const scope: Scope = {
  classes: [{ id: 1, name: "Sistemas Digitais", academicYear: 2026 }],
  groups: [
    { id: 1, classId: 1, name: "Grupo 01" },
    { id: 2, classId: 1, name: "Grupo 02" },
    { id: 3, classId: 1, name: "Grupo 03" },
  ],
};
const pdf = { label: "PDF", mimeType: "application/pdf", extensions: [".pdf"] };
const materialRules: MaterialRules = {
  dueAt: null,
  lock: null,
  canUpload: true,
  rules: [
    {
      kind: "RELATORIO",
      defaultTitle: "Relatório do projeto",
      required: true,
      formats: [pdf],
      maxSizeBytes: 20 * 1024 * 1024,
    },
  ],
};
type Override = (
  url: string,
  init?: RequestInit,
) => Response | undefined | Promise<Response | undefined>;
let session: User | null;
let available: Project[];
let override: Override;
const response = (data: unknown, status = 200) =>
  new Response(
    JSON.stringify(status >= 400 ? { error: { message: data } } : { data }),
    { status, headers: { "Content-Type": "application/json" } },
  );
beforeEach(() => {
  window.history.replaceState(null, "", "/");
  session = student;
  available = [projects[1]];
  override = () => undefined;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      const custom = await override(input, init);
      if (custom) return custom;
      if (input === "/api/auth/providers")
        return response({ google: false, local: true });
      if (input === "/api/auth/me")
        return session
          ? response(session)
          : response("Entre para continuar.", 401);
      if (input === "/api/auth/login") {
        session = student;
        return response(session);
      }
      if (input === "/api/auth/logout") {
        session = null;
        return new Response(null, { status: 204 });
      }
      if (input === "/api/scope") return response(scope);
      if (input === "/api/projects" && init?.method === "POST")
        return response(
          { ...projects[0], id: 3, ...JSON.parse(String(init.body)) },
          201,
        );
      if (input === "/api/projects") return response(available);
      if (input.endsWith("/materials") || input.endsWith("/messages"))
        return response([]);
      if (input.endsWith("/material-rules")) return response(materialRules);
      return response(
        available.find((project) => input === `/api/projects/${project.id}`) ??
          projects[0],
      );
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
const loginForm = async () => {
  const user = userEvent.setup();
  await user.type(
    await screen.findByLabelText("E-mail institucional"),
    "aluno@labrary.local",
  );
  await user.type(screen.getByLabelText("Senha"), "Senha123!");
  return user;
};

describe("HU01: interface", () => {
  it("faz login, alterna visibilidade da senha e sai da conta", async () => {
    session = null;
    render(<App />);
    const user = await loginForm();
    await user.click(screen.getByRole("button", { name: "Mostrar senha" }));
    expect((screen.getByLabelText("Senha") as HTMLInputElement).type).toBe(
      "text",
    );
    await user.click(screen.getByRole("button", { name: "Ocultar senha" }));
    expect((screen.getByLabelText("Senha") as HTMLInputElement).type).toBe(
      "password",
    );
    await user.click(
      screen.getByRole("button", { name: "Entrar no meu espaço" }),
    );
    await screen.findByRole("heading", { name: "Olá, Marina." });
    expect(window.location.pathname).toBe("/projetos");
    expect(screen.queryByRole("button", { name: /Novo projeto/ })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Sair da conta" }));
    await screen.findByRole("button", { name: "Entrar no meu espaço" });
    expect(screen.queryByText("Monitor de energia")).toBeNull();
  });
  it("exibe erro de credenciais sem sair da tela de login", async () => {
    session = null;
    override = (url) =>
      url.endsWith("/login")
        ? response("E-mail ou senha inválidos.", 401)
        : undefined;
    render(<App />);
    const user = await loginForm();
    await user.click(
      screen.getByRole("button", { name: "Entrar no meu espaço" }),
    );
    expect((await screen.findByRole("alert")).textContent).toBe(
      "E-mail ou senha inválidos.",
    );
  });
  it("permite recuperar conexão na inicialização", async () => {
    override = () => {
      throw new Error("offline");
    };
    render(<App />);
    await screen.findByRole("alert");
    override = () => undefined;
    await userEvent.click(
      screen.getByRole("button", { name: "Tentar novamente" }),
    );
    await screen.findByRole("heading", { name: "Olá, Marina." });
  });
  it("filtra, abre projeto, exibe estado vazio e volta à lista", async () => {
    render(<App />);
    const user = userEvent.setup();
    await screen.findByText("Monitor de energia");
    await user.type(
      screen.getByRole("textbox", { name: "Buscar projetos" }),
      "sem resultado",
    );
    await screen.findByText("Nenhum resultado por aqui");
    await user.clear(screen.getByRole("textbox", { name: "Buscar projetos" }));
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Filtrar por estado" }),
      "FINALIZADO",
    );
    await screen.findByText("Nenhum resultado por aqui");
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Filtrar por estado" }),
      "",
    );
    await user.click(
      screen.getByRole("link", { name: "Abrir Monitor de energia" }),
    );
    await screen.findByRole("heading", { name: "Monitor de energia" });
    await screen.findByText(/0 de 1 obrigatórios enviados/);
    expect(screen.getByText("Pendente")).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Todos os projetos" }));
    await screen.findByRole("heading", { name: "Olá, Marina." });
    await user.click(screen.getByRole("link", { name: "Monitor de energia" }));
    await screen.findByRole("heading", { name: "Monitor de energia" });
  });
  it("mostra perfil, mantém navegação pelo histórico e trata rota desconhecida", async () => {
    render(<App />);
    await screen.findByText("Monitor de energia");
    await userEvent.click(screen.getByRole("button", { name: "Meu perfil" }));
    await screen.findByRole("heading", { name: "Meu perfil" });
    expect(screen.getByText(student.email)).toBeDefined();
    window.history.pushState(null, "", "/nao-existe");
    fireEvent.popState(window);
    await screen.findByRole("heading", { name: "Página indisponível" });
    await userEvent.click(
      screen.getByRole("button", { name: "Voltar aos projetos" }),
    );
    await screen.findByText("Monitor de energia");
    await userEvent.click(screen.getByRole("link", { name: /labrary/i }));
    expect(window.location.pathname).toBe("/projetos");
  });
  it("preserva o destino privado no login e mostra materiais existentes", async () => {
    window.history.replaceState(null, "", "/projetos/2");
    session = null;
    override = (url) =>
      url.endsWith("/materials")
        ? response([
            {
              id: 1,
              title: "Relatório",
              kind: "RELATORIO",
              currentVersion: {
                id: 2,
                versionNumber: 2,
                originalFilename: "relatorio.pdf",
                mimeType: "application/pdf",
                sizeBytes: 2400,
                uploadedBy: { id: 1, fullName: "Aluno" },
                uploadedAt: "2026-10-22T12:00:00.000Z",
                downloadUrl: "/api/projects/2/materials/1/versions/2/file",
              },
              versions: [
                {
                  id: 2,
                  versionNumber: 2,
                  originalFilename: "relatorio.pdf",
                  mimeType: "application/pdf",
                  sizeBytes: 2400,
                  uploadedBy: { id: 1, fullName: "Aluno" },
                  uploadedAt: "2026-10-22T12:00:00.000Z",
                  downloadUrl: "/api/projects/2/materials/1/versions/2/file",
                },
              ],
            },
          ])
        : undefined;
    render(<App />);
    const user = await loginForm();
    await user.click(
      screen.getByRole("button", { name: "Entrar no meu espaço" }),
    );
    await screen.findByRole("heading", { name: "Monitor de energia" });
    expect(screen.getByText(/relatorio\.pdf/)).toBeDefined();
    expect(screen.getByText(/versão 2/)).toBeDefined();
  });
  it("atualiza a lista após enviar e substituir um material", async () => {
    window.history.replaceState(null, "", "/projetos/2");
    FakeXHR.instances = [];
    vi.stubGlobal("XMLHttpRequest", FakeXHR);
    const user = userEvent.setup();
    const saved = (versionNumber: number): Material => {
      const version = {
        id: versionNumber,
        versionNumber,
        originalFilename: `relatorio-v${versionNumber}.pdf`,
        mimeType: "application/pdf",
        sizeBytes: 100,
        uploadedBy: { id: 1, fullName: "Marina Oliveira" },
        uploadedAt: "2026-10-22T15:00:00.000Z",
        downloadUrl: `/api/projects/2/materials/1/versions/${versionNumber}/file`,
      };
      return {
        id: 1,
        title: "Relatório do projeto",
        kind: "RELATORIO",
        currentVersion: version,
        versions: [version],
      };
    };
    override = (url) =>
      url === "/api/projects/2"
        ? response({ ...projects[1], missingMaterials: ["RELATORIO"] })
        : undefined;
    render(<App />);
    const input = await screen.findByLabelText(
      "Arquivo para Relatório do projeto",
    );
    expect(screen.getByText("Pendentes: Relatório")).toBeDefined();
    const file = new File(["%PDF-1.7"], "relatorio.pdf", {
      type: "application/pdf",
    });
    await user.upload(input, file);
    await FakeXHR.instances[0].respond(201, { data: saved(1) });
    await screen.findByText(/Enviado · versão 1/);
    expect(screen.getByText(/1 de 1 obrigatórios enviados/)).toBeDefined();
    expect(screen.getByText("Materiais obrigatórios presentes")).toBeDefined();
    await user.upload(
      screen.getByLabelText("Arquivo para Relatório do projeto"),
      file,
    );
    expect(FakeXHR.instances[1].url).toBe(
      "/api/projects/2/materials/1/versions",
    );
    await FakeXHR.instances[1].respond(201, { data: saved(2) });
    await screen.findByText(/Enviado · versão 2/);
    expect(screen.getAllByText("Relatório do projeto")).toHaveLength(1);
  });
  it("informa projeto indisponível e permite voltar ou tentar novamente", async () => {
    window.history.replaceState(null, "", "/projetos/999");
    override = (url) =>
      url.includes("/999")
        ? response("Projeto não encontrado.", 404)
        : undefined;
    render(<App />);
    await screen.findByRole("alert");
    await userEvent.click(
      screen.getByRole("button", { name: "Tentar novamente" }),
    );
    await screen.findByRole("alert");
    await userEvent.click(
      screen.getByRole("button", { name: "Voltar aos projetos" }),
    );
    await screen.findByRole("heading", { name: "Olá, Marina." });
  });
  it("volta ao login ao receber 401 nos dados privados", async () => {
    override = (url) =>
      url === "/api/projects" ? response("Sessão expirada.", 401) : undefined;
    render(<App />);
    await screen.findByRole("button", { name: "Entrar no meu espaço" });
    expect(screen.getByRole("alert").textContent).toContain(
      "Sua sessão terminou",
    );
  });
  it("atualiza sessão ao voltar para a aba e trata logout que falha", async () => {
    render(<App />);
    await screen.findByText("Monitor de energia");
    override = (url) =>
      url.endsWith("/logout") ? response("Tente novamente.", 500) : undefined;
    await userEvent.click(
      screen.getByRole("button", { name: "Sair da conta" }),
    );
    await screen.findByRole("alert");
    expect(screen.getByText("Monitor de energia")).toBeDefined();
    fireEvent(document, new Event("visibilitychange"));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith("/api/auth/me", expect.anything()),
    );
    session = null;
    fireEvent(document, new Event("visibilitychange"));
    await screen.findByRole("button", { name: "Entrar no meu espaço" });
  });
  it("mostra projetos atribuídos e estado vazio do avaliador", async () => {
    session = { ...student, role: "AVALIADOR" };
    available = [];
    render(<App />);
    await screen.findByText("Seu espaço está pronto");
    expect(screen.getByText("Projetos atribuídos")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Minhas turmas" })).toBeNull();
  });
  it("mostra turmas do professor e cadastra projeto para grupo disponível", async () => {
    session = teacher;
    available = projects;
    render(<App />);
    const user = userEvent.setup();
    await screen.findByText("Semáforo inteligente");
    await user.click(screen.getByRole("button", { name: "Minhas turmas" }));
    await screen.findByRole("heading", { name: "Sistemas Digitais" });
    expect(screen.getByText("Sem projeto")).toBeDefined();
    await user.click(
      screen.getByRole("button", { name: "Gerenciar projetos" }),
    );
    await user.click(screen.getByRole("button", { name: "+ Novo projeto" }));
    await user.type(
      screen.getByRole("textbox", { name: "Título" }),
      "Contador",
    );
    await user.type(
      screen.getByRole("textbox", { name: "Categoria" }),
      "Lógica",
    );
    override = (url, init) =>
      url === "/api/projects" && init?.method === "POST"
        ? response("Grupo indisponível.", 409)
        : undefined;
    await user.click(screen.getByRole("button", { name: "Criar projeto" }));
    await screen.findByRole("alert");
    override = () => undefined;
    await user.click(screen.getByRole("button", { name: "Criar projeto" }));
    await screen.findByRole("heading", { name: "Materiais do projeto" });
    expect(fetch).toHaveBeenCalledWith(
      "/api/projects",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          groupId: 3,
          classId: 1,
          title: "Contador",
          description: "",
          category: "Lógica",
        }),
      }),
    );
  });
  it("trata professor sem turmas ou grupos disponíveis", async () => {
    session = teacher;
    available = [];
    override = (url) =>
      url === "/api/scope" ? response({ classes: [], groups: [] }) : undefined;
    render(<App />);
    await screen.findByText("Seu espaço está pronto");
    await userEvent.click(
      screen.getByRole("button", { name: "+ Novo projeto" }),
    );
    await screen.findByText(/Todos os grupos vinculados já têm projeto/);
    await userEvent.click(
      screen.getByRole("button", { name: "Fechar formulário" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Minhas turmas" }),
    );
    await screen.findByText("Nenhuma turma vinculada");
    await userEvent.click(screen.getByRole("button", { name: "Projetos" }));
    await screen.findByText("Seu espaço está pronto");
  });
  it("encerra sessão quando criação de projeto retorna 401", async () => {
    session = teacher;
    render(<App />);
    await screen.findByText("Monitor de energia");
    await userEvent.click(
      screen.getByRole("button", { name: "+ Novo projeto" }),
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Título" }), {
      target: { value: "Novo projeto" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Categoria" }), {
      target: { value: "Categoria" },
    });
    override = (url, init) =>
      url === "/api/projects" && init?.method === "POST"
        ? response("Sessão expirada", 401)
        : undefined;
    await userEvent.click(
      screen.getByRole("button", { name: "Criar projeto" }),
    );
    await screen.findByRole("button", { name: "Entrar no meu espaço" });
  });
  it("usa descrições alternativas para projeto sem descrição", async () => {
    available = [{ ...projects[1], description: "" }];
    render(<App />);
    await screen.findByText("Descrição ainda não informada.");
    await userEvent.click(
      screen.getByRole("link", { name: "Monitor de energia" }),
    );
    await screen.findByText("Este projeto ainda não tem uma descrição.");
  });
});

it("oferece Google sem pedir senha local e mostra erro de retorno", async () => {
  session = null;
  window.history.replaceState(null, "", "/login?authError=google");
  override = (url) =>
    url === "/api/auth/providers"
      ? response({ google: true, local: false })
      : undefined;
  render(<App />);
  expect(
    (
      await screen.findByRole("link", { name: "Entrar com Google" })
    ).getAttribute("href"),
  ).toBe("/api/auth/google");
  expect(screen.queryByLabelText("Senha", { exact: true })).toBeNull();
  expect(screen.getByText(/Não foi possível entrar com o Google/)).toBeTruthy();
});
it("permite tentar novamente ao falhar consulta das opções de acesso", async () => {
  session = null;
  override = (url) =>
    url === "/api/auth/providers"
      ? response("Serviço indisponível", 503)
      : undefined;
  render(<App />);
  await screen.findByText("Serviço indisponível");
  override = () => undefined;
  await userEvent.click(
    screen.getByRole("button", { name: "Tentar novamente" }),
  );
  expect(await screen.findByLabelText("E-mail institucional")).toBeTruthy();
});

it("exibe autenticação Google no perfil", async () => {
  session = { ...student, googleLinked: true };
  window.history.replaceState(null, "", "/perfil");
  render(<App />);
  expect(await screen.findByText("Conta Google vinculada")).toBeTruthy();
});

it("HU06 combina grupo, estado e pendências e consulta histórico de versões", async () => {
  session = { ...student, role: "AVALIADOR" };
  available = [
    {
      ...projects[0],
      status: "PREPARACAO",
      groupName: "Equipe Alfa",
      missingMaterials: ["VIDEO", "MANUAL"],
    },
    { ...projects[1], missingMaterials: [] },
  ];
  const history = [
    [2, "revisado.pdf"],
    [1, "inicial.pdf"],
  ].map(([id, originalFilename]) => ({
    id,
    versionNumber: id,
    originalFilename,
    mimeType: "application/pdf",
    sizeBytes: 2400,
    uploadedBy: { id: 1, fullName: "Aluno" },
    uploadedAt: "2026-10-22T12:00:00.000Z",
    downloadUrl: `/api/projects/1/materials/1/versions/${id}/file`,
  }));
  override = (url) =>
    url.endsWith("/materials")
      ? response([
          {
            id: 1,
            title: "Relatório",
            kind: "RELATORIO",
            currentVersion: history[0],
            versions: history,
          },
        ])
      : undefined;
  render(<App />);
  await screen.findByText("Semáforo inteligente");
  const user = userEvent.setup();
  await user.selectOptions(screen.getByLabelText("Filtrar por grupo"), "1");
  await user.selectOptions(
    screen.getByLabelText("Filtrar por estado"),
    "PREPARACAO",
  );
  await user.selectOptions(
    screen.getByLabelText("Filtrar por pendências"),
    "true",
  );
  expect(screen.queryByText("Monitor de energia")).toBeNull();
  expect(screen.getByText("Pendentes: Vídeo, Manual")).toBeTruthy();
  await user.selectOptions(
    screen.getByLabelText("Filtrar por pendências"),
    "false",
  );
  await screen.findByText("Nenhum resultado por aqui");
  await user.selectOptions(screen.getByLabelText("Filtrar por grupo"), "");
  await screen.findByText("Materiais obrigatórios presentes");
  await user.selectOptions(
    screen.getByLabelText("Filtrar por pendências"),
    "true",
  );
  await user.click(
    screen.getByRole("link", { name: "Abrir Semáforo inteligente" }),
  );
  await user.click(await screen.findByRole("button", { name: "Histórico (2)" }));
  const versions = within(screen.getByRole("list", { name: /^Versões de/ }));
  expect(versions.getByText(/^inicial\.pdf/)).toBeTruthy();
  expect(versions.getByText(/^revisado\.pdf/)).toBeTruthy();
  expect(versions.getByText("v1")).toBeTruthy();
  expect(versions.getByText("v2")).toBeTruthy();
});

it.each([
  [
    "account_conflict",
    "Já existe uma conta com esse e-mail. Solicite ao responsável a vinculação da conta Google.",
  ],
  ["inactive", "Sua conta está desativada. Contate o responsável."],
])("mostra orientação para erro Google %s", async (code, message) => {
  session = null;
  window.history.replaceState(null, "", `/login?authError=${code}`);
  override = (url) =>
    url === "/api/auth/providers"
      ? response({ google: true, local: false })
      : undefined;
  render(<App />);
  expect(await screen.findByText(message)).toBeTruthy();
});

it("administrador alterna visualização sem alterar sua identidade e conserva acesso à administração", async () => {
  session = { ...student, id: 4, role: "ADMIN" };
  available = [...projects];
  override = (url, init) => {
    if (url === "/api/auth/view-role") {
      const role = JSON.parse(String(init?.body)).role;
      session = { ...session!, viewRole: role ?? undefined };
      return response(session);
    }
    if (url === "/api/projects")
      return response(session?.viewRole ? [] : available);
    if (url === "/api/admin/users")
      return response([
        { ...student, active: true },
        { ...session, active: true },
      ]);
    return undefined;
  };
  render(<App />);
  const picker = await screen.findByLabelText("Visualizar como");
  expect(
    screen.getByRole("button", { name: "Administrar usuários" }),
  ).toBeTruthy();
  await userEvent.selectOptions(picker, "ALUNO");
  await screen.findByRole("button", { name: "Meu projeto" });
  expect(session).toMatchObject({ id: 4, role: "ADMIN", viewRole: "ALUNO" });
  await userEvent.click(
    screen.getByRole("button", { name: "Administrar usuários" }),
  );
  await screen.findByRole("heading", { name: "Administrar usuários" });
  await userEvent.selectOptions(
    screen.getByLabelText("Visualizar como"),
    "PROFESSOR",
  );
  await screen.findByRole("button", { name: "Minhas turmas" });
  await userEvent.selectOptions(
    screen.getByLabelText("Visualizar como"),
    "ADMIN",
  );
  await screen.findByRole("button", { name: "+ Novo projeto" });
  expect(session?.role).toBe("ADMIN");
  expect(session?.viewRole).toBeUndefined();
});
it("mostra falha de mudança de visualização sem trocar o perfil e trata expiração", async () => {
  session = { ...student, role: "ADMIN" };
  let fail = 503;
  override = (url) =>
    url === "/api/auth/view-role"
      ? response(
          fail === 401 ? "Sessão expirada" : "Falha ao mudar visualização",
          fail,
        )
      : undefined;
  render(<App />);
  await screen.findByLabelText("Visualizar como");
  await userEvent.selectOptions(
    screen.getByLabelText("Visualizar como"),
    "ALUNO",
  );
  await screen.findByText("Falha ao mudar visualização");
  expect(session?.viewRole).toBeUndefined();
  fail = 401;
  await userEvent.selectOptions(
    screen.getByLabelText("Visualizar como"),
    "ALUNO",
  );
  expect(
    await screen.findByRole("heading", {
      name: "Seu próximo projeto começa aqui.",
    }),
  ).toBeTruthy();
});
it("ao perder administrador na gestão de usuários, sai da área administrativa", async () => {
  session = { ...student, id: 4, role: "ADMIN" };
  window.history.replaceState(null, "", "/administracao");
  override = (url, init) => {
    if (url === "/api/admin/users")
      return response([
        { ...session, active: true },
        { ...teacher, id: 5, role: "ADMIN", active: true },
      ]);
    if (url === "/api/admin/users/4/role" && init?.method === "PATCH") {
      session = { ...session!, role: "ALUNO" };
      return response({ ...session, active: true });
    }
    return undefined;
  };
  render(<App />);
  await screen.findByRole("heading", { name: "Administrar usuários" });
  await userEvent.selectOptions(
    await screen.findByLabelText("Perfil de Marina Oliveira"),
    "ALUNO",
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Salvar perfil de Marina Oliveira" }),
  );
  await screen.findByRole("button", { name: "Meu projeto" });
  expect(
    screen.queryByRole("button", { name: "Administrar usuários" }),
  ).toBeNull();
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GroupManager, ProjectPlanning } from "./Planning";
import type {
  Administration,
  Evaluators,
  Project,
  Requirement,
  RubricVersion,
} from "./api";
const project: Project = {
  id: 2,
  classId: 1,
  groupId: 2,
  title: "Monitor",
  description: "",
  category: "Digital",
  status: "PREPARACAO",
  dueAt: null,
};
const people: Administration["people"] = [
  { id: 1, fullName: "Marina", role: "ALUNO" },
  { id: 2, fullName: "Rafael", role: "AVALIADOR" },
];
const requirements: Requirement[] = ["VIDEO", "RELATORIO", "MANUAL"].map(
  (kind) => ({
    kind: kind as Requirement["kind"],
    label: kind,
    required: true,
    allowedMimeTypes: ["application/pdf"],
    maxSizeBytes: 1000,
    dueAt: "2026-10-28T12:00:00.000Z",
  }),
);
const version: RubricVersion = {
  id: 1,
  versionNumber: 1,
  title: "Original",
  createdAt: "2026-10-23T12:00:00Z",
  createdBy: 3,
  criteria: [
    {
      title: "Funciona",
      description: "Circuito",
      weight: 100,
      minScore: 0,
      maxScore: 10,
    },
  ],
};
let admin: Administration,
  rubrics: RubricVersion[],
  configured: Requirement[],
  evaluators: Evaluators;
let failure: string | null, status: number;
const response = (data: unknown, code = 200) =>
  new Response(
    JSON.stringify(code >= 400 ? { error: { message: data } } : { data }),
    { status: code },
  );
beforeEach(() => {
  admin = {
    people,
    groups: [
      { id: 2, classId: 1, name: "Grupo 02", memberIds: [1], history: [] },
    ],
  };
  rubrics = [];
  configured = [];
  evaluators = { evaluatorIds: [], history: [] };
  failure = null;
  status = 500;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, options?: RequestInit) => {
      if (failure && url.endsWith(failure))
        return response("Falha de configuração", status);
      const body = options?.body ? JSON.parse(String(options.body)) : {};
      if (url.endsWith("administration")) return response(admin);
      if (url.endsWith("/groups")) {
        const group = {
          id: 3,
          classId: 1,
          name: body.name,
          memberIds: [],
          history: [],
        };
        admin.groups.push(group);
        return response(group, 201);
      }
      if (url.endsWith("/members")) {
        const group = admin.groups[0];
        group.history.push({
          before: [...group.memberIds],
          after: body.memberIds,
          changedBy: 3,
          changedAt: "2026-10-23T12:00:00Z",
        });
        group.memberIds = body.memberIds;
        return response(group);
      }
      if (url.endsWith("requirements")) {
        if (options?.method === "PUT") configured = body.requirements;
        return response(configured);
      }
      if (url.endsWith("rubrics")) {
        if (options?.method === "POST") {
          const saved = {
            ...version,
            ...body,
            id: rubrics.length + 1,
            versionNumber: rubrics.length + 1,
          };
          rubrics = [...rubrics, saved];
          return response(saved, 201);
        }
        return response(rubrics);
      }
      if (url.endsWith("evaluators")) {
        if (options?.method === "PUT")
          evaluators = {
            evaluatorIds: body.evaluatorIds,
            history: [
              {
                before: [],
                after: body.evaluatorIds,
                changedBy: 3,
                changedAt: "2026-10-23T12:00:00Z",
              },
            ],
          };
        return response(evaluators);
      }
      throw new Error(`Unexpected ${url}`);
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
const expiry = vi.fn();
const changed = vi.fn();
async function showProject(teacher = true) {
  render(
    <ProjectPlanning project={project} teacher={teacher} expired={expiry} />,
  );
  await screen.findByText("Materiais obrigatórios");
}
describe("gestão docente", () => {
  it("cadastra grupos, altera integrantes e mostra histórico", async () => {
    const user = userEvent.setup();
    render(<GroupManager classId={1} onChanged={changed} expired={expiry} />);
    await user.type(
      await screen.findByLabelText("Nome do novo grupo"),
      "Grupo novo",
    );
    await user.click(screen.getByRole("button", { name: "Cadastrar grupo" }));
    await screen.findByRole("heading", { name: "Grupo novo" });
    expect(changed).toHaveBeenCalled();
    await user.click(screen.getAllByLabelText("Marina")[0]);
    await user.click(
      screen.getByRole("button", { name: "Salvar integrantes de Grupo 02" }),
    );
    await screen.findByText("Histórico de vínculos (1)");
    expect(
      (screen.getAllByLabelText("Marina")[0] as HTMLInputElement).checked,
    ).toBe(false);
    await user.click(screen.getByText("Histórico de vínculos (1)"));
    expect(screen.getByText(/Conta 3:/).textContent).toContain("[1] → []");
  });
  it("trata carregamento, erro e repetição de leitura e falha ao salvar", async () => {
    failure = "administration";
    render(<GroupManager classId={1} onChanged={changed} expired={expiry} />);
    await screen.findByRole("alert");
    failure = null;
    await userEvent.click(
      screen.getByRole("button", { name: "Recarregar grupos" }),
    );
    await screen.findByLabelText("Nome do novo grupo");
    failure = "/groups";
    await userEvent.type(screen.getByLabelText("Nome do novo grupo"), "Outro");
    await userEvent.click(
      screen.getByRole("button", { name: "Cadastrar grupo" }),
    );
    await screen.findByRole("alert");
  });
  it("suporta diretório vazio e expiração da sessão", async () => {
    admin = { people: [], groups: [] };
    render(<GroupManager classId={1} onChanged={changed} expired={expiry} />);
    await screen.findByText("Nenhum grupo cadastrado.");
    failure = "/groups";
    status = 401;
    await userEvent.type(screen.getByLabelText("Nome do novo grupo"), "Outro");
    await userEvent.click(
      screen.getByRole("button", { name: "Cadastrar grupo" }),
    );
    await waitFor(() => expect(expiry).toHaveBeenCalled());
  });
  it("configura os três requisitos sem impor datas ou limites prévios", async () => {
    await showProject();
    for (const label of ["Vídeo", "Relatório", "Manual"]) {
      await userEvent.type(
        screen.getByLabelText(
          `Formatos de ${label} (MIME, separados por vírgula)`,
        ),
        "application/pdf, text/plain",
      );
      await userEvent.type(
        screen.getByLabelText(`Tamanho máximo de ${label} (bytes)`),
        "1000",
      );
      fireEvent.change(screen.getByLabelText(`Prazo de ${label}`), {
        target: { value: "2026-10-28T12:00" },
      });
    }
    await userEvent.click(
      screen.getByRole("button", { name: "Salvar requisitos" }),
    );
    await screen.findByText("Configuração salva.");
    expect(configured).toHaveLength(3);
    expect(configured[0]).toMatchObject({
      allowedMimeTypes: ["application/pdf", "text/plain"],
      maxSizeBytes: 1000,
      required: true,
    });
    expect(new Date(configured[0].dueAt).getTime()).toBe(
      new Date("2026-10-28T12:00").getTime(),
    );
  });
  it("permite editar critérios, exige 100% e mantém versões antigas", async () => {
    rubrics = [version];
    configured = requirements;
    await showProject();
    const user = userEvent.setup();
    expect(
      (screen.getByLabelText("Critério 1") as HTMLInputElement).value,
    ).toBe("Funciona");
    await user.type(screen.getByLabelText("Título da rubrica"), "Revisada");
    await user.clear(screen.getByLabelText("Critério 1"));
    await user.type(screen.getByLabelText("Critério 1"), "Novo critério");
    await user.type(
      screen.getByLabelText("Descrição do critério 1"),
      " revisado",
    );
    await user.click(
      screen.getByRole("button", { name: "Adicionar critério" }),
    );
    expect(
      (
        screen.getByRole("button", {
          name: "Criar nova versão",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    await user.type(screen.getByLabelText("Critério 2"), "Qualidade");
    await user.clear(screen.getByLabelText("Peso do critério 1 (%)"));
    await user.type(screen.getByLabelText("Peso do critério 1 (%)"), "99");
    await user.click(screen.getByRole("button", { name: "Criar nova versão" }));
    await screen.findByText("v2 · Revisada");
    expect(screen.getByText("v1 · Original")).toBeTruthy();
    expect(rubrics[0].criteria[0].title).toBe("Funciona");
    expect(rubrics[1].criteria.map((item) => item.weight)).toEqual([99, 1]);
    await user.click(
      screen.getByRole("button", { name: "Remover critério 2" }),
    );
    expect(screen.queryByLabelText("Critério 2")).toBeNull();
  });
  it("gerencia avaliadores e preserva seu histórico", async () => {
    await showProject();
    await userEvent.click(screen.getByLabelText("Rafael"));
    await userEvent.click(
      screen.getByRole("button", { name: "Salvar avaliadores" }),
    );
    await screen.findByText("Configuração salva.");
    expect(evaluators.evaluatorIds).toEqual([2]);
    await userEvent.click(screen.getByText("Histórico de vínculos (1)"));
    expect(screen.getByText(/Conta 3:/).textContent).toContain("[] → [2]");
  });
  it("trata falhas, recarregamento e expiração de sessão ao salvar", async () => {
    failure = "requirements";
    render(<ProjectPlanning project={project} teacher expired={expiry} />);
    await screen.findByRole("alert");
    failure = null;
    await userEvent.click(
      screen.getByRole("button", { name: "Recarregar configuração" }),
    );
    await screen.findByLabelText("Título da rubrica");
    await userEvent.type(screen.getByLabelText("Título da rubrica"), "Rubrica");
    await userEvent.type(screen.getByLabelText("Critério 1"), "Critério");
    failure = "rubrics";
    await userEvent.click(
      screen.getByRole("button", { name: "Criar nova versão" }),
    );
    await screen.findByRole("alert");
    status = 401;
    await userEvent.click(
      screen.getByRole("button", { name: "Criar nova versão" }),
    );
    await waitFor(() => expect(expiry).toHaveBeenCalled());
  });
  it("aluno consulta requisitos e rubricas sem controles docentes nem diretório", async () => {
    configured = requirements;
    rubrics = [version];
    await showProject(false);
    expect(screen.getByText(/VIDEO · application\/pdf/)).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Salvar requisitos" }),
    ).toBeNull();
    expect(screen.queryByText("Avaliadores vinculados ao projeto")).toBeNull();
    expect(vi.mocked(fetch).mock.calls.map((call) => call[0])).toEqual([
      "/api/projects/2/requirements",
      "/api/projects/2/rubrics",
    ]);
  });
  it("aluno recebe estados vazios e o professor recebe ausência de contas", async () => {
    admin.people = [];
    await showProject();
    expect(screen.getByText("Nenhuma conta ativa disponível.")).toBeTruthy();
  });
});

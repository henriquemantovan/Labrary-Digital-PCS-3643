import { config } from "dotenv";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadGoogleConfig } from "../services/googleConfiguration.js";
import { developmentTestAccounts, developmentTestPassword, loadDevelopmentTestLogin } from "../services/developmentTestAccounts.js";

const root = resolve(process.cwd(), "../..");
config({ path: resolve(root, ".env"), quiet: true });
const origin = process.env.APP_ORIGIN ?? "http://localhost:5173";
const sessions = new Map<string, string>();
let pool: Pool | undefined;

async function call(actor: string | undefined, path: string, method = "GET", body?: unknown) {
  const multipart = body instanceof FormData;
  const response = await fetch(new URL(`/api${path}`, origin), {
    method,
    headers: {
      Origin: origin, "X-CSRF-Protection": "1",
      ...(actor ? { Cookie: sessions.get(actor)! } : {}),
      ...(body !== undefined && !multipart ? { "Content-Type": "application/json" } : {}),
    },
    ...(body === undefined ? {} : { body: multipart ? body : JSON.stringify(body) }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as { error?: { code: string } };
    throw new Error(`${method} ${path}: ${response.status} (${error.error?.code ?? "resposta indisponível"}).`);
  }
  return response;
}
const json = async (actor: string, path: string, method = "GET", body?: unknown) =>
  (await (await call(actor, path, method, body)).json()).data;

// PDF pequeno e completo, com tabela de referências, sem dependências adicionais.
function document(title: string): Buffer {
  const text = `BT /F1 16 Tf 50 780 Td (${title}) Tj 0 -28 Td (Dados ficticios para demonstracao do Labrary Digital.) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(text)} >>\nstream\n${text}\nendstream`,
  ];
  let pdf = "%PDF-1.7\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}

async function main() {
  if (!loadDevelopmentTestLogin(process.env, Boolean(loadGoogleConfig(process.env, origin)), origin))
    throw new Error("Ative as contas de desenvolvimento antes de preparar a demonstração.");
  const video = await readFile(resolve(root, process.env.DEMO_VIDEO_FILE ?? "e2e/fixtures/demonstracao.webm"));
  const people: Record<string, { id: number; role: string }> = {};
  try {
    for (const person of developmentTestAccounts.filter(person => !person.email.startsWith("cadastro@") && !person.email.startsWith("convidado@"))) {
      const name = person.email.split("@")[0];
      const response = await call(undefined, "/auth/login", "POST", { email: person.email, password: developmentTestPassword });
      sessions.set(name, response.headers.getSetCookie()[0].split(";")[0]);
      people[name] = (await response.json()).data;
      if (people[name].role !== person.role) throw new Error(`O papel de ${person.email} foi alterado; ajuste os vínculos manualmente.`);
    }
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const year = new Date().getUTCFullYear();
    const className = "Demonstração R2 — contas de teste";
    await pool.query("INSERT INTO course_class(name,academic_year,professor_id) VALUES($1,$2,$3) ON CONFLICT(name,academic_year) DO NOTHING", [className, year, people.professor.id]);
    const course = (await pool.query("SELECT id::integer,professor_id::integer FROM course_class WHERE name=$1 AND academic_year=$2", [className, year])).rows[0];
    if (course.professor_id !== people.professor.id) throw new Error("A turma existente pertence a outra conta; nenhum vínculo foi alterado.");
    const results: Array<{ scenario: string; projectId: number; url: string }> = [];
    async function group(name: string, memberIds: number[]) {
      const administration = await json("professor", `/classes/${course.id}/administration`);
      let found = administration.groups.find((item: { name: string }) => item.name === name);
      if (!found) {
        found = await json("professor", `/classes/${course.id}/groups`, "POST", { name });
        await json("professor", `/classes/${course.id}/groups/${found.id}/members`, "PUT", { memberIds });
      }
      return found;
    }
    const names = [
      ["Em avaliação", "EM_AVALIACAO"], ["Em ajustes", "AJUSTES"],
      ["Resultado liberado", "RESULTADO"], ["Finalizado privado", "FINALIZADO"],
      ["Publicado no acervo", "PUBLICADO"], ["Publicação retirada", "RETIRADO"],
      ["Prazo vencido", "PRAZO"],
    ] as const;
    for (const [label, target] of names) {
      const ownGroup = await group(`${label} — demonstração`, [people.aluno.id, people.aluno2.id]);
      const projects = await json("professor", "/projects");
      const existing = projects.find((item: { groupId: number }) => item.groupId === ownGroup.id);
      if (existing) {
        results.push({ scenario: label, projectId: existing.id, url: `${origin}/projetos/${existing.id}` });
        console.log(`${label}: projeto ${existing.id} existente preservado.`);
        continue;
      }
      const dueAt = new Date(Date.now() + (target === "PRAZO" ? -1 : 180) * 86_400_000).toISOString();
      const project = await json("professor", "/projects", "POST", {
        classId: course.id, groupId: ownGroup.id, title: `${label} — demonstração completa`,
        category: "Demonstração", description: "Projeto com dados e materiais fictícios para apresentar o fluxo acadêmico.", dueAt,
      });
      const path = `/projects/${project.id}`;
      await json("professor", `${path}/evaluators`, "PUT", { evaluatorIds: [people.avaliador.id] });
      await json("professor", `${path}/configuration/versions`, "POST", {
        baseVersionId: 0, title: "Critérios de avaliação de demonstração — pesos 50/30/20",
        requirements: [
          { kind: "VIDEO", label: "Vídeo de apresentação", allowedMimeTypes: ["video/webm"] },
          { kind: "RELATORIO", label: "Relatório do projeto", allowedMimeTypes: ["application/pdf"] },
          { kind: "MANUAL", label: "Manual de uso", allowedMimeTypes: ["application/pdf"] },
        ].map(item => ({ ...item, required: true, maxSizeBytes: 20 * 1024 * 1024, dueAt })),
        criteria: [
          { id: "funcionamento", title: "Funcionamento", weight: 50 },
          { id: "documentacao", title: "Documentação", weight: 30 },
          { id: "apresentacao", title: "Apresentação", weight: 20 },
        ].map(item => ({ ...item, description: "Critério demonstrativo.", minScore: 0, maxScore: 10 })),
      });
      if (target !== "PRAZO") {
        for (const [kind, filename, mime, content] of [
          ["VIDEO", "demonstracao.webm", "video/webm", video],
          ["RELATORIO", "relatorio.pdf", "application/pdf", document("Relatorio de demonstracao")],
          ["MANUAL", "manual.pdf", "application/pdf", document("Manual de demonstracao")],
        ] as const) {
          const body = new FormData();
          body.set("kind", kind);
          body.set("file", new Blob([new Uint8Array(content)], { type: mime }), filename);
          await call("aluno", `${path}/materials`, "POST", body);
        }
        await json("aluno", `${path}/messages`, "POST", { clientMessageId: randomUUID(), body: `Materiais fictícios enviados para o cenário: ${label}.` });
        const submission = await json("aluno", `${path}/submissions`, "POST", { clientSubmissionId: randomUUID() });
        const evaluations = `${path}/submissions/${submission.id}/evaluations`;
        if (target === "AJUSTES") {
          await json("professor", `${path}/submissions/${submission.id}/return`, "POST");
        } else if (target === "EM_AVALIACAO") {
          await json("avaliador", `${evaluations}/me`, "PUT", { expectedRevision: 0, scores: [{ criterionId: "funcionamento", score: 9, comment: "Rascunho demonstrativo; os demais critérios estão pendentes." }] });
        } else {
          await json("avaliador", `${evaluations}/me/finalize`, "POST", {
            expectedRevision: 0, scores: [
              { criterionId: "funcionamento", score: 9, comment: "Funcionamento conferido." },
              { criterionId: "documentacao", score: 10, comment: "Documentação completa." },
              { criterionId: "apresentacao", score: 9, comment: "Apresentação clara." },
            ],
          });
          if (target !== "FINALIZADO") {
            const consolidation = await json("professor", `${path}/results/consolidation`);
            await json("professor", `${path}/results/release`, "POST", { submissionId: submission.id, fingerprint: consolidation.fingerprint });
          }
          if (target !== "RESULTADO") {
            await json("professor", `${path}/finalization`, "POST", { submissionId: submission.id });
            if (target === "PUBLICADO" || target === "RETIRADO") {
              const materials = await json("professor", `${path}/materials`);
              await json("professor", `${path}/publication`, "POST", {
                submissionId: submission.id,
                materialVersionIds: materials.filter((item: { kind: string }) => item.kind !== "MANUAL").map((item: { currentVersion: { id: number } }) => item.currentVersion.id),
                groupAuthorization: { confirmed: true, reference: "Autorização demonstrativa para materiais fictícios das contas de teste." },
              });
              if (target === "RETIRADO") await call("professor", `${path}/publication`, "DELETE");
            }
          }
        }
      }
      results.push({ scenario: label, projectId: project.id, url: `${origin}/projetos/${project.id}` });
      console.log(`${label}: ${origin}/projetos/${project.id}`);
    }
    await group("Criar novo projeto — demonstração", []);
    const special = (await pool.query("SELECT id::integer,email FROM app_user WHERE email=ANY($1::text[])", [["cadastro@labrary.test", "convidado@labrary.test"]])).rows;
    for (const person of special) {
      const ownGroup = await group(`${person.email.split("@")[0]} — demonstração`, [person.id]);
      const existing = (await json("professor", "/projects")).find((item: { groupId: number }) => item.groupId === ownGroup.id);
      if (!existing) await json("professor", "/projects", "POST", { classId: course.id, groupId: ownGroup.id, title: `Primeiro acesso — ${person.email.split("@")[0]}`, category: "Demonstração", description: "Projeto privado da conta de teste, sem dados acadêmicos reais." });
    }
    // A prévia ADMIN usa vínculos próprios, sem impersonar professor ou alunos.
    const adminClassName = "Admin — visualização de perfis de teste";
    await pool.query("INSERT INTO course_class(name,academic_year,professor_id) VALUES($1,$2,$3) ON CONFLICT(name,academic_year) DO NOTHING", [adminClassName, year, people.admin.id]);
    const adminClass = (await pool.query("SELECT id::integer,professor_id::integer FROM course_class WHERE name=$1 AND academic_year=$2", [adminClassName, year])).rows[0];
    if (adminClass.professor_id !== people.admin.id) throw new Error("A turma de prévia pertence a outra conta.");
    const adminGroups = (await json("admin", `/classes/${adminClass.id}/administration`)).groups;
    let adminGroup = adminGroups.find((item: { name: string }) => item.name === "Grupo da prévia administrativa");
    if (!adminGroup) {
      adminGroup = await json("admin", `/classes/${adminClass.id}/groups`, "POST", { name: "Grupo da prévia administrativa" });
      await json("admin", `/classes/${adminClass.id}/groups/${adminGroup.id}/members`, "PUT", { memberIds: [people.admin.id] });
    }
    const adminProjects = await json("admin", "/projects");
    let adminProject = adminProjects.find((item: { groupId: number }) => item.groupId === adminGroup.id);
    if (!adminProject) {
      adminProject = await json("admin", "/projects", "POST", { classId: adminClass.id, groupId: adminGroup.id, title: "Prévia dos três perfis — administrador", category: "Demonstração", description: "Vínculos próprios do ADMIN para demonstrar Visualizar como, sem impersonação." });
      await json("admin", `/projects/${adminProject.id}/evaluators`, "PUT", { evaluatorIds: [people.admin.id] });
    }
    results.push({ scenario: "Prévia ADMIN", projectId: adminProject.id, url: `${origin}/projetos/${adminProject.id}` });
    await mkdir(resolve(root, ".data"), { recursive: true });
    await writeFile(resolve(root, ".data/demonstracao-completa.json"), JSON.stringify({ classId: course.id, storage: process.env.STORAGE_PROVIDER ?? "disk", projects: results }, null, 2), { mode: 0o600 });
    console.log("Demonstração preparada. Projetos existentes, resultados já alterados e contas reais foram preservados.");
  } finally {
    for (const name of sessions.keys()) await call(name, "/auth/logout", "POST").catch(() => undefined);
    await pool?.end();
  }
}
main().catch((error: Error) => {
  let message = error.message;
  for (const [key, value] of Object.entries(process.env))
    if (value && /(SECRET|PASSWORD|ACCESS_KEY|DATABASE_URL)/.test(key)) message = message.split(value).join("[privado]");
  console.error(message);
  process.exitCode = 1;
});

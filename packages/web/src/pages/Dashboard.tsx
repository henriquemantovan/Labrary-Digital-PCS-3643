import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "../api";
import type { Material, MaterialRules, Project, Scope, User } from "../api";
import { ArrowRight, Folder, Lock, Search, User as UserIcon } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input, NativeSelect } from "../components/ui/input";
import { Empty, Loading, Notice } from "../components/Feedback";
import { materialLabels, roleDescriptions, statusLabels } from "../labels";
import { Classes } from "./Classes";
import { CreateProject } from "./CreateProject";
import { ProjectDetail } from "./ProjectDetail";
import { Profile } from "./Profile";

export function Dashboard({
  user,
  path,
  navigate,
  expired,
}: {
  user: User;
  path: string;
  navigate: (path: string) => void;
  expired: () => void;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [scope, setScope] = useState<Scope>({ classes: [], groups: [] });
  const [detail, setDetail] = useState<Project | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialRules, setMaterialRules] = useState<MaterialRules | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [group, setGroup] = useState("");
  const [pending, setPending] = useState("");
  const [creating, setCreating] = useState(false);
  const detailId = /^\/projetos\/(\d+)$/.exec(path)?.[1];
  const activeDetailId = useRef(detailId);
  activeDetailId.current = detailId;
  async function refreshMaterialRules() {
    const rules = await api<MaterialRules>(
      `/projects/${detailId}/material-rules`,
    );
    if (activeDetailId.current === detailId) setMaterialRules(rules);
  }
  const knownPath =
    ["/", "/projetos", "/perfil"].includes(path) ||
    !!detailId ||
    (path === "/turmas" && ["PROFESSOR", "ADMIN"].includes(user.role));
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setDetail(null);
    setMaterials([]);
    setMaterialRules(null);
    setCreating(false);
    const load = async () => {
      try {
        const [items, access] = await Promise.all([
          api<Project[]>("/projects"),
          api<Scope>("/scope"),
        ]);
        if (!active) return;
        setProjects(items);
        setScope(access);
        if (detailId) {
          const [project, files, rules] = await Promise.all([
            api<Project>(`/projects/${detailId}`),
            api<Material[]>(`/projects/${detailId}/materials`),
            api<MaterialRules>(`/projects/${detailId}/material-rules`),
          ]);
          if (active) {
            setDetail(project);
            setMaterials(files);
            setMaterialRules(rules);
          }
        }
      } catch (failure) {
        if (!active) return;
        if (failure instanceof ApiError && failure.status === 401) expired();
        else setError((failure as Error).message);
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [user, detailId, revision, expired]);
  if (!knownPath)
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
        <span className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
          <Lock className="size-5" />
        </span>
        <h1 className="text-xl font-semibold tracking-tight">Página indisponível</h1>
        <p className="text-sm text-muted-foreground">
          Este endereço não está disponível no seu espaço.
        </p>
        <Button variant="outline" onClick={() => navigate("/projetos")}>
          Voltar aos projetos
        </Button>
      </div>
    );
  if (loading) return <Loading />;
  if (error)
    return (
      <div className="grid gap-4">
        <Notice>{error}</Notice>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setRevision(revision + 1)}>
            Tentar novamente
          </Button>
          <Button variant="ghost" onClick={() => navigate("/projetos")}>
            Voltar aos projetos
          </Button>
        </div>
      </div>
    );
  if (path === "/perfil") return <Profile user={user} />;
  if (path === "/turmas")
    return (
      <Classes
        scope={scope}
        projects={projects}
        navigate={navigate}
        expired={expired}
        onChanged={() => setRevision((value) => value + 1)}
      />
    );
  if (detail)
    return (
      <ProjectDetail
        detail={detail}
        setDetail={setDetail}
        materials={materials}
        setMaterials={setMaterials}
        materialRules={materialRules}
        refreshMaterialRules={refreshMaterialRules}
        reload={() => setRevision((value) => value + 1)}
        user={user}
        navigate={navigate}
        expired={expired}
      />
    );
  const filtered = projects.filter(
    (project) =>
      (!status || project.status === status) &&
      (!group || String(project.groupId) === group) &&
      (!pending ||
        (project.missingMaterials?.length ?? 0) > 0 === (pending === "true")) &&
      `${project.title} ${project.category} ${project.groupId}`
        .toLocaleLowerCase("pt-BR")
        .includes(query.toLocaleLowerCase("pt-BR")),
  );
  const stats = [
    { label: "Em preparação", status: "PREPARACAO", dot: "bg-info" },
    { label: "Em avaliação", status: "EM_AVALIACAO", dot: "bg-warning" },
    { label: "Finalizados", status: "FINALIZADO", dot: "bg-success" },
  ];
  return (
    <>
      <PageHeader
        eyebrow="Seu laboratório de possibilidades"
        title={<>Olá, {user.fullName.split(" ")[0]}<span className="text-subtle-foreground">.</span></>}
        intro={roleDescriptions[user.role]}
        actions={
          ["PROFESSOR", "ADMIN"].includes(user.role) && (
            <Button
              variant={creating ? "outline" : "default"}
              onClick={() => setCreating(!creating)}
            >
              {creating ? "Fechar formulário" : "+ Novo projeto"}
            </Button>
          )
        }
      />
      {creating && (
        <CreateProject
          scope={scope}
          projects={projects}
          expired={expired}
          onCreated={(project) => navigate(`/projetos/${project.id}`)}
        />
      )}
      <div className="mb-10 grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-[1.6fr_repeat(3,1fr)]">
        <div className="flex items-center gap-4 bg-card p-5">
          <span className="grid size-10 place-items-center rounded-lg bg-muted text-muted-foreground">
            <Folder className="size-5" />
          </span>
          <div className="grid">
            <span className="text-xs text-muted-foreground">
              {user.role === "ALUNO"
                ? "Projetos do meu grupo"
                : user.role === "AVALIADOR"
                  ? "Projetos atribuídos"
                  : user.role === "ADMIN"
                    ? "Projetos de todas as turmas"
                    : "Projetos da minha turma"}
            </span>
            <strong className="flex items-baseline gap-1.5 text-3xl font-semibold tracking-tight tabular-nums">
              {String(projects.length).padStart(2, "0")}
              <small className="text-xs font-normal text-muted-foreground">
                projetos
              </small>
            </strong>
          </div>
        </div>
        {stats.map((stat) => (
          <div
            key={stat.status}
            className="flex items-center justify-between gap-2 bg-card px-5 py-4 sm:flex-col sm:items-start sm:justify-center"
          >
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className={`size-1.5 rounded-full ${stat.dot}`} />
              {stat.label}
            </span>
            <strong className="text-xl font-semibold tabular-nums">
              {projects.filter((project) => project.status === stat.status).length}
            </strong>
          </div>
        ))}
      </div>
      <section aria-labelledby="projects-title">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2
            id="projects-title"
            className="flex items-center gap-2 text-lg font-semibold tracking-tight"
          >
            {user.role === "ALUNO" ? "Meu projeto" : "Seus projetos"}
            <Badge className="tabular-nums">{projects.length}</Badge>
          </h2>
          <span className="text-xs text-subtle-foreground">
            Cada ideia tem um próximo passo.
          </span>
        </div>
        <div className="mb-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle-foreground" />
            <Input
              aria-label="Buscar projetos"
              placeholder="Buscar por projeto, categoria ou grupo…"
              className="pl-9"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <NativeSelect
            aria-label="Filtrar por estado"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">Todos os estados</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect
            aria-label="Filtrar por grupo"
            value={group}
            onChange={(event) => setGroup(event.target.value)}
          >
            <option value="">Todos os grupos</option>
            {Array.from(
              new Map(
                projects.map((project) => [project.groupId, project]),
              ).values(),
            ).map((project) => (
              <option key={project.groupId} value={project.groupId}>
                {project.groupName ??
                  `Grupo ${String(project.groupId).padStart(2, "0")}`}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect
            aria-label="Filtrar por pendências"
            value={pending}
            onChange={(event) => setPending(event.target.value)}
          >
            <option value="">Todas as pendências</option>
            <option value="true">Com materiais pendentes</option>
            <option value="false">Sem materiais pendentes</option>
          </NativeSelect>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((project) => (
            <article
              className="group flex flex-col rounded-xl border bg-card p-5 transition-colors hover:border-input"
              key={project.id}
            >
              <div className="mb-4 flex items-center justify-between gap-2">
                <span className="truncate text-xs text-muted-foreground">
                  {project.category}
                </span>
                <StatusBadge status={project.status} />
              </div>
              <div className="flex-1 pb-5">
              <h3 className="text-base leading-snug font-medium [overflow-wrap:anywhere]">
                <a
                  className="text-foreground no-underline hover:underline"
                  href={`/projetos/${project.id}`}
                  onClick={(event) => {
                    event.preventDefault();
                    navigate(`/projetos/${project.id}`);
                  }}
                >
                  {project.title}
                </a>
              </h3>
              <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground [overflow-wrap:anywhere]">
                {project.description || "Descrição ainda não informada."}
              </p>
              {project.missingMaterials && (
                <p className="mt-3 text-xs text-muted-foreground">
                  {project.missingMaterials.length
                    ? `Pendentes: ${project.missingMaterials.map((kind) => materialLabels[kind]).join(", ")}`
                    : "Materiais obrigatórios presentes"}
                </p>
              )}
              </div>
              <div className="flex items-center justify-between gap-2 border-t pt-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <UserIcon className="size-3.5" />
                  {project.groupName ??
                    `Grupo ${String(project.groupId).padStart(2, "0")}`}
                </span>
                <a
                  className="flex items-center gap-1 font-medium text-foreground no-underline hover:underline"
                  aria-label={`Abrir ${project.title}`}
                  href={`/projetos/${project.id}`}
                  onClick={(event) => {
                    event.preventDefault();
                    navigate(`/projetos/${project.id}`);
                  }}
                >
                  Abrir projeto <ArrowRight className="size-3.5" />
                </a>
              </div>
            </article>
          ))}
        </div>
        {!filtered.length && (
          <Empty
            title={
              projects.length
                ? "Nenhum resultado por aqui"
                : "Seu espaço está pronto"
            }
            text={
              projects.length
                ? "Tente outro termo ou ajuste os filtros."
                : "Os projetos aparecerão aqui assim que forem vinculados ao seu perfil."
            }
          />
        )}
      </section>
      <p className="mt-10 flex items-center gap-1.5 text-xs text-subtle-foreground">
        <Lock className="size-3.5" />
        Você visualiza apenas os projetos permitidos ao seu perfil.
      </p>
    </>
  );
}

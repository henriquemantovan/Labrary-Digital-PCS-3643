import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "../api";
import type { Material, MaterialRules, Project, Scope, User } from "../api";
import { Lock, Search } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { ProjectBoard } from "../components/ProjectBoard";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../components/ui/input-group";
import { NativeSelect } from "../components/ui/native-select";
import { Empty, Loading, Notice } from "../components/Feedback";
import { roleDescriptions, statusLabels } from "../labels";
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
      <section
        aria-labelledby="projects-title"
        className="overflow-hidden rounded-2xl border bg-card shadow-xs/5"
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b px-4 py-3">
          <h2
            id="projects-title"
            className="flex items-center gap-2 text-base font-semibold tracking-tight"
          >
            {user.role === "ALUNO"
              ? "Meu projeto"
              : user.role === "AVALIADOR"
                ? "Projetos atribuídos"
                : user.role === "ADMIN"
                  ? "Projetos de todas as turmas"
                  : "Projetos da minha turma"}
            <Badge variant="secondary" className="tabular-nums">{projects.length}</Badge>
          </h2>
          <div className="grid w-full gap-2 sm:grid-cols-3 lg:ml-auto lg:flex lg:w-auto lg:flex-wrap lg:justify-end">
            <InputGroup className="sm:col-span-3 lg:w-72">
              <InputGroupInput
                aria-label="Buscar projetos"
                placeholder="Buscar por projeto, categoria ou grupo…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
            </InputGroup>
            <NativeSelect
              aria-label="Filtrar por estado"
              className="lg:w-auto"
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
              className="lg:w-auto"
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
              className="lg:w-auto"
              value={pending}
              onChange={(event) => setPending(event.target.value)}
            >
              <option value="">Todas as pendências</option>
              <option value="true">Com materiais pendentes</option>
              <option value="false">Sem materiais pendentes</option>
            </NativeSelect>
          </div>
        </div>
        {filtered.length ? (
          <ProjectBoard projects={filtered} navigate={navigate} />
        ) : (
          <div className="p-4">
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
          </div>
        )}
      </section>
      <p className="mt-10 flex items-center gap-1.5 text-xs text-subtle-foreground">
        <Lock className="size-3.5" />
        Você visualiza apenas os projetos permitidos ao seu perfil.
      </p>
    </>
  );
}

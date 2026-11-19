import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "../api";
import type { Material, MaterialRules, Project, Scope, User } from "../api";
import { Icon } from "../Icons";
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
      <div className="empty">
        <Icon name="lock" size={30} />
        <h1>Página indisponível</h1>
        <p>Este endereço não está disponível no seu espaço.</p>
        <button className="secondary" onClick={() => navigate("/projetos")}>
          Voltar aos projetos
        </button>
      </div>
    );
  if (loading) return <Loading />;
  if (error)
    return (
      <div className="error-page">
        <Notice>{error}</Notice>
        <div className="button-row">
          <button
            className="secondary"
            onClick={() => setRevision(revision + 1)}
          >
            Tentar novamente
          </button>
          <button className="text-button" onClick={() => navigate("/projetos")}>
            Voltar aos projetos
          </button>
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
      <div className="page-heading">
        <div>
          <p className="eyebrow">SEU LABORATÓRIO DE POSSIBILIDADES</p>
          <h1>
            Olá, {user.fullName.split(" ")[0]}
            <span className="greeting-dot">.</span>
          </h1>
          <p className="page-intro">{roleDescriptions[user.role]}</p>
        </div>
        {["PROFESSOR", "ADMIN"].includes(user.role) && (
          <button className="primary" onClick={() => setCreating(!creating)}>
            {creating ? "Fechar formulário" : "+ Novo projeto"}
          </button>
        )}
      </div>
      {creating && (
        <CreateProject
          scope={scope}
          projects={projects}
          expired={expired}
          onCreated={(project) => navigate(`/projetos/${project.id}`)}
        />
      )}
      <div className="overview">
        <div className="overview-main">
          <span className="overview-icon">
            <Icon name="folder" size={25} />
          </span>
          <div>
            <span className="muted">
              {user.role === "ALUNO"
                ? "Projetos do meu grupo"
                : user.role === "AVALIADOR"
                  ? "Projetos atribuídos"
                  : user.role === "ADMIN"
                    ? "Projetos de todas as turmas"
                    : "Projetos da minha turma"}
            </span>
            <strong>
              {String(projects.length).padStart(2, "0")}
              <small>projetos</small>
            </strong>
          </div>
        </div>
        <div className="overview-stat">
          <span className="stat-dot purple" />
          <span>Em preparação</span>
          <strong>
            {
              projects.filter((project) => project.status === "PREPARACAO")
                .length
            }
          </strong>
        </div>
        <div className="overview-stat">
          <span className="stat-dot pink" />
          <span>Em avaliação</span>
          <strong>
            {
              projects.filter((project) => project.status === "EM_AVALIACAO")
                .length
            }
          </strong>
        </div>
        <div className="overview-stat">
          <span className="stat-dot green" />
          <span>Finalizados</span>
          <strong>
            {
              projects.filter((project) => project.status === "FINALIZADO")
                .length
            }
          </strong>
        </div>
      </div>
      <section aria-labelledby="projects-title">
        <div className="section-heading">
          <h2 id="projects-title">
            {user.role === "ALUNO" ? "Meu projeto" : "Seus projetos"}
            <span className="count">{projects.length}</span>
          </h2>
          <span className="muted section-caption">
            Cada ideia tem um próximo passo.
          </span>
        </div>
        <div className="filter-bar">
          <div className="search-field">
            <Icon name="search" size={18} />
            <input
              aria-label="Buscar projetos"
              placeholder="Buscar por projeto, categoria ou grupo…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <select
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
          </select>
          <select
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
          </select>
          <select
            aria-label="Filtrar por pendências"
            value={pending}
            onChange={(event) => setPending(event.target.value)}
          >
            <option value="">Todas as pendências</option>
            <option value="true">Com materiais pendentes</option>
            <option value="false">Sem materiais pendentes</option>
          </select>
        </div>
        <div className="project-grid">
          {filtered.map((project, index) => (
            <article className="project-card" key={project.id}>
              <div
                className={`project-cover cover-${index % 3}`}
                aria-hidden="true"
              >
                <div className="cover-grid" />
                <div className="cover-chip">
                  <Icon
                    name={
                      project.category === "Instrumentação" ? "grid" : "folder"
                    }
                    size={38}
                  />
                </div>
                <span className="cover-id">
                  LD / {String(project.id).padStart(3, "0")}
                </span>
              </div>
              <div className="project-content">
                <div className="card-meta">
                  <span className="project-category">{project.category}</span>
                  <span className={`status-pill status-${project.status}`}>
                    <span />
                    {statusLabels[project.status]}
                  </span>
                </div>
                <h3>
                  <a
                    href={`/projetos/${project.id}`}
                    onClick={(event) => {
                      event.preventDefault();
                      navigate(`/projetos/${project.id}`);
                    }}
                  >
                    {project.title}
                  </a>
                </h3>
                <p>{project.description || "Descrição ainda não informada."}</p>
                {project.missingMaterials && (
                  <p>
                    {project.missingMaterials.length
                      ? `Pendentes: ${project.missingMaterials.map((kind) => materialLabels[kind]).join(", ")}`
                      : "Materiais obrigatórios presentes"}
                  </p>
                )}
                <div className="card-footer">
                  <span>
                    <Icon name="user" size={15} />
                    {project.groupName ??
                      `Grupo ${String(project.groupId).padStart(2, "0")}`}
                  </span>
                  <a
                    className="project-link"
                    aria-label={`Abrir ${project.title}`}
                    href={`/projetos/${project.id}`}
                    onClick={(event) => {
                      event.preventDefault();
                      navigate(`/projetos/${project.id}`);
                    }}
                  >
                    Abrir projeto <Icon name="arrow" size={16} />
                  </a>
                </div>
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
      <div className="access-note">
        <Icon name="lock" size={16} />
        Você visualiza apenas os projetos permitidos ao seu perfil.
      </div>
    </>
  );
}

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api, ApiError } from "./api";
import type { Material, Project, Scope, User } from "./api";
import { Icon } from "./Icons";

const roleLabels = {
  ALUNO: "Aluno",
  AVALIADOR: "Avaliador",
  PROFESSOR: "Professor",
};
const statusLabels: Record<string, string> = {
  PREPARACAO: "Em preparação",
  EM_AVALIACAO: "Em avaliação",
  AJUSTES: "Em ajustes",
  FINALIZADO: "Finalizado",
};
const roleDescriptions = {
  ALUNO: "Seu grupo, suas ideias e os próximos passos do seu projeto.",
  AVALIADOR: "Um olhar atento para os projetos que você acompanha.",
  PROFESSOR: "Uma visão dos projetos e grupos da sua turma.",
};
function Brand() {
  return (
    <span className="brand">
      <span className="brand-mark">
        <Icon name="book" size={23} />
      </span>
      <span>
        labrary<span className="brand-sub">DIGITAL</span>
      </span>
    </span>
  );
}
function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="notice" role="alert">
      {children}
    </div>
  );
}
function Loading() {
  return (
    <div className="loading" role="status">
      <span className="spinner" />
      Carregando seu espaço…
    </div>
  );
}

function Login({
  onLogin,
  message,
}: {
  onLogin: (user: User) => void;
  message: string;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      onLogin(
        await api<User>("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email: email.trim(), password }),
        }),
      );
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-layout">
      <section className="login-story" aria-labelledby="story-title">
        <Brand />
        <div className="story-copy">
          <p className="eyebrow">
            <span className="live-dot" /> UM ESPAÇO PARA CONSTRUIR
          </p>
          <h1 id="story-title">
            Grandes ideias.
            <br />
            Conexões <em>reais.</em>
          </h1>
          <p>
            Do primeiro circuito à última entrega.
            <br />O ponto de encontro dos seus projetos de sistemas digitais.
          </p>
        </div>
        <div className="circuit-art" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="orbit orbit-three" />
          <div className="circuit-line line-one" />
          <div className="circuit-line line-two" />
          <span className="art-node node-one">01</span>
          <span className="art-node node-two">10</span>
          <span className="art-label label-one">ideia</span>
          <span className="art-label label-two">conexão</span>
          <div className="chip">
            <span className="chip-pins" />
            <Icon name="book" size={60} />
            <span className="chip-caption">LABRARY / DIGITAL</span>
          </div>
          <span className="orbit-dot dot-one" />
          <span className="orbit-dot dot-two" />
        </div>
        <div className="story-footer">
          <span>Aprender. Criar. Compartilhar.</span>
          <span>PCS3643 ↗</span>
        </div>
      </section>
      <section className="login-form-panel" aria-labelledby="login-title">
        <div className="login-top">
          <span className="small-dot" /> AMBIENTE ACADÊMICO
        </div>
        <div className="login-form-wrap">
          <span className="login-symbol">
            <Icon name="lock" size={24} />
          </span>
          <p className="eyebrow">BEM-VINDO DE VOLTA</p>
          <h2 id="login-title">
            Seu próximo projeto
            <br />
            começa aqui.
          </h2>
          <p className="muted login-description">
            Entre com sua conta para acessar seu espaço.
          </p>
          {(error || message) && <Notice>{error || message}</Notice>}
          <form onSubmit={submit} aria-label="Entrar na conta">
            <label htmlFor="email">E-mail institucional</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              placeholder="seu.nome@instituicao.br"
              required
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={busy}
            />
            <label htmlFor="password">Senha</label>
            <div className="password-field">
              <input
                id="password"
                type={visible ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Digite sua senha"
                required
                maxLength={256}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={busy}
              />
              <button
                type="button"
                className="icon-button"
                aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
                aria-pressed={visible}
                onClick={() => setVisible(!visible)}
              >
                <Icon name={visible ? "eyeOff" : "eye"} />
              </button>
            </div>
            <button
              className="primary login-submit"
              disabled={busy}
              type="submit"
            >
              <span>{busy ? "Entrando…" : "Entrar no meu espaço"}</span>
              {busy ? <span className="spinner" /> : <Icon name="arrow" />}
            </button>
          </form>
          <p className="account-help">
            Precisa de acesso ou esqueceu sua senha?
            <br />
            <span>Entre em contato com o professor da sua turma.</span>
          </p>
          <div className="login-security">
            <Icon name="lock" size={15} />
            <span>Acesso de acordo com o seu perfil acadêmico.</span>
          </div>
        </div>
        <footer className="login-footer">
          Labrary Digital <span>Projetos que conectam.</span>
        </footer>
      </section>
    </main>
  );
}

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [startupError, setStartupError] = useState("");
  const [message, setMessage] = useState("");
  const [path, setPath] = useState(window.location.pathname);
  const [busy, setBusy] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const navigate = useCallback((next: string) => {
    window.history.pushState(null, "", next);
    setPath(next);
  }, []);
  const expired = useCallback(() => {
    setUser(null);
    setMessage("Sua sessão terminou. Entre novamente para continuar.");
  }, []);
  const bootstrap = useCallback(async () => {
    setInitializing(true);
    setStartupError("");
    try {
      setUser(await api<User>("/auth/me"));
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 401))
        setStartupError((error as Error).message);
    } finally {
      setInitializing(false);
    }
  }, []);
  useEffect(() => {
    void bootstrap();
    const pop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, [bootstrap]);
  useEffect(() => {
    if (!user) return;
    let active = true;
    const check = () => {
      if (document.visibilityState === "visible")
        void api<User>("/auth/me")
          .then((current) => {
            if (active) setUser(current);
          })
          .catch((error) => {
            if (active && error instanceof ApiError && error.status === 401)
              expired();
          });
    };
    document.addEventListener("visibilitychange", check);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", check);
    };
  }, [user, expired]);
  async function logout() {
    setBusy(true);
    setLogoutError("");
    try {
      await api<void>("/auth/logout", { method: "POST" });
      setUser(null);
      setMessage("");
      navigate("/");
    } catch (error) {
      setLogoutError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (initializing)
    return (
      <main className="startup">
        <Brand />
        <Loading />
      </main>
    );
  if (startupError)
    return (
      <main className="startup">
        <Brand />
        <Notice>{startupError}</Notice>
        <button className="primary" onClick={() => void bootstrap()}>
          Tentar novamente
        </button>
      </main>
    );
  if (!user)
    return (
      <Login
        message={message}
        onLogin={(current) => {
          setUser(current);
          setMessage("");
          setLogoutError("");
          if (path === "/" || path === "/login") navigate("/projetos");
        }}
      />
    );
  return (
    <div className="workspace">
      <a className="skip-link" href="#main">
        Pular para o conteúdo
      </a>
      <aside className="sidebar">
        <a
          href="/projetos"
          onClick={(event) => {
            event.preventDefault();
            navigate("/projetos");
          }}
        >
          <Brand />
        </a>
        <div className="workspace-name">
          <span className="workspace-dot" /> Espaço acadêmico{" "}
          <span className="tiny-badge">2026</span>
        </div>
        <p className="nav-label">MEU ESPAÇO</p>
        <nav aria-label="Navegação principal">
          <button
            className={
              path.startsWith("/projetos") || path === "/"
                ? "nav-item active"
                : "nav-item"
            }
            onClick={() => navigate("/projetos")}
          >
            <Icon name="grid" />
            {user.role === "ALUNO" ? "Meu projeto" : "Projetos"}
            <span className="nav-active-dot" />
          </button>
          {user.role === "PROFESSOR" && (
            <button
              className={`nav-item ${path === "/turmas" ? "active" : ""}`}
              onClick={() => navigate("/turmas")}
            >
              <Icon name="book" />
              Minhas turmas
            </button>
          )}
          <button
            className={`nav-item ${path === "/perfil" ? "active" : ""}`}
            onClick={() => navigate("/perfil")}
          >
            <Icon name="user" />
            Meu perfil
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="note-spark">✦</span>
            <strong>
              Ideias ganham vida
              <br />
              quando conectadas.
            </strong>
            <p>Seu laboratório de possibilidades.</p>
          </div>
          <div className="sidebar-user">
            <span className="avatar">
              {user.fullName
                .split(" ")
                .map((part) => part[0])
                .slice(0, 2)
                .join("")}
            </span>
            <div>
              <strong>{user.fullName}</strong>
              <span>{roleLabels[user.role]}</span>
            </div>
          </div>
          <button
            className="logout"
            disabled={busy}
            onClick={() => void logout()}
          >
            <Icon name="logout" size={17} />
            {busy ? "Saindo…" : "Sair da conta"}
          </button>
        </div>
      </aside>
      <div className="workspace-body">
        <header className="workspace-header">
          <span>
            Meu espaço <span className="breadcrumb">/</span>{" "}
            <strong>
              {path === "/perfil"
                ? "Perfil"
                : path === "/turmas"
                  ? "Turmas"
                  : "Projetos"}
            </strong>
          </span>
          <span className="profile-badge">
            <span className="small-dot" />
            {roleLabels[user.role]}
          </span>
        </header>
        <main id="main" className="workspace-main">
          {logoutError && <Notice>{logoutError}</Notice>}
          <Dashboard
            user={user}
            path={path}
            navigate={navigate}
            expired={expired}
          />
        </main>
        <footer className="workspace-footer">
          <span>LABRARY DIGITAL</span>
          <span>Um espaço para aprender e construir.</span>
        </footer>
      </div>
    </div>
  );
}

function Dashboard({
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [creating, setCreating] = useState(false);
  const detailId = /^\/projetos\/(\d+)$/.exec(path)?.[1];
  const knownPath =
    ["/", "/projetos", "/perfil"].includes(path) ||
    !!detailId ||
    (path === "/turmas" && user.role === "PROFESSOR");
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setDetail(null);
    setMaterials([]);
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
          const [project, files] = await Promise.all([
            api<Project>(`/projects/${detailId}`),
            api<Material[]>(`/projects/${detailId}/materials`),
          ]);
          if (active) {
            setDetail(project);
            setMaterials(files);
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
  if (path === "/perfil")
    return (
      <>
        <p className="eyebrow">SUA CONTA</p>
        <h1>Meu perfil</h1>
        <p className="page-intro">Seu lugar na comunidade Labrary.</p>
        <section className="profile-card">
          <span className="avatar large">
            <Icon name="user" size={32} />
          </span>
          <h2>{user.fullName}</h2>
          <span className="profile-badge">{roleLabels[user.role]}</span>
          <dl>
            <dt>E-mail</dt>
            <dd>{user.email}</dd>
            <dt>Permissões</dt>
            <dd>{roleDescriptions[user.role]}</dd>
          </dl>
          <p className="muted">
            Para atualizar sua conta ou seus vínculos, fale com o professor
            responsável.
          </p>
        </section>
      </>
    );
  if (path === "/turmas")
    return (
      <>
        <p className="eyebrow">GESTÃO ACADÊMICA</p>
        <h1>Minhas turmas</h1>
        <p className="page-intro">
          Grupos e projetos sob sua responsabilidade.
        </p>
        <div className="project-grid">
          {scope.classes.map((item) => (
            <article className="class-card" key={item.id}>
              <Icon name="book" size={28} />
              <span className="eyebrow">{item.academicYear}</span>
              <h2>{item.name}</h2>
              <p>
                {
                  scope.groups.filter((group) => group.classId === item.id)
                    .length
                }{" "}
                grupos ·{" "}
                {
                  projects.filter((project) => project.classId === item.id)
                    .length
                }{" "}
                projetos
              </p>
              <ul className="group-list">
                {scope.groups
                  .filter((group) => group.classId === item.id)
                  .map((group) => (
                    <li key={group.id}>
                      <span>{group.name}</span>
                      <span>
                        {projects.some(
                          (project) => project.groupId === group.id,
                        )
                          ? "Projeto cadastrado"
                          : "Sem projeto"}
                      </span>
                    </li>
                  ))}
              </ul>
              <button
                className="text-button"
                onClick={() => navigate("/projetos")}
              >
                Gerenciar projetos <Icon name="arrow" size={16} />
              </button>
            </article>
          ))}
        </div>
        {!scope.classes.length && (
          <Empty
            title="Nenhuma turma vinculada"
            text="Suas turmas aparecerão aqui quando forem vinculadas à sua conta."
          />
        )}
      </>
    );
  if (detail)
    return (
      <>
        <button
          className="text-button back"
          onClick={() => navigate("/projetos")}
        >
          <Icon name="back" size={17} />
          Todos os projetos
        </button>
        <p className="eyebrow">
          {detail.category} · GRUPO {String(detail.groupId).padStart(2, "0")}
        </p>
        <h1>{detail.title}</h1>
        <p className="page-intro">
          {detail.description || "Este projeto ainda não tem uma descrição."}
        </p>
        <span className={`status-pill status-${detail.status}`}>
          <span />
          {statusLabels[detail.status]}
        </span>
        <section className="detail-section">
          <div className="section-heading">
            <h2>Materiais do projeto</h2>
            <span>{materials.length} materiais</span>
          </div>
          {materials.length ? (
            <ul className="material-list">
              {materials.map((item) => (
                <li key={item.id}>
                  <Icon name="book" />
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.originalFilename}</span>
                  </div>
                  <span className="tiny-badge">v{item.versionNumber}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty
              title="Uma ideia em construção"
              text="Ainda não há materiais registrados neste projeto."
            />
          )}
        </section>
        <div className="access-note">
          <Icon name="lock" size={17} />
          Acesso restrito ao grupo e à equipe acadêmica vinculada ao projeto.
        </div>
      </>
    );
  const filtered = projects.filter(
    (project) =>
      (!status || project.status === status) &&
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
        {user.role === "PROFESSOR" && (
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
                <div className="card-footer">
                  <span>
                    <Icon name="user" size={15} />
                    Grupo {String(project.groupId).padStart(2, "0")}
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
                ? "Tente outro termo ou selecione um estado diferente."
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
function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon name="folder" size={28} />
      </span>
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  );
}
function CreateProject({
  scope,
  projects,
  onCreated,
  expired,
}: {
  scope: Scope;
  projects: Project[];
  onCreated: (project: Project) => void;
  expired: () => void;
}) {
  const groups = scope.groups.filter(
    (group) => !projects.some((project) => project.groupId === group.id),
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const group = groups.find(
      (item) => item.id === Number(data.get("groupId")),
    );
    if (!group) return;
    setBusy(true);
    setError("");
    try {
      onCreated(
        await api<Project>("/projects", {
          method: "POST",
          body: JSON.stringify({
            groupId: group.id,
            classId: group.classId,
            title: data.get("title"),
            description: data.get("description"),
            category: data.get("category"),
          }),
        }),
      );
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) expired();
      else setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="create-panel">
      <h2>Novo projeto</h2>
      {error && <Notice>{error}</Notice>}
      {!groups.length ? (
        <p className="muted">
          Todos os grupos vinculados já têm projeto. O cadastro de novos grupos
          faz parte da próxima etapa.
        </p>
      ) : (
        <form onSubmit={submit}>
          <fieldset disabled={busy}>
            <div className="form-grid">
              <label>
                Título
                <input name="title" required maxLength={200} />
              </label>
              <label>
                Grupo
                <select name="groupId">
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name} ·{" "}
                      {
                        scope.classes.find((item) => item.id === group.classId)
                          ?.name
                      }
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Categoria
                <input name="category" required maxLength={100} />
              </label>
              <label>
                Descrição
                <textarea name="description" maxLength={10000} rows={2} />
              </label>
            </div>
            <button className="primary" type="submit">
              {busy ? "Criando…" : "Criar projeto"}
              <Icon name="arrow" size={17} />
            </button>
          </fieldset>
        </form>
      )}
    </section>
  );
}

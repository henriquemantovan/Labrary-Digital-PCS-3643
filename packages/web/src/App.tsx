import { useEffect, useState } from "react";

type ApiStatus = "carregando" | "online" | "offline";

interface ProjectCard {
  id: number;
  title: string;
  description: string;
  category: string;
  status: string;
}

export function App() {
  const [apiStatus, setApiStatus] = useState<ApiStatus>("carregando");
  const [projects, setProjects] = useState<ProjectCard[]>([]);

  useEffect(() => {
    fetch("/api/projects")
      .then((response) => {
        if (!response.ok) throw new Error("API indisponível");
        return response.json();
      })
      .then((result: { data: ProjectCard[] }) => {
        setProjects(result.data);
        setApiStatus("online");
      })
      .catch(() => setApiStatus("offline"));
  }, []);

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Labrary Digital início">
          <span className="brand-mark" aria-hidden="true">L</span>
          <span>Labrary <strong>Digital</strong></span>
        </a>
        <span className={`status status--${apiStatus}`} role="status">
          <span className="status-dot" aria-hidden="true" />
          API {apiStatus === "online" ? "conectada" : apiStatus === "offline" ? "indisponível" : "conectando"}
        </span>
      </header>

      <section className="welcome" aria-labelledby="welcome-title">
        <p className="eyebrow">PCS3643 · Laboratório de Engenharia de Software</p>
        <h1 id="welcome-title">Projetos que merecem ser <em>compartilhados.</em></h1>
        <p className="intro">
          Um espaço para acompanhar entregas, trocar feedback e dar visibilidade
          aos projetos de sistemas digitais.
        </p>
        <div className="welcome-meta">
          <span>View React pronta</span>
          <span className="meta-separator" aria-hidden="true">·</span>
          <span>API REST em desenvolvimento</span>
        </div>
      </section>

      {apiStatus === "online" && (
        <section className="projects" aria-labelledby="projects-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Amostra local</p>
              <h2 id="projects-title">Projetos em andamento</h2>
            </div>
            <span>{projects.length.toString().padStart(2, "0")} projetos</span>
          </div>
          <div className="project-grid">
            {projects.map((project) => (
              <article className="project-card" key={project.id}>
                <p className="project-category">{project.category}</p>
                <h3>{project.title}</h3>
                <p>{project.description}</p>
                <span className="project-status">{project.status.replaceAll("_", " ")}</span>
              </article>
            ))}
          </div>
        </section>
      )}

      <footer>Uma biblioteca feita em equipe, para aprender em equipe.</footer>
    </main>
  );
}

import { useEffect, useState } from "react";

type ApiStatus = "carregando" | "online" | "offline";

export function App() {
  const [apiStatus, setApiStatus] = useState<ApiStatus>("carregando");

  useEffect(() => {
    fetch("/api/health")
      .then((response) => {
        if (!response.ok) throw new Error("API indisponível");
        return response.json();
      })
      .then(() => setApiStatus("online"))
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

      <footer>Uma biblioteca feita em equipe, para aprender em equipe.</footer>
    </main>
  );
}

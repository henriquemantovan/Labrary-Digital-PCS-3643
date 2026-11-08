import { useEffect, useState } from "react";
import { filterCatalog } from "./catalogClient";
import type {
  CatalogFilter,
  PublicProject,
  PublicPublicationProvider,
} from "./catalogClient";
import { Icon } from "./Icons";

export function Catalog({
  provider,
  demo = false,
  basePath = "/acervo",
}: {
  provider: PublicPublicationProvider;
  demo?: boolean;
  basePath?: string;
}) {
  const [path, setPath] = useState(window.location.pathname);
  const [filter, setFilter] = useState<CatalogFilter>({});
  const [projects, setProjects] = useState<PublicProject[]>([]);
  const [detail, setDetail] = useState<PublicProject>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const suffix = path.slice(basePath.length).replace(/^\//, "");
  const isDetail = suffix !== "";
  const id = /^[1-9]\d*$/.test(suffix) ? Number(suffix) : 0;

  useEffect(() => {
    const pop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setDetail(undefined);
    setProjects([]);
    async function load() {
      try {
        if (isDetail) {
          const item =
            Number.isSafeInteger(id) && id > 0
              ? await provider.get(id)
              : undefined;
          if (active) setDetail(item);
        } else {
          const items = await provider.list({});
          if (active) setProjects(items);
        }
      } catch {
        if (active)
          setError("Não foi possível carregar o acervo. Tente novamente.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [provider, id, isDetail, attempt]);

  function navigate(next: string) {
    window.history.pushState(null, "", next);
    setPath(next);
    window.scrollTo(0, 0);
  }
  const filtered = filterCatalog(projects, filter);
  return (
    <div className="catalog-shell">
      <a className="skip-link" href="#catalog-main">
        Pular para o conteúdo
      </a>
      <header className="catalog-header">
        <a
          href={basePath}
          onClick={(event) => {
            event.preventDefault();
            navigate(basePath);
          }}
          className="brand"
        >
          <Icon name="book" /> labrary digital
        </a>
        <a className="secondary" href="/login">
          Meu espaço
        </a>
      </header>
      <main id="catalog-main">
        {demo && (
          <aside className="catalog-demo" aria-label="Demonstração">
            Demonstração — dados fictícios. Os materiais são exemplos, sem
            arquivos disponíveis. A publicação real ainda não está integrada.
          </aside>
        )}
        {isDetail && (
          <button className="secondary" onClick={() => navigate(basePath)}>
            ← Voltar ao acervo
          </button>
        )}
        {!isDetail && (
          <div className="page-heading">
            <div>
              <p className="eyebrow">IDEIAS PARA EXPLORAR</p>
              <h1>Acervo de projetos</h1>
              <p className="page-intro">
                Explore projetos por título, ano, turma e categoria.
              </p>
            </div>
          </div>
        )}
        {loading && <p role="status">Carregando acervo…</p>}
        {error && (
          <div className="notice" role="alert">
            <p>{error}</p>
            <button
              className="secondary"
              onClick={() => setAttempt((value) => value + 1)}
            >
              Tentar novamente
            </button>
          </div>
        )}
        {!loading &&
          !error &&
          (isDetail ? (
            detail ? (
              <CatalogDetail key={detail.id} project={detail} demo={demo} />
            ) : (
              <div className="empty">
                <h1>Publicação não encontrada</h1>
                <p>O projeto não está disponível no acervo.</p>
              </div>
            )
          ) : (
            <>
              <section
                className="catalog-filters"
                aria-label="Filtros do acervo"
              >
                <label>
                  Buscar por título
                  <input
                    type="search"
                    value={filter.q ?? ""}
                    onChange={(e) =>
                      setFilter({ ...filter, q: e.target.value })
                    }
                  />
                </label>
                <label>
                  Ano
                  <select
                    value={filter.academicYear ?? ""}
                    onChange={(e) =>
                      setFilter({
                        ...filter,
                        academicYear: e.target.value
                          ? Number(e.target.value)
                          : undefined,
                      })
                    }
                  >
                    <option value="">Todos os anos</option>
                    {[...new Set(projects.map((p) => p.academicYear))]
                      .sort((a, b) => b - a)
                      .map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Turma
                  <select
                    value={filter.classId ?? ""}
                    onChange={(e) =>
                      setFilter({
                        ...filter,
                        classId: e.target.value
                          ? Number(e.target.value)
                          : undefined,
                      })
                    }
                  >
                    <option value="">Todas as turmas</option>
                    {[
                      ...new Map(
                        projects.map((p) => [p.class.id, p.class]),
                      ).values(),
                    ].map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Categoria
                  <select
                    value={filter.category ?? ""}
                    onChange={(e) =>
                      setFilter({
                        ...filter,
                        category: e.target.value || undefined,
                      })
                    }
                  >
                    <option value="">Todas as categorias</option>
                    {[...new Set(projects.map((p) => p.category))]
                      .sort()
                      .map((category) => (
                        <option key={category}>{category}</option>
                      ))}
                  </select>
                </label>
                <button className="secondary" onClick={() => setFilter({})}>
                  Limpar filtros
                </button>
              </section>
              <p role="status">{filtered.length} projeto(s) encontrado(s)</p>
              {!filtered.length && (
                <div className="empty">
                  <h2>
                    {projects.length
                      ? "Nenhum resultado"
                      : "Nenhum projeto publicado"}
                  </h2>
                  <p>
                    {projects.length
                      ? "Ajuste a busca ou limpe os filtros."
                      : "Novas publicações aparecerão aqui."}
                  </p>
                </div>
              )}
              <div className="project-grid catalog-grid">
                {filtered.map((project, index) => (
                  <article className="project-card" key={project.id}>
                    <div
                      className={`project-cover cover-${index % 3}`}
                      aria-hidden="true"
                    >
                      <div className="cover-grid" />
                      <div className="cover-chip">
                        <Icon name="folder" size={38} />
                      </div>
                    </div>
                    <div className="project-content">
                      <p className="project-category">
                        {project.category} · {project.academicYear}
                      </p>
                      <h2>
                        <a
                          href={`${basePath}/${project.id}`}
                          onClick={(event) => {
                            event.preventDefault();
                            navigate(`${basePath}/${project.id}`);
                          }}
                        >
                          {project.title}
                        </a>
                      </h2>
                      <p>{project.description}</p>
                      <p className="muted">{project.class.name}</p>
                    </div>
                  </article>
                ))}
              </div>
            </>
          ))}
      </main>
    </div>
  );
}

function CatalogDetail({
  project,
  demo,
}: {
  project: PublicProject;
  demo: boolean;
}) {
  const [failedVideos, setFailedVideos] = useState<number[]>([]);
  return (
    <article className="catalog-detail">
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            {project.category} · {project.academicYear}
          </p>
          <h1>{project.title}</h1>
          <p className="page-intro">{project.class.name}</p>
        </div>
      </div>
      <section className="detail-section">
        <h2>Sobre o projeto</h2>
        <p className="catalog-description">{project.description}</p>
      </section>
      <section className="detail-section" aria-labelledby="public-materials">
        <h2 id="public-materials">Materiais autorizados</h2>
        {!project.materials.length && (
          <p>Nenhum material autorizado para consulta pública.</p>
        )}
        <div className="catalog-materials">
          {project.materials.map((material) => (
            <section key={material.versionId} className="catalog-material">
              <h3>{material.title}</h3>
              {demo ? (
                <p className="muted">
                  Exemplo de {material.kind.toLocaleLowerCase("pt-BR")}{" "}
                  autorizado — sem arquivo nesta demonstração.
                </p>
              ) : material.kind === "VIDEO" ? (
                <>
                  {failedVideos.includes(material.versionId) ? (
                    <p role="alert">
                      Não foi possível reproduzir o vídeo. A publicação pode ter
                      sido retirada. Recarregue a página para consultar a
                      disponibilidade.
                    </p>
                  ) : (
                    <video
                      controls
                      preload="metadata"
                      aria-label={material.title}
                      src={material.contentUrl}
                      onError={() =>
                        setFailedVideos((items) => [
                          ...items,
                          material.versionId,
                        ])
                      }
                    />
                  )}
                </>
              ) : (
                <a className="secondary" href={material.contentUrl}>
                  Baixar {material.title}
                </a>
              )}
            </section>
          ))}
        </div>
      </section>
    </article>
  );
}

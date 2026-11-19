import { useEffect, useState } from "react";
import { filterCatalog } from "./catalogClient";
import type {
  CatalogFilter,
  PublicProject,
  PublicPublicationProvider,
} from "./catalogClient";
import { Download } from "lucide-react";
import { Brand } from "./components/Brand";
import { Loading, Notice } from "./components/Feedback";
import { PageHeader } from "./components/PageHeader";
import { Button, buttonVariants } from "./components/ui/button";
import { fieldLabel, Input, NativeSelect } from "./components/ui/input";

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
    <div className="min-h-dvh bg-background">
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-full focus:bg-card focus:px-4 focus:py-2 focus:text-sm"
        href="#catalog-main"
      >
        Pular para o conteúdo
      </a>
      <header className="sticky top-0 z-10 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1120px] items-center justify-between gap-4 px-5 py-3 md:px-8">
          <a
            href={basePath}
            aria-label="labrary digital"
            className="no-underline"
            onClick={(event) => {
              event.preventDefault();
              navigate(basePath);
            }}
          >
            <Brand />
          </a>
          <a className={buttonVariants({ variant: "outline", size: "sm" })} href="/login">
            Meu espaço
          </a>
        </div>
      </header>
      <main
        id="catalog-main"
        className="mx-auto max-w-[1120px] px-5 py-10 md:px-8 [overflow-wrap:anywhere]"
      >
        {demo && (
          <aside
            className="mb-6 rounded-xl border border-info/25 bg-info/5 px-4 py-3 text-sm text-foreground"
            aria-label="Demonstração"
          >
            Demonstração — dados fictícios. Os materiais são exemplos, sem
            arquivos disponíveis. A publicação real ainda não está integrada.
          </aside>
        )}
        {isDetail && (
          <Button
            variant="ghost"
            size="sm"
            className="mb-4 -ml-3 text-muted-foreground"
            onClick={() => navigate(basePath)}
          >
            ← Voltar ao acervo
          </Button>
        )}
        {!isDetail && (
          <PageHeader
            eyebrow="Ideias para explorar"
            title="Acervo de projetos"
            intro="Explore projetos por título, ano, turma e categoria."
          />
        )}
        {loading && <Loading label="Carregando acervo…" />}
        {error && (
          <Notice>
            <p>{error}</p>
            <button onClick={() => setAttempt((value) => value + 1)}>
              Tentar novamente
            </button>
          </Notice>
        )}
        {!loading &&
          !error &&
          (isDetail ? (
            detail ? (
              <CatalogDetail key={detail.id} project={detail} demo={demo} />
            ) : (
              <div className="rounded-xl border border-dashed bg-card px-6 py-16 text-center">
                <h1 className="text-xl font-semibold tracking-tight">
                  Publicação não encontrada
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  O projeto não está disponível no acervo.
                </p>
              </div>
            )
          ) : (
            <>
              <section
                className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1.4fr_1.4fr_auto]"
                aria-label="Filtros do acervo"
              >
                <label className={fieldLabel}>
                  Buscar por título
                  <Input
                    type="search"
                    value={filter.q ?? ""}
                    onChange={(e) =>
                      setFilter({ ...filter, q: e.target.value })
                    }
                  />
                </label>
                <label className={fieldLabel}>
                  Ano
                  <NativeSelect
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
                  </NativeSelect>
                </label>
                <label className={fieldLabel}>
                  Turma
                  <NativeSelect
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
                  </NativeSelect>
                </label>
                <label className={fieldLabel}>
                  Categoria
                  <NativeSelect
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
                  </NativeSelect>
                </label>
                <Button
                  variant="ghost"
                  className="h-10"
                  onClick={() => setFilter({})}
                >
                  Limpar filtros
                </Button>
              </section>
              <p role="status" className="mt-6 mb-4 text-xs text-muted-foreground">
                {filtered.length} projeto(s) encontrado(s)
              </p>
              {!filtered.length && (
                <div className="rounded-xl border border-dashed bg-card px-6 py-14 text-center">
                  <h2 className="text-base font-medium">
                    {projects.length
                      ? "Nenhum resultado"
                      : "Nenhum projeto publicado"}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {projects.length
                      ? "Ajuste a busca ou limpe os filtros."
                      : "Novas publicações aparecerão aqui."}
                  </p>
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map((project) => (
                  <article
                    className="flex flex-col rounded-xl border bg-card p-5 transition-colors hover:border-input"
                    key={project.id}
                  >
                    <p className="mb-3 text-xs text-muted-foreground">
                      {project.category} · {project.academicYear}
                    </p>
                    <h2 className="text-base leading-snug font-medium">
                      <a
                        className="text-foreground no-underline hover:underline"
                        href={`${basePath}/${project.id}`}
                        onClick={(event) => {
                          event.preventDefault();
                          navigate(`${basePath}/${project.id}`);
                        }}
                      >
                        {project.title}
                      </a>
                    </h2>
                    <p className="mt-1.5 line-clamp-3 flex-1 text-sm text-muted-foreground">
                      {project.description}
                    </p>
                    <p className="mt-4 border-t pt-3 text-xs text-subtle-foreground">
                      {project.class.name}
                    </p>
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
    <article>
      <PageHeader
        eyebrow={
          <>
            {project.category} · {project.academicYear}
          </>
        }
        title={project.title}
        intro={project.class.name}
      />
      <div className="grid gap-6">
        <section className="rounded-xl border bg-card p-5 md:p-6">
          <h2 className="mb-3 text-base font-semibold tracking-tight">Sobre o projeto</h2>
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
            {project.description}
          </p>
        </section>
        <section
          className="rounded-xl border bg-card p-5 md:p-6"
          aria-labelledby="public-materials"
        >
          <h2
            id="public-materials"
            className="mb-4 text-base font-semibold tracking-tight"
          >
            Materiais autorizados
          </h2>
          {!project.materials.length && (
            <p className="text-sm text-muted-foreground">
              Nenhum material autorizado para consulta pública.
            </p>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            {project.materials.map((material) => (
              <section
                key={material.versionId}
                className="grid content-start gap-3 rounded-lg border p-4"
              >
                <h3 className="text-sm font-medium">{material.title}</h3>
                {demo ? (
                  <p className="text-sm text-muted-foreground">
                    Exemplo de {material.kind.toLocaleLowerCase("pt-BR")}{" "}
                    autorizado — sem arquivo nesta demonstração.
                  </p>
                ) : material.kind === "VIDEO" ? (
                  <>
                    {failedVideos.includes(material.versionId) ? (
                      <p role="alert" className="text-sm text-destructive">
                        Não foi possível reproduzir o vídeo. A publicação pode ter
                        sido retirada. Recarregue a página para consultar a
                        disponibilidade.
                      </p>
                    ) : (
                      <video
                        className="block max-h-[420px] w-full rounded-lg bg-black"
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
                  <a
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                      className: "justify-self-start",
                    })}
                    href={material.contentUrl}
                  >
                    <Download />
                    Baixar {material.title}
                  </a>
                )}
              </section>
            ))}
          </div>
        </section>
      </div>
    </article>
  );
}

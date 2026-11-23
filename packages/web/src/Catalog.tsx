import { useEffect, useState } from "react";
import { filterCatalog } from "./catalogClient";
import type {
  CatalogFilter,
  PublicProject,
  PublicPublicationProvider,
} from "./catalogClient";
import { ArrowLeft, ArrowUpRight, Download, FileText, Info, Search } from "lucide-react";
import { Brand } from "./components/Brand";
import { Empty, Loading, Notice } from "./components/Feedback";
import { PageHeader } from "./components/PageHeader";
import { Badge } from "./components/ui/badge";
import { Button, buttonVariants } from "./components/ui/button";
import { Card, CardHeader, CardPanel, CardTitle } from "./components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "./components/ui/input-group";
import { Label } from "./components/ui/label";
import { NativeSelect } from "./components/ui/native-select";

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
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:bg-background focus:px-4 focus:py-2 focus:text-sm"
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
            className="mb-6 flex items-start gap-2 rounded-xl border border-info/32 bg-info/4 px-3.5 py-3 text-sm text-foreground [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-info"
            aria-label="Demonstração"
          >
            <Info />
            Demonstração — dados fictícios. Os materiais são exemplos, sem
            arquivos disponíveis. A publicação real ainda não está integrada.
          </aside>
        )}
        {isDetail && (
          <Button
            variant="ghost"
            size="sm"
            className="mb-4 -ml-2 text-muted-foreground"
            onClick={() => navigate(basePath)}
          >
            <ArrowLeft />
            Voltar ao acervo
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
            <Button
              variant="outline"
              size="xs"
              onClick={() => setAttempt((value) => value + 1)}
            >
              Tentar novamente
            </Button>
          </Notice>
        )}
        {!loading &&
          !error &&
          (isDetail ? (
            detail ? (
              <CatalogDetail key={detail.id} project={detail} demo={demo} />
            ) : (
              <Empty
                title="Publicação não encontrada"
                text="O projeto não está disponível no acervo."
              />
            )
          ) : (
            <>
              <section
                className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1.4fr_1.4fr_auto]"
                aria-label="Filtros do acervo"
              >
                <div className="flex flex-col gap-2">
                  <Label htmlFor="catalog-q">Buscar por título</Label>
                  <InputGroup>
                    <InputGroupInput
                      id="catalog-q"
                      type="search"
                      placeholder="Ex.: semáforo, energia…"
                      value={filter.q ?? ""}
                      onChange={(e) =>
                        setFilter({ ...filter, q: e.target.value })
                      }
                    />
                    <InputGroupAddon>
                      <Search />
                    </InputGroupAddon>
                  </InputGroup>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="catalog-year">Ano</Label>
                  <NativeSelect
                    id="catalog-year"
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
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="catalog-class">Turma</Label>
                  <NativeSelect
                    id="catalog-class"
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
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="catalog-category">Categoria</Label>
                  <NativeSelect
                    id="catalog-category"
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
                </div>
                <Button variant="ghost" onClick={() => setFilter({})}>
                  Limpar filtros
                </Button>
              </section>
              <p role="status" className="mt-6 mb-4 text-xs text-muted-foreground">
                {filtered.length} projeto(s) encontrado(s)
              </p>
              {!filtered.length && (
                <Empty
                  title={projects.length ? "Nenhum resultado" : "Nenhum projeto publicado"}
                  text={
                    projects.length
                      ? "Ajuste a busca ou limpe os filtros."
                      : "Novas publicações aparecerão aqui."
                  }
                />
              )}
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map((project) => (
                  <Card
                    render={<article />}
                    className="group p-5 transition-shadow hover:shadow-md/5 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring"
                    key={project.id}
                  >
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <Badge variant="outline" className="truncate">
                        {project.category}
                      </Badge>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {project.academicYear}
                      </span>
                    </div>
                    <h2 className="flex items-start justify-between gap-2 text-base leading-snug font-semibold">
                      {/* O título cobre o cartão: clicar em qualquer ponto abre a publicação. */}
                      <a
                        className="text-foreground no-underline outline-none after:absolute after:inset-0 after:rounded-2xl"
                        href={`${basePath}/${project.id}`}
                        onClick={(event) => {
                          event.preventDefault();
                          navigate(`${basePath}/${project.id}`);
                        }}
                      >
                        {project.title}
                      </a>
                      <ArrowUpRight
                        aria-hidden="true"
                        className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
                      />
                    </h2>
                    <p className="mt-1.5 line-clamp-3 flex-1 text-sm text-muted-foreground">
                      {project.description}
                    </p>
                    <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
                      {project.class.name}
                    </p>
                  </Card>
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
        <Card render={<section aria-labelledby="public-about" />}>
          <CardHeader>
            <CardTitle render={<h2 id="public-about" />} className="text-base">
              Sobre o projeto
            </CardTitle>
          </CardHeader>
          <CardPanel>
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
              {project.description}
            </p>
          </CardPanel>
        </Card>
        <Card render={<section aria-labelledby="public-materials" />}>
          <CardHeader>
            <CardTitle render={<h2 id="public-materials" />} className="text-base">
              Materiais autorizados
            </CardTitle>
          </CardHeader>
          <CardPanel>
          {!project.materials.length && (
            <p className="text-sm text-muted-foreground">
              Nenhum material autorizado para consulta pública.
            </p>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            {project.materials.map((material) => (
              <section
                key={material.versionId}
                className="grid content-start gap-3 rounded-xl border bg-muted/30 p-4"
              >
                <h3 className="flex items-center gap-2 text-sm font-medium">
                  <FileText aria-hidden="true" className="size-4 text-muted-foreground" />
                  {material.title}
                </h3>
                {demo ? (
                  <p className="text-sm text-muted-foreground">
                    Exemplo de {material.kind.toLocaleLowerCase("pt-BR")}{" "}
                    autorizado — sem arquivo nesta demonstração.
                  </p>
                ) : material.kind === "VIDEO" ? (
                  <>
                    {failedVideos.includes(material.versionId) ? (
                      <p role="alert" className="text-sm text-destructive-foreground">
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
          </CardPanel>
        </Card>
      </div>
    </article>
  );
}

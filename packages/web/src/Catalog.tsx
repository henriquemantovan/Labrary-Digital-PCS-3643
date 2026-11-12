import { useEffect, useState } from "react";
import { readClient } from "./readApi";
import type { PublicProject } from "./readApi";
export function Catalog({ path, navigate }: { path: string; navigate: (path: string) => void }) {
  const [filters, setFilters] = useState({ title: "", year: "", className: "", category: "" });
  const [query, setQuery] = useState(filters);
  const [items, setItems] = useState<PublicProject[] | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const detail = /^\/acervo\/([1-9]\d*)$/.exec(path);
  const id = detail ? Number(detail[1]) : null;
  useEffect(() => {
    let active = true;
    setItems(null); setError("");
    const request = id ? readClient.detail(id).then(p => [p]) : readClient.catalog(query);
    void request.then(p => { if (active) setItems(p); }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [id, query, revision]);
  return <main className="catalog">
    <nav aria-label="Acervo"><a href="/login">Espaço acadêmico</a>{id && <button onClick={() => navigate('/acervo')}>Voltar ao acervo</button>}</nav>
    <h1>{id ? "Projeto publicado" : "Acervo público"}</h1>
    {!id && <form className="filter-bar" onSubmit={e => { e.preventDefault(); setQuery({ ...filters }); }}>
      {([['title', 'Buscar por título'], ['year', 'Ano'], ['className', 'Turma'], ['category', 'Categoria']] as const).map(([key, label]) => <label key={key}>{label}<input type={key === 'year' ? 'number' : 'text'} min={key === 'year' ? 1 : undefined} value={filters[key]} onChange={e => setFilters({ ...filters, [key]: e.target.value })} /></label>)}
      <button className="primary">Buscar</button>
    </form>}
    {error ? <><p role="alert">{error}</p><button onClick={() => setRevision(revision + 1)}>Tentar novamente</button></> : !items ? <p role="status">Carregando acervo…</p> : !items.length ? <p>Nenhum projeto publicado encontrado. Ajuste os filtros.</p> : <div className="project-grid">{items.map(p => <article className="project-content" key={p.id}>
      <h2>{id ? p.title : <a href={`/acervo/${p.id}`} onClick={e => { e.preventDefault(); navigate(`/acervo/${p.id}`); }}>{p.title}</a>}</h2>
      <p>{p.description}</p><p>{p.year} · {p.className} · {p.category}</p>
      {id && <section aria-label="Materiais autorizados"><h3>Materiais autorizados</h3>{!p.materials.length && <p>Nenhum material autorizado.</p>}{p.materials.map(m => <div key={m.versionId}><h4>{m.title}</h4>{m.kind === 'VIDEO' ? <video aria-label={m.title} controls preload="metadata" src={m.url} onError={() => setError('Não foi possível reproduzir o vídeo. Atualize o detalhe para verificar a publicação.')} /> : <a href={m.url}>{`Abrir ${m.title}`}</a>}</div>)}</section>}
    </article>)}</div>}
  </main>;
}

import { useEffect, useState } from "react";
import { ApiError } from "./api";
import { readClient } from "./readApi";
import type { ResultView } from "./readApi";
import { panelClass } from "./components/Panel";
export function GroupResult({ projectId, expired }: { projectId: number; expired: () => void }) {
  const [result, setResult] = useState<ResultView | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setResult(null); setError("");
    void readClient.result(projectId).then(r => { if (active) setResult(r); }).catch(e => {
      if (!active) return;
      if (e instanceof ApiError && e.status === 401) expired();
      else setError(e.message);
    });
    return () => { active = false; };
  }, [projectId, expired, revision]);
  return <section className={panelClass} aria-label="Resultado do grupo">
    <h2>Resultado do grupo</h2>
    {error ? <><p role="alert">{error}</p><button onClick={() => setRevision(revision + 1)}>Tentar novamente</button></> : !result ? <p role="status">Carregando resultado…</p> : <>
      {result.round > 0 && <p>Rodada {result.round} · {result.received} de {result.expected} avaliações · {result.pending} pendentes</p>}
      {!result.released ? <p role="status">Resultado bloqueado. Aguardando liberação pelo professor.</p> : <>
        <h3>{result.complete ? "Resultado liberado" : "Resultado parcial"}</h3>
        <p>Nota: {result.grade === null ? "Pendente" : result.grade.toFixed(2)}</p>
        <p>Rubrica: {result.rubricVersionId}</p>
        <ul className="m-0 grid list-none gap-2 p-0 [&_h4]:text-sm [&_h4]:font-medium [&_p]:text-xs [&_p]:text-muted-foreground [&>li]:grid [&>li]:gap-0.5 [&>li]:rounded-lg [&>li]:border [&>li]:p-3">{result.criteria.map((c, i) => <li key={i}><h4>{c.title}</h4><p>Peso: {c.weight}% · Nota: {c.grade === null ? "Pendente" : c.grade.toFixed(2)}</p><p>{c.comment}</p></li>)}</ul>
      </>}
    </>}
  </section>;
}

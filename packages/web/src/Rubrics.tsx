import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api, ApiError } from "./api";
import type { Requirement, RubricCriterion, RubricVersion } from "./assessmentTypes";

const mib = 1024 * 1024;
const kinds = ["VIDEO", "RELATORIO", "MANUAL"] as const;
const labels = { VIDEO: "Vídeo", RELATORIO: "Relatório", MANUAL: "Manual" };
const initialCriteria: RubricCriterion[] = [
  { id: "qualidade", title: "Qualidade do projeto", description: "", weight: 100, minScore: 0, maxScore: 10 },
];
function localDate(iso: string) {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
export function Rubrics({ projectId, canEdit, expired, onConfigurationSaved }: {
  projectId: number;
  canEdit: boolean;
  expired: () => void;
  onConfigurationSaved?: () => Promise<void>;
}) {
  const [versions, setVersions] = useState<RubricVersion[] | null>(null);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editing, setEditing] = useState(false);
  const fail = useCallback((failure: unknown) => {
    if (failure instanceof ApiError && failure.status === 401) expired();
    else setError((failure as Error).message);
  }, [expired]);
  useEffect(() => {
    let active = true;
    setVersions(null);
    void api<RubricVersion[]>(`/projects/${projectId}/configuration/versions`)
      .then((value) => { if (active) setVersions(value); })
      .catch((failure) => { if (active) fail(failure); });
    return () => { active = false; };
  }, [projectId, revision, fail]);
  const current = versions?.at(-1);
  return <section className="create-panel assessment-panel" aria-label="Requisitos e rubrica">
    <h2>Requisitos e rubrica</h2>
    <p className="muted">Cada versão preserva os requisitos e os critérios usados nas entregas anteriores.</p>
    {success && <p role="status">{success}</p>}
    {error && <div role="alert">{error} <button type="button" className="text-button" onClick={() => {
      setError(""); setEditing(false); setRevision((value) => value + 1);
      void onConfigurationSaved?.().catch(fail);
    }}>Recarregar rubricas</button></div>}
    {versions === null ? (!error && <p role="status">Carregando rubricas…</p>) : <>
      {current ? <RubricSummary version={current} /> : <p>Nenhuma rubrica configurada para este projeto.</p>}
      {canEdit && <button type="button" className="secondary" onClick={() => { setEditing(!editing); setSuccess(""); }}>
        {editing ? "Cancelar nova versão" : "Criar nova versão da rubrica"}
      </button>}
      {editing && canEdit && <RubricForm key={current?.id ?? 0} current={current} projectId={projectId} fail={fail} onSaved={(saved) => {
        setVersions([...versions, saved]); setEditing(false); setError("");
        setSuccess(`Versão ${saved.versionNumber} salva. As versões anteriores foram preservadas.`);
        void onConfigurationSaved?.().catch(fail);
      }} />}
      {versions.length > 1 && <details><summary>Versões anteriores ({versions.length - 1})</summary>
        {versions.slice(0, -1).map((version) => <RubricSummary key={version.id} version={version} />)}
      </details>}
    </>}
  </section>;
}
export function RubricSummary({ version }: { version: RubricVersion }) {
  return <div className="planning-block">
    <h3>{version.title} · Versão {version.versionNumber}</h3>
    <p className="muted">Criada em {new Date(version.createdAt).toLocaleString("pt-BR")} · Conta {version.createdBy}</p>
    <ul>{version.requirements.map((rule) => <li key={rule.kind}>
      {rule.label}: obrigatório · {rule.allowedMimeTypes.join(", ")} · até {rule.maxSizeBytes / mib} MiB · prazo {new Date(rule.dueAt).toLocaleString("pt-BR")}
    </li>)}</ul>
    <ul>{version.criteria.map((criterion) => <li key={criterion.id}>
      <strong>{criterion.title}</strong> — {criterion.weight}% · escala de 0 a 10
      {criterion.description && <p>{criterion.description}</p>}
    </li>)}</ul>
  </div>;
}
function RubricForm({ current, projectId, onSaved, fail }: {
  current?: RubricVersion;
  projectId: number;
  onSaved: (version: RubricVersion) => void;
  fail: (failure: unknown) => void;
}) {
  const [criteria, setCriteria] = useState<RubricCriterion[]>(current?.criteria ?? initialCriteria);
  const [busy, setBusy] = useState(false);
  const [validation, setValidation] = useState("");
  const total = criteria.reduce((sum, item) => sum + item.weight, 0);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidation("");
    if (criteria.some((item) => !item.title.trim() || !(item.weight > 0)) || Math.abs(total - 100) > 0.000001) {
      setValidation("Preencha os critérios com pesos positivos cuja soma seja 100%."); return;
    }
    const data = new FormData(event.currentTarget);
    const requirements: Requirement[] = kinds.map((kind) => ({
      kind, label: current?.requirements.find((item) => item.kind === kind)?.label ?? labels[kind], required: true,
      allowedMimeTypes: data.getAll(`${kind}-formats`).map(String),
      maxSizeBytes: Math.round(Number(data.get(`${kind}-size`)) * mib),
      dueAt: new Date(String(data.get(`${kind}-deadline`))).toISOString(),
    }));
    if (requirements.some((item) => !item.allowedMimeTypes.length)) {
      setValidation("Selecione pelo menos um formato para cada material."); return;
    }
    setBusy(true);
    try {
      onSaved(await api<RubricVersion>(`/projects/${projectId}/configuration/versions`, {
        method: "POST", body: JSON.stringify({ baseVersionId: current?.id ?? 0, title: data.get("title"), requirements, criteria }),
      }));
    } catch (failure) { fail(failure); }
    finally { setBusy(false); }
  }
  function update(index: number, change: Partial<RubricCriterion>) {
    setCriteria((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, ...change } : item));
  }
  return <form onSubmit={submit} className="rubric-form" aria-label="Nova versão da rubrica">
    <fieldset disabled={busy}>
      <legend>Nova versão explícita</legend>
      {validation && <p role="alert">{validation}</p>}
      <label>Título da rubrica<input name="title" required maxLength={160} defaultValue={current?.title ?? "Rubrica do projeto"} /></label>
      <div className="assessment-grid">{kinds.map((kind) => {
        const rule = current?.requirements.find((item) => item.kind === kind);
        const formats = kind === "VIDEO" ? ["video/mp4", "video/webm"] : ["application/pdf"];
        return <fieldset key={kind} className="planning-block">
          <legend>{labels[kind]} (obrigatório)</legend>
          <div className="people-options">{formats.map((format) => <label key={format}>
            <input type="checkbox" name={`${kind}-formats`} value={format} defaultChecked={rule ? rule.allowedMimeTypes.includes(format) : true} />
            {format}
          </label>)}</div>
          <label>Tamanho máximo de {labels[kind]} (MiB)<input type="number" name={`${kind}-size`} required min="0.000001" step="any" defaultValue={rule ? rule.maxSizeBytes / mib : kind === "VIDEO" ? 500 : 20} /></label>
          <label>Prazo de {labels[kind]}<input type="datetime-local" name={`${kind}-deadline`} required defaultValue={rule ? localDate(rule.dueAt) : ""} /></label>
        </fieldset>;
      })}</div>
      <h3>Critérios · escala fixa de 0 a 10</h3>
      {criteria.map((criterion, index) => <div key={criterion.id} className="planning-block">
        <div className="form-grid">
          <label>Critério {index + 1}<input required maxLength={160} value={criterion.title} onChange={(event) => update(index, { title: event.target.value })} /></label>
          <label>Peso do critério {index + 1} (%)<input type="number" required min="0.01" max="100" step="0.01" value={criterion.weight} onChange={(event) => update(index, { weight: Number(event.target.value) })} /></label>
          <label>Descrição do critério {index + 1}<textarea maxLength={10000} value={criterion.description} onChange={(event) => update(index, { description: event.target.value })} /></label>
        </div>
        {criteria.length > 1 && <button className="text-button" type="button" onClick={() => setCriteria(criteria.filter((item) => item.id !== criterion.id))}>Remover critério {index + 1}</button>}
      </div>)}
      <p aria-live="polite">Soma dos pesos: {Number(total.toFixed(6))}%</p>
      <div className="button-row">
        <button type="button" className="secondary" onClick={() => setCriteria([...criteria, { id: crypto.randomUUID(), title: "", description: "", weight: 1, minScore: 0, maxScore: 10 }])}>Adicionar critério</button>
        <button className="primary" type="submit">{busy ? "Salvando versão…" : "Salvar nova versão"}</button>
      </div>
    </fieldset>
  </form>;
}

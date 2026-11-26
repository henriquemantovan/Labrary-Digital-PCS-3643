import { useCallback, useEffect, useState } from "react";
import { Success } from "./components/Feedback";
import type { FormEvent } from "react";
import type { CriterionScore, Evaluation } from "../../api/src/models/evaluation";
import { api, ApiError } from "./api";
import type { User } from "./api";
import type { RubricVersion } from "./assessmentTypes";
import type { Submission } from "./submissionTypes";
import { buttonVariants } from "./components/ui/button";
import { blockClass, buttonRow, mutedText, panelClass } from "./components/Panel";

const statuses: Record<Evaluation["status"], string> = {
  PENDENTE: "Pendente",
  RASCUNHO: "Rascunho",
  FINALIZADA: "Finalizada",
  REABERTA: "Reaberta",
};

interface EvaluationRound {
  submission: Submission;
  evaluations: Evaluation[];
  evaluatorNames?: Record<number, string>;
  canEdit: boolean;
  canReopen: boolean;
}

function dateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function Evaluations({ projectId, projectStatus, user, expired }: {
  projectId: number;
  projectStatus?: string;
  user: User;
  expired: () => void;
}) {
  const submissionsPath = `/projects/${projectId}/submissions`;
  const [rounds, setRounds] = useState<Submission[] | null>(null);
  const [selection, setSelection] = useState<number | null>(null);
  const [round, setRound] = useState<EvaluationRound | null>(null);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const evaluationPath = `${submissionsPath}/${selection}/evaluations`;
  const fail = useCallback((failure: unknown) => {
    if (failure instanceof ApiError && failure.status === 401) expired();
    else setError((failure as Error).message);
  }, [expired]);

  useEffect(() => {
    let active = true;
    void api<Submission[]>(submissionsPath).then((submissions) => {
      if (!active) return;
      const newestFirst = [...submissions].sort((first, second) => second.round - first.round);
      setRounds(newestFirst);
      setSelection((previous) => newestFirst.some((item) => item.id === previous)
        ? previous
        : newestFirst[0]?.id ?? null);
    }).catch((failure) => { if (active) fail(failure); });
    return () => { active = false; };
  }, [submissionsPath, projectStatus, reload, fail]);

  useEffect(() => {
    if (selection === null) return;
    let active = true;
    setRound(null);
    void api<EvaluationRound>(evaluationPath)
      .then((value) => { if (active) setRound(value); })
      .catch((failure) => { if (active) fail(failure); });
    return () => { active = false; };
  }, [selection, evaluationPath, projectStatus, reload, fail]);

  async function update(path: string, method: "PUT" | "POST", body: object, message: string) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const saved = await api<Evaluation>(`${evaluationPath}${path}`, { method, body: JSON.stringify(body) });
      setRound((current) => current && {
        ...current,
        evaluations: current.evaluations.map((evaluation) => evaluation.evaluatorId === saved.evaluatorId ? saved : evaluation),
      });
      setSuccess(message);
    } catch (failure) {
      fail(failure);
    } finally {
      setBusy(false);
    }
  }

  const selectedRound = round?.submission.id === selection ? round : null;
  const evaluatorView = user.role === "AVALIADOR";
  return <section className={panelClass} aria-label="Avaliações por rubrica">
    <h2>Avaliações por rubrica</h2>
    {success && <Success>{success}</Success>}
    {error && <p role="alert">{error}</p>}
    <button type="button" className={buttonVariants({ variant: "ghost", size: "sm" })} disabled={busy} onClick={() => {
      setError("");
      setSuccess("");
      setReload((value) => value + 1);
    }}>Recarregar avaliações</button>
    {rounds?.length === 0 && <p>Nenhuma rodada submetida ainda.</p>}
    {!!rounds?.length && <label>Rodada de avaliação
      <select value={selection ?? ""} disabled={busy} onChange={(event) => {
        setError("");
        setSuccess("");
        setSelection(Number(event.target.value));
      }}>
        {rounds.map((item) => <option key={item.id} value={item.id}>Rodada {item.round}</option>)}
      </select>
    </label>}
    {!error && (!rounds || (selection !== null && !selectedRound)) && <p role="status">Carregando avaliações…</p>}
    {selectedRound && <>
      <SubmissionSnapshot submission={selectedRound.submission} />
      {!selectedRound.evaluations.length && <p>Nenhum avaliador registrado nesta rodada.</p>}
      {selectedRound.evaluations.map((evaluation) => {
        const name = evaluatorView ? "Minha avaliação" : selectedRound.evaluatorNames?.[evaluation.evaluatorId] ?? `Avaliador ${evaluation.evaluatorId}`;
        const { rubric } = selectedRound.submission;
        return <article className={blockClass} key={evaluation.evaluatorId}>
          <h3>{name}</h3>
          <p><strong>{statuses[evaluation.status]}</strong>{evaluation.finalizedAt && ` · Finalizada em ${dateTime(evaluation.finalizedAt)}`}</p>
          {evaluatorView && selectedRound.canEdit && evaluation.status !== "FINALIZADA" ? (
            <ScoreForm key={evaluation.revision} evaluation={evaluation} rubric={rubric} busy={busy} onSave={(scores, finalize) => update(
              finalize ? "/me/finalize" : "/me",
              finalize ? "POST" : "PUT",
              { scores, expectedRevision: evaluation.revision },
              finalize ? "Avaliação finalizada." : "Rascunho salvo.",
            )} />
          ) : <ScoreSummary scores={evaluation.scores} rubric={rubric} />}
          {!evaluatorView && selectedRound.canReopen && evaluation.status === "FINALIZADA" && <ReopenForm busy={busy} onReopen={(reason) => update(
            `/${evaluation.evaluatorId}/reopen`, "POST", { reason, expectedRevision: evaluation.revision }, "Avaliação reaberta.",
          )} />}
          <EvaluationHistory evaluation={evaluation} rubric={rubric} />
        </article>;
      })}
    </>}
  </section>;
}

function SubmissionSnapshot({ submission }: { submission: Submission }) {
  const { materials, projectId, rubric } = submission;
  return <div className={blockClass}>
    <h3>{rubric.title} · Versão {rubric.versionNumber}</h3>
    <p className={mutedText}>Rodada {submission.round} · Submetida em {dateTime(submission.submittedAt)}</p>
    <details>
      <summary>Critérios da rubrica</summary>
      <ul>{rubric.criteria.map((criterion) => <li key={criterion.id}>
        <strong>{criterion.title}</strong> · Peso {criterion.weight}% · Escala de {criterion.minScore} a {criterion.maxScore}
        {criterion.description && <p>{criterion.description}</p>}
      </li>)}</ul>
    </details>
    <h4>Materiais submetidos</h4>
    {materials.length ? <ul>{materials.map((material) => <li key={material.materialId}>
      <a href={`/api/projects/${projectId}/materials/${material.materialId}/versions/${material.versionId}/file`}>
        {material.title} — versão {material.versionNumber}
      </a>{" "}<span className={mutedText}>({material.originalFilename})</span>
    </li>)}</ul> : <p>Nenhum material nesta rodada.</p>}
  </div>;
}

function ScoreForm({ evaluation, rubric, busy, onSave }: {
  evaluation: Evaluation;
  rubric: RubricVersion;
  busy: boolean;
  onSave: (scores: CriterionScore[], finalize: boolean) => Promise<void>;
}) {
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const finalize = submitter instanceof HTMLButtonElement && submitter.value === "finalize";
    const form = new FormData(event.currentTarget);
    const scores: CriterionScore[] = [];
    for (const criterion of rubric.criteria) {
      const value = String(form.get(`score-${criterion.id}`) ?? "");
      const comment = String(form.get(`comment-${criterion.id}`) ?? "").trim();
      if (value === "") {
        if (comment || finalize) {
          setError(`Preencha a nota de ${criterion.title}.`);
          return;
        }
      } else {
        scores.push({ criterionId: criterion.id, score: Number(value), comment });
      }
    }
    void onSave(scores, finalize);
  }

  return <form onSubmit={submit}>
    <div className="grid gap-3">
      {rubric.criteria.map((criterion) => {
        const saved = evaluation.scores.find((item) => item.criterionId === criterion.id);
        return <fieldset key={criterion.id} disabled={busy}>
          <legend>{criterion.title}</legend>
          <p className={mutedText}>Peso {criterion.weight}% · Escala de {criterion.minScore} a {criterion.maxScore}</p>
          {criterion.description && <p>{criterion.description}</p>}
          <label>Nota — {criterion.title}
            <input type="number" min={criterion.minScore} max={criterion.maxScore} step="any" inputMode="decimal" name={`score-${criterion.id}`} defaultValue={saved?.score} />
          </label>
          <label>Comentário — {criterion.title}
            <textarea rows={2} maxLength={4000} name={`comment-${criterion.id}`} defaultValue={saved?.comment} />
          </label>
        </fieldset>;
      })}
    </div>
    {error && <p role="alert">{error}</p>}
    <div className={buttonRow}>
      <button type="submit" className={buttonVariants({ variant: "outline", size: "sm" })} disabled={busy}>Salvar rascunho</button>
      <button type="submit" className={buttonVariants({ size: "sm" })} value="finalize" disabled={busy}>Finalizar avaliação</button>
    </div>
  </form>;
}

function ScoreSummary({ scores, rubric }: { scores: CriterionScore[]; rubric: RubricVersion }) {
  if (!scores.length) return null;
  return <ul>{scores.map(({ criterionId, score, comment }) => <li key={criterionId}>
    <strong>{rubric.criteria.find((criterion) => criterion.id === criterionId)?.title ?? criterionId}</strong> · {score.toLocaleString("pt-BR", { maximumSignificantDigits: 21 })} / 10
    {comment && <p>{comment}</p>}
  </li>)}</ul>;
}

function EvaluationHistory({ evaluation, rubric }: { evaluation: Evaluation; rubric: RubricVersion }) {
  if (!evaluation.history.length) return null;
  return <details>
    <summary>Histórico da avaliação ({evaluation.history.length})</summary>
    <ol reversed>
      {[...evaluation.history].reverse().map((event) => <li key={event.revision}>
        <strong>{statuses[event.action]}</strong> · Revisão {event.revision} · {dateTime(event.at)} · Conta {event.actorId}
        {event.reason && <p>Justificativa: {event.reason}</p>}
        <ScoreSummary scores={event.scores} rubric={rubric} />
      </li>)}
    </ol>
  </details>;
}

function ReopenForm({ busy, onReopen }: { busy: boolean; onReopen: (reason: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reason = String(new FormData(event.currentTarget).get("reason") ?? "").trim();
    if (!reason) {
      setError("Informe a justificativa da reabertura.");
      return;
    }
    setError("");
    void onReopen(reason);
  }

  return open ? <form onSubmit={submit}>
    <label>Justificativa da reabertura
      <textarea name="reason" rows={2} required maxLength={2000} disabled={busy} />
    </label>
    {error && <p role="alert">{error}</p>}
    <div className={buttonRow}>
      <button type="submit" className={buttonVariants({ size: "sm" })} disabled={busy}>Confirmar reabertura</button>
      <button type="button" className={buttonVariants({ variant: "outline", size: "sm" })} disabled={busy} onClick={() => { setOpen(false); setError(""); }}>Cancelar</button>
    </div>
  </form> : <button type="button" className={buttonVariants({ variant: "outline", size: "sm" })} disabled={busy} onClick={() => setOpen(true)}>Reabrir avaliação</button>;
}

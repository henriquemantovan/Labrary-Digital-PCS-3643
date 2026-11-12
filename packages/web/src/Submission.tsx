import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "./api";
import type { Material, Project, User } from "./api";
import { Icon } from "./Icons";
import type { Submission, SubmissionBlock, SubmissionChecklist } from "./submissionTypes";

const formatDate = (value: string) =>
  new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

const blockMessages: Record<SubmissionBlock, string> = {
  RUBRIC_NOT_CONFIGURED: "O professor ainda não configurou os requisitos da entrega.",
  INCOMPLETE_SUBMISSION: "Envie todos os materiais obrigatórios no formato e tamanho exigidos para submeter.",
  DEADLINE_PASSED: "O prazo de entrega terminou. Só o professor pode reabrir a entrega para ajustes.",
  SUBMISSION_LOCKED: "O projeto não está aberto para submissão.",
};
function blockMessage(checklist: SubmissionChecklist) {
  if (!checklist.blockedBy) return null;
  if (checklist.blockedBy === "SUBMISSION_LOCKED" && checklist.projectStatus === "EM_AVALIACAO")
    return "Projeto submetido e em avaliação. Os materiais ficam bloqueados até uma devolução para ajustes.";
  return blockMessages[checklist.blockedBy];
}

/**
 * HU05: checklist da entrega, submissão pelo aluno, histórico de rodadas e
 * devolução para ajustes pelo professor. As regras ficam na API; aqui só se
 * mostra o que ela decide.
 */
export function SubmissionPanel({ project, user, materials, refreshKey, expired, onStatusChanged }: {
  project: Pick<Project, "id" | "status">;
  user: User;
  materials: Material[];
  /** Qualquer mudança (novo material, nova rubrica) recarrega o checklist. */
  refreshKey?: unknown;
  expired: () => void;
  onStatusChanged: (status: string) => void;
}) {
  const [checklist, setChecklist] = useState<SubmissionChecklist | null>(null);
  const [rounds, setRounds] = useState<Submission[] | null>(null);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirming, setConfirming] = useState<"submit" | "return" | null>(null);
  const [busy, setBusy] = useState(false);
  // Mesmo identificador enquanto o resultado da tentativa for desconhecido (falha de rede).
  const attempt = useRef<string | null>(null);

  const fail = useCallback((failure: unknown) => {
    if (failure instanceof ApiError && failure.status === 401) expired();
    else setError((failure as Error).message);
  }, [expired]);

  useEffect(() => {
    setChecklist(null);
    setRounds(null);
  }, [project.id]);
  useEffect(() => {
    let active = true;
    Promise.all([
      api<SubmissionChecklist>(`/projects/${project.id}/submission-checklist`),
      api<Submission[]>(`/projects/${project.id}/submissions`),
    ])
      .then(([items, history]) => {
        if (!active) return;
        setChecklist(items);
        setRounds(history);
      })
      .catch((failure) => { if (active) fail(failure); });
    return () => { active = false; };
  }, [project.id, project.status, materials, refreshKey, revision, fail]);

  const latest = rounds?.at(-1);
  const canReturn = ["PROFESSOR", "ADMIN"].includes(user.role) &&
    project.status === "EM_AVALIACAO" && latest?.status === "SUBMETIDA";

  async function submit() {
    attempt.current ??= crypto.randomUUID();
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const created = await api<Submission>(`/projects/${project.id}/submissions`, {
        method: "POST",
        body: JSON.stringify({ clientSubmissionId: attempt.current }),
      });
      attempt.current = null;
      setConfirming(null);
      setSuccess(`Projeto submetido. A rodada ${created.round} está em avaliação.`);
      onStatusChanged("EM_AVALIACAO");
    } catch (failure) {
      if (!(failure instanceof ApiError && failure.status === 0)) attempt.current = null;
      fail(failure);
      setRevision((value) => value + 1);
    } finally {
      setBusy(false);
    }
  }

  async function giveBack(submission: Submission) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const returned = await api<Submission>(
        `/projects/${project.id}/submissions/${submission.id}/return`,
        { method: "POST" },
      );
      setConfirming(null);
      setSuccess(`Rodada ${returned.round} devolvida para ajustes. O grupo pode enviar novas versões e submeter outra rodada.`);
      onStatusChanged("AJUSTES");
    } catch (failure) {
      fail(failure);
      setRevision((value) => value + 1);
    } finally {
      setBusy(false);
    }
  }

  const versionNumber = (materialId: number | null, versionId: number | null) =>
    materials.find((item) => item.id === materialId)?.versions.find((item) => item.id === versionId)?.versionNumber;
  const ready = checklist?.items.filter((item) => item.ok).length ?? 0;
  const block = checklist && blockMessage(checklist);

  return (
    <section className="detail-section submission-panel" aria-labelledby="submission-title">
      <div className="section-heading">
        <h2 id="submission-title">Entrega para avaliação</h2>
        {checklist && checklist.items.length > 0 && (
          <span>{ready} de {checklist.items.length} obrigatórios prontos</span>
        )}
      </div>
      {success && <p role="status" className="submission-success">{success}</p>}
      {error && (
        <div role="alert" className="notice">
          {error}{" "}
          <button type="button" className="text-button" onClick={() => { setError(""); setRevision((value) => value + 1); }}>
            Atualizar entrega
          </button>
        </div>
      )}
      {!checklist || !rounds ? (
        !error && <p role="status">Carregando entrega…</p>
      ) : (
        <>
          {block && (
            <p className="material-lock">
              <Icon name="lock" size={16} />
              {block}
            </p>
          )}
          {checklist.items.length > 0 && (
            <ul className="submission-checklist" aria-label="Checklist da entrega">
              {checklist.items.map((item) => {
                const version = versionNumber(item.materialId, item.versionId);
                const state = item.ok
                  ? `Presente${version ? ` (versão ${version})` : ""}`
                  : item.materialId
                    ? "Formato ou tamanho fora do exigido"
                    : "Ausente";
                return (
                  <li key={item.kind} className={item.ok ? "ok" : "missing"}>
                    <span>{item.label}</span>
                    <strong>{state}</strong>
                  </li>
                );
              })}
            </ul>
          )}
          {checklist.canSubmit && confirming !== "submit" && (
            <button type="button" onClick={() => { setConfirming("submit"); setSuccess(""); }}>
              Submeter para avaliação
            </button>
          )}
          {checklist.canSubmit && confirming === "submit" && (
            <div className="submission-confirm" role="group" aria-label="Confirmar submissão">
              <p>
                Depois de submeter, os materiais ficam bloqueados até o professor devolver o projeto
                para ajustes. A versão atual de cada material será registrada nesta rodada.
              </p>
              <div className="button-row">
                <button type="button" disabled={busy} onClick={() => void submit()}>
                  {busy ? "Submetendo…" : "Confirmar submissão"}
                </button>
                <button type="button" className="secondary" disabled={busy} onClick={() => setConfirming(null)}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
          {canReturn && latest && confirming !== "return" && (
            <button type="button" className="secondary" onClick={() => { setConfirming("return"); setSuccess(""); }}>
              Devolver para ajustes
            </button>
          )}
          {canReturn && latest && confirming === "return" && (
            <div className="submission-confirm" role="group" aria-label="Confirmar devolução">
              <p>
                A rodada {latest.round} será marcada como devolvida e o grupo poderá enviar novas
                versões e submeter uma nova rodada. A rodada atual continua no histórico.
              </p>
              <div className="button-row">
                <button type="button" disabled={busy} onClick={() => void giveBack(latest)}>
                  {busy ? "Devolvendo…" : "Confirmar devolução"}
                </button>
                <button type="button" className="secondary" disabled={busy} onClick={() => setConfirming(null)}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
          <h3>Rodadas</h3>
          {rounds.length === 0 ? (
            <p className="muted">Nenhuma rodada submetida ainda.</p>
          ) : (
            <ol className="submission-rounds" reversed>
              {[...rounds].reverse().map((round) => (
                <li key={round.id}>
                  <p>
                    <strong>Rodada {round.round}</strong> ·{" "}
                    {round.status === "SUBMETIDA" ? "Em avaliação" : "Devolvida para ajustes"}
                  </p>
                  <p className="muted">
                    Submetida em {formatDate(round.submittedAt)}
                    {round.submittedBy === user.id ? " por você" : ` pela conta ${round.submittedBy}`}
                    {round.returnedAt && ` · devolvida em ${formatDate(round.returnedAt)}`}
                    {` · rubrica versão ${round.rubric.versionNumber}`}
                  </p>
                  <ul>
                    {round.materials.map((item) => (
                      <li key={item.materialId}>
                        <a href={`/api/projects/${project.id}/materials/${item.materialId}/versions/${item.versionId}/file`}>
                          {item.title} — versão {item.versionNumber}
                        </a>{" "}
                        <span className="muted">({item.originalFilename})</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </section>
  );
}

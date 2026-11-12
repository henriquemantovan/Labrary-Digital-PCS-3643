import { useEffect, useState } from "react";
import { api, ApiError } from "./api";
import type { Scope } from "./api";
import { downloadGrades } from "./gradeClient";
import type { ConsolidatedResult, GradeRow } from "./gradeClient";

const labels = { NO_SUBMISSION: "Sem submissão", PENDING: "Pendente", PARTIAL: "Parcial", FINAL: "Final" };
type Confirmation = { result: ConsolidatedResult; fingerprint: string | null };

export function Gradebook({ expired }: { expired: () => void }) {
  const [classes, setClasses] = useState<Scope["classes"] | null>(null);
  const [classId, setClassId] = useState("");
  const [rows, setRows] = useState<GradeRow[] | null>(null);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [success, setSuccess] = useState("");
  function fail(failure: unknown) {
    if (failure instanceof ApiError && failure.status === 401) expired();
    else setError((failure as Error).message);
  }
  useEffect(() => {
    let active = true;
    if (classes !== null) return;
    void api<Scope>("/scope").then(scope => {
      if (active) {
        setClasses(scope.classes);
        setClassId(scope.classes[0] ? String(scope.classes[0].id) : "");
      }
    }).catch(failure => { if (active) fail(failure); });
    return () => { active = false; };
  }, [classes, revision, expired]);
  useEffect(() => {
    let active = true;
    setRows(null); setError(""); setConfirmation(null); setSuccess("");
    if (classId) void api<GradeRow[]>(`/classes/${classId}/grades`)
      .then(value => { if (active) setRows(value); })
      .catch(failure => { if (active) fail(failure); });
    return () => { active = false; };
  }, [classId, revision, expired]);
  async function exportCsv() {
    setBusy(true); setError("");
    try {
      const blob = await downloadGrades(Number(classId));
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = `notas-turma-${classId}.csv`;
      document.body.append(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
    } catch (failure) { fail(failure); }
    finally { setBusy(false); }
  }
  async function preview(projectId: number) {
    setBusy(true); setError(""); setSuccess("");
    try { setConfirmation(await api<Confirmation>(`/projects/${projectId}/results/consolidation`)); }
    catch (failure) { fail(failure); }
    finally { setBusy(false); }
  }
  async function release() {
    setBusy(true); setError("");
    try {
      const { result, fingerprint } = confirmation!;
      const updated = await api<ConsolidatedResult>(`/projects/${result.projectId}/results/release`, {
        method: "POST", body: JSON.stringify({ submissionId: result.submissionId, fingerprint }),
      });
      setRows(current => current!.map(row => row.projectId === updated.projectId ? { ...row, ...updated } : row));
      setConfirmation(null); setSuccess("Resultado liberado para o grupo.");
    } catch (failure) { setConfirmation(null); fail(failure); }
    finally { setBusy(false); }
  }
  return <section aria-labelledby="grades-title">
    <h1 id="grades-title">Consolidação de notas</h1>
    <p className="muted">A nota parcial considera somente avaliações finalizadas. A liberação ao grupo exige todas as avaliações previstas.</p>
    {error && <div role="alert" className="notice">{error}</div>}
    {success && <p role="status">{success}</p>}
    {classes === null && !error && <p role="status">Carregando turmas…</p>}
    {classes?.length === 0 && <p>Nenhuma turma disponível.</p>}
    {!!classes?.length && <>
      <label htmlFor="grades-class">Turma da consolidação</label>
      <select id="grades-class" value={classId} disabled={busy} onChange={event => setClassId(event.target.value)}>
        {classes.map(item => <option key={item.id} value={item.id}>{item.name} ({item.academicYear})</option>)}
      </select>
    </>}
    <div className="grade-actions">
      <button disabled={busy} onClick={() => setRevision(value => value + 1)}>Atualizar consolidação</button>
      <button disabled={busy || rows === null || !classId} onClick={() => void exportCsv()}>Exportar CSV</button>
    </div>
    {classId && rows === null && !error && <p role="status">Carregando notas…</p>}
    {rows?.length === 0 && <p>Nenhum projeto nesta turma.</p>}
    {!!rows?.length && <div className="grades-scroll" role="region" aria-label="Notas dos grupos" tabIndex={0}>
      <table className="grades-table">
        <caption>Notas e pendências por grupo</caption>
        <thead><tr>{["Grupo", "Projeto", "Rodada", "Previstos", "Recebidos", "Pendentes", "Nota", "Situação", "Liberação"].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody>{rows.map(row => <tr key={row.projectId}>
          <th scope="row">{row.groupName}</th><td>{row.title}</td><td>{row.round ?? "—"}</td>
          <td>{row.expectedEvaluatorIds.length}</td><td>{row.receivedEvaluatorIds.length}</td><td>{row.pendingEvaluatorIds.length}</td>
          <td>{row.grade === null ? "—" : row.grade.toFixed(2)}</td><td>{labels[row.status]}</td>
          <td>{row.resultReleased ? "Liberado" : <button disabled={busy || !row.allEvaluationsCompleted} onClick={() => void preview(row.projectId)} aria-label={`Liberar resultado de ${row.groupName}`}>Liberar resultado</button>}</td>
        </tr>)}</tbody>
      </table>
    </div>}
    {confirmation && <section className="panel" aria-label="Confirmar liberação">
      <h2>Liberar resultado ao grupo?</h2>
      <p>Rodada {confirmation.result.round} · Nota {confirmation.result.grade?.toFixed(2) ?? "—"}. A liberação permite que os integrantes consultem as notas e os comentários desta rodada.</p>
      <button disabled={busy || !confirmation.result.allEvaluationsCompleted} onClick={() => void release()}>Confirmar liberação</button>
      <button disabled={busy} onClick={() => setConfirmation(null)}>Cancelar</button>
    </section>}
  </section>;
}

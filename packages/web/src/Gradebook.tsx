import { useEffect, useState } from "react";
import { api, ApiError } from "./api";
import type { Scope } from "./api";
import { downloadGrades } from "./gradeClient";
import type { ConsolidatedResult, GradeRow } from "./gradeClient";
import { CircleCheck, Download, RefreshCw } from "lucide-react";
import { Loading, Notice, Success } from "./components/Feedback";
import { Badge, type BadgeProps } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "./components/ui/card";
import { Label } from "./components/ui/label";
import { NativeSelect } from "./components/ui/native-select";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./components/ui/table";

const labels = { NO_SUBMISSION: "Sem submissão", PENDING: "Pendente", PARTIAL: "Parcial", FINAL: "Final" };
const statusVariants: Record<keyof typeof labels, BadgeProps["variant"]> = {
  NO_SUBMISSION: "secondary",
  PENDING: "warning",
  PARTIAL: "info",
  FINAL: "success",
};
const columns = ["Grupo", "Projeto", "Rodada", "Previstos", "Recebidos", "Pendentes", "Nota", "Situação", "Liberação"];
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
  return <section aria-labelledby="grades-title" className="grid gap-5">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">Gestão acadêmica</p>
        <h1 id="grades-title" className="font-heading text-2xl font-semibold tracking-tight md:text-[28px]">Consolidação de notas</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">A nota parcial considera somente avaliações finalizadas. A liberação ao grupo exige todas as avaliações previstas.</p>
      </div>
    </header>
    {error && <Notice>{error}</Notice>}
    {success && <Success>{success}</Success>}
    {classes === null && !error && <Loading label="Carregando turmas…" />}
    {classes?.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma turma disponível.</p>}
    <div className="flex flex-wrap items-end gap-2">
      {!!classes?.length && <div className="flex min-w-64 flex-col gap-2">
        <Label htmlFor="grades-class">Turma da consolidação</Label>
        <NativeSelect id="grades-class" value={classId} disabled={busy} onChange={event => setClassId(event.target.value)}>
          {classes.map(item => <option key={item.id} value={item.id}>{item.name} ({item.academicYear})</option>)}
        </NativeSelect>
      </div>}
      <Button variant="outline" disabled={busy} onClick={() => setRevision(value => value + 1)}><RefreshCw />Atualizar consolidação</Button>
      <Button variant="outline" disabled={busy || rows === null || !classId} onClick={() => void exportCsv()}><Download />Exportar CSV</Button>
    </div>
    {classId && rows === null && !error && <Loading label="Carregando notas…" />}
    {rows?.length === 0 && <p className="text-sm text-muted-foreground">Nenhum projeto nesta turma.</p>}
    {!!rows?.length && <Card className="overflow-hidden">
      <div role="region" aria-label="Notas dos grupos" tabIndex={0} className="outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Table>
          <TableCaption className="mt-0 caption-top border-b px-4 py-3 text-left text-xs font-medium">Notas e pendências por grupo</TableCaption>
          <TableHeader className="bg-muted/50">
            <TableRow className="hover:bg-transparent">{columns.map(label => <TableHead key={label} scope="col" className="first:ps-4 last:pe-4">{label}</TableHead>)}</TableRow>
          </TableHeader>
          <TableBody>{rows.map(row => <TableRow key={row.projectId}>
            <TableHead scope="row" className="ps-4 text-foreground">{row.groupName}</TableHead>
            <TableCell className="max-w-72 truncate">{row.title}</TableCell>
            <TableCell className="tabular-nums">{row.round ?? "—"}</TableCell>
            <TableCell className="tabular-nums">{row.expectedEvaluatorIds.length}</TableCell>
            <TableCell className="tabular-nums">{row.receivedEvaluatorIds.length}</TableCell>
            <TableCell className="tabular-nums">{row.pendingEvaluatorIds.length}</TableCell>
            <TableCell className="font-medium tabular-nums">{row.grade === null ? "—" : row.grade.toFixed(2)}</TableCell>
            <TableCell><Badge variant={statusVariants[row.status]}>{labels[row.status]}</Badge></TableCell>
            <TableCell className="pe-4">{row.resultReleased
              ? <Badge variant="success"><CircleCheck />Liberado</Badge>
              : <Button size="xs" variant="outline" disabled={busy || !row.allEvaluationsCompleted} onClick={() => void preview(row.projectId)} aria-label={`Liberar resultado de ${row.groupName}`}>Liberar resultado</Button>}
            </TableCell>
          </TableRow>)}</TableBody>
        </Table>
      </div>
    </Card>}
    {confirmation && <Card render={<section aria-label="Confirmar liberação" />}>
      <CardHeader>
        <CardTitle render={<h2 />} className="text-base">Liberar resultado ao grupo?</CardTitle>
        <CardDescription>Rodada {confirmation.result.round} · Nota {confirmation.result.grade?.toFixed(2) ?? "—"}. A liberação permite que os integrantes consultem as notas e os comentários desta rodada.</CardDescription>
      </CardHeader>
      <CardFooter className="gap-2">
        <Button disabled={busy || !confirmation.result.allEvaluationsCompleted} onClick={() => void release()}>Confirmar liberação</Button>
        <Button variant="outline" disabled={busy} onClick={() => setConfirmation(null)}>Cancelar</Button>
      </CardFooter>
    </Card>}
  </section>;
}

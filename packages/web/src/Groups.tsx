import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api, ApiError } from "./api";
import type { Administration, LinkChange, Person, Evaluators, Project } from "./api";
import { buttonVariants } from "./components/ui/button";
import { Notice, noticeClass, Success } from "./components/Feedback";
import { mutedText, panelClass, panelTitle } from "./components/Panel";
import { StatusBadge } from "./components/StatusBadge";
import type { LucideIcon } from "lucide-react";
import { FolderKanban, Pencil, Plus, UserPlus, Users, UserX, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "./components/ui/alert";
import { Avatar, AvatarFallback } from "./components/ui/avatar";
import { Button } from "./components/ui/button";
import { Card } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { cn } from "./lib/utils";

type Expiry = { expired: () => void };
function usePlanningError(expired: () => void) {
  const [error, setError] = useState("");
  const fail = useCallback(
    (failure: unknown) => {
      if (failure instanceof ApiError && failure.status === 401) expired();
      else setError((failure as Error).message);
    },
    [expired],
  );
  return { error, setError, fail };
}
function personName(people: Person[], id: number) {
  return people.find((person) => person.id === id)?.fullName ?? `Conta ${id}`;
}
const initials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");
/** Descreve uma alteração de vínculos com nomes, em vez de listas de identificadores. */
export function describeChange(item: LinkChange, people: Person[]) {
  const names = (ids: number[]) => ids.map((id) => personName(people, id)).join(", ");
  const added = item.after.filter((id) => !item.before.includes(id));
  const removed = item.before.filter((id) => !item.after.includes(id));
  const parts = [
    added.length && `adicionou ${names(added)}`,
    removed.length && `removeu ${names(removed)}`,
  ].filter(Boolean);
  return `${personName(people, item.changedBy)}: ${parts.length ? parts.join("; ") : "sem alterações"}`;
}
function History({ items, people }: { items: LinkChange[]; people: Person[] }) {
  return (
    <details>
      <summary>Histórico de vínculos ({items.length})</summary>
      {!items.length && <p className={mutedText}>Nenhuma alteração registrada.</p>}
      <ol className="m-0 grid list-none gap-1.5 p-0 text-xs text-muted-foreground empty:hidden">
        {items.map((item, index) => (
          <li key={index}>
            {new Date(item.changedAt).toLocaleString("pt-BR")} ·{" "}
            {describeChange(item, people)}
          </li>
        ))}
      </ol>
    </details>
  );
}
function People({
  people,
  selected,
  name,
}: {
  people: Person[];
  selected: number[];
  name: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {!people.length && <p className={mutedText}>Nenhuma conta ativa disponível.</p>}
      {people.map((person) => (
        <label
          key={person.id}
          className="flex cursor-pointer items-center gap-2 rounded-lg border bg-background px-2.5 py-1.5 text-sm shadow-xs/5 transition-colors hover:bg-accent/50 has-checked:border-primary/40 has-checked:bg-accent"
        >
          <input
            type="checkbox"
            name={name}
            value={person.id}
            defaultChecked={selected.includes(person.id)}
          />
          {person.fullName}
        </label>
      ))}
    </div>
  );
}
function Stat({
  icon: Icon,
  label,
  value,
  warn,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm shadow-xs/5",
        warn ? "border-warning/32 bg-warning/4 text-warning-foreground" : "bg-background",
      )}
    >
      <Icon aria-hidden="true" className={cn("size-4", !warn && "text-muted-foreground")} />
      <dt className={warn ? undefined : "text-muted-foreground"}>{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
export function GroupManager({
  classId,
  onChanged,
  expired,
  projects,
  navigate,
}: {
  classId: number;
  onChanged: () => void;
  /** Projetos da turma, para mostrar o projeto de cada grupo na mesma linha. */
  projects?: Project[];
  navigate?: (path: string) => void;
} & Expiry) {
  const [data, setData] = useState<Administration | null>(null);
  const [revision, setRevision] = useState(0);
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  // Grupo sem integrantes abre a edição por padrão; o clique do professor prevalece.
  const [toggled, setToggled] = useState<Record<number, boolean>>({});
  const { error, setError, fail } = usePlanningError(expired);
  useEffect(() => {
    let active = true;
    setData(null);
    void api<Administration>(`/classes/${classId}/administration`)
      .then((value) => {
        if (active) setData(value);
      })
      .catch((failure) => {
        if (active) fail(failure);
      });
    return () => {
      active = false;
    };
  }, [classId, revision, fail]);
  const isEditing = (group: Administration["groups"][number]) =>
    toggled[group.id] ?? group.memberIds.length === 0;
  async function submit(event: FormEvent<HTMLFormElement>, groupId?: number) {
    event.preventDefault();
    const form = event.currentTarget;
    const input = new FormData(form);
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      if (groupId) {
        const saved = await api<Administration["groups"][number]>(
          `/classes/${classId}/groups/${groupId}/members`,
          {
            method: "PUT",
            body: JSON.stringify({
              memberIds: input.getAll("memberIds").map(Number),
            }),
          },
        );
        setSuccess("Integrantes atualizados.");
        setToggled((current) => ({ ...current, [groupId]: true }));
        setData((current) => ({
          ...current!,
          groups: current!.groups.map((group) =>
            group.id === groupId ? saved : group,
          ),
        }));
      } else {
        await api(`/classes/${classId}/groups`, {
          method: "POST",
          body: JSON.stringify({ name: input.get("name") }),
        });
        form.reset();
        setRevision((value) => value + 1);
        setSuccess("Grupo cadastrado.");
        onChanged();
      }
    } catch (failure) {
      fail(failure);
    } finally {
      setBusy(false);
    }
  }
  const students = data?.people.filter((person) =>
    ["ALUNO", "ADMIN"].includes(person.role),
  ) ?? [];
  const unassigned =
    data?.people.filter(
      (person) =>
        person.role === "ALUNO" &&
        !data.groups.some((group) => group.memberIds.includes(person.id)),
    ) ?? [];
  const projectOf = (groupId: number) =>
    projects?.find((project) => project.groupId === groupId);
  return (
    <section className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4" aria-label="Gestão de grupos">
      <h3 className="sr-only">Grupos e integrantes</h3>
      {success && (
        <Success>{success}</Success>
      )}
      {error && (
        <div className={noticeClass}>
          <p role="alert">{error}</p>
          <Button
            variant="outline"
            size="xs"
            onClick={() => {
              setError("");
              setRevision((value) => value + 1);
            }}
          >
            Recarregar grupos
          </Button>
        </div>
      )}
      {!data ? (
        <p role="status" className={mutedText}>Carregando grupos…</p>
      ) : (
        <>
          <dl className="m-0 flex flex-wrap gap-2">
            <Stat icon={Users} label="Grupos" value={String(data.groups.length)} />
            {projects && (
              <Stat
                icon={FolderKanban}
                label="Com projeto"
                value={`${data.groups.filter((group) => projectOf(group.id)).length} / ${data.groups.length}`}
              />
            )}
            <Stat
              icon={UserX}
              label="Alunos sem grupo"
              value={String(unassigned.length)}
              warn={unassigned.length > 0}
            />
          </dl>
          {unassigned.length > 0 && (
            // Informação fixa da turma, não um aviso de erro: sem role="alert".
            <Alert role={undefined} variant="warning">
              <UserX />
              <AlertTitle>Alunos ainda sem grupo</AlertTitle>
              <AlertDescription>
                Sem grupo: {unassigned.map((person) => person.fullName).join(", ")}
              </AlertDescription>
            </Alert>
          )}
          {!data.groups.length && <p className={mutedText}>Nenhum grupo cadastrado.</p>}
          <ul className="m-0 grid list-none items-start gap-3 p-0 md:grid-cols-2 2xl:grid-cols-3">
            {data.groups.map((group) => {
              const project = projectOf(group.id);
              const editing = isEditing(group);
              const members = group.memberIds.length;
              return (
                <li key={group.id} className="min-w-0">
                  <Card
                    render={<section aria-labelledby={`group-${group.id}`} />}
                    className={cn("min-w-0", editing && "ring-2 ring-ring/24")}
                  >
                    <div className="flex items-start justify-between gap-3 px-4 pt-4">
                      <div className="grid min-w-0 gap-0.5">
                        <h4 id={`group-${group.id}`} className="truncate font-heading text-sm font-semibold">
                          {group.name}
                        </h4>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {members} {members === 1 ? "integrante" : "integrantes"}
                        </span>
                      </div>
                      <Button
                        variant={editing ? "secondary" : "outline"}
                        size="sm"
                        aria-expanded={editing}
                        aria-label={`Editar integrantes de ${group.name}`}
                        onClick={() =>
                          setToggled((current) => ({ ...current, [group.id]: !editing }))
                        }
                      >
                        {editing ? <X /> : <Pencil />}
                        {editing ? "Fechar" : "Editar"}
                      </Button>
                    </div>
                    <div className="px-4 pt-3 pb-4">
                      {members ? (
                        <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
                          {group.memberIds.map((id) => (
                            <li
                              key={id}
                              className="inline-flex max-w-full items-center gap-1.5 rounded-full border bg-background py-0.5 ps-0.5 pe-2.5 text-xs"
                            >
                              <Avatar className="size-5 bg-muted">
                                <AvatarFallback className="bg-muted text-[9px] font-semibold">
                                  {initials(personName(data.people, id))}
                                </AvatarFallback>
                              </Avatar>
                              <span className="truncate">{personName(data.people, id)}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="flex items-center gap-1.5 text-xs text-warning-foreground">
                          <UserPlus aria-hidden="true" className="size-3.5" />
                          Sem integrantes
                        </p>
                      )}
                    </div>
                    {editing && (
                      <div className="mx-4 mb-4 grid gap-3 rounded-xl border bg-muted/40 p-3">
                        <form onSubmit={(event) => void submit(event, group.id)}>
                          <fieldset disabled={busy}>
                            <legend>Integrantes de {group.name}</legend>
                            <People
                              key={JSON.stringify(group.memberIds)}
                              people={students}
                              selected={group.memberIds}
                              name="memberIds"
                            />
                            <Button type="submit" size="sm">
                              Salvar integrantes de {group.name}
                            </Button>
                          </fieldset>
                        </form>
                        <History items={group.history} people={data.people} />
                      </div>
                    )}
                    {projects && (
                      <div className="flex min-h-11 items-center gap-2 border-t px-4 py-2.5 text-xs text-muted-foreground">
                        <FolderKanban aria-hidden="true" className="size-3.5 shrink-0" />
                        {project ? (
                          <>
                            <a
                              className="min-w-0 flex-1 truncate font-medium text-foreground no-underline hover:underline"
                              href={`/projetos/${project.id}`}
                              title={project.title}
                              onClick={(event) => {
                                if (!navigate) return;
                                event.preventDefault();
                                navigate(`/projetos/${project.id}`);
                              }}
                            >
                              {project.title}
                            </a>
                            <StatusBadge status={project.status} />
                          </>
                        ) : (
                          <span>Sem projeto</span>
                        )}
                      </div>
                    )}
                  </Card>
                </li>
              );
            })}
            <li className="min-w-0">
              <form
                onSubmit={(event) => void submit(event)}
                className="grid gap-3 rounded-2xl border border-dashed border-input bg-muted/30 p-4"
              >
                <label
                  htmlFor={`new-group-${classId}`}
                  className="flex items-center gap-2 text-sm font-medium"
                >
                  <Plus aria-hidden="true" className="size-4 text-muted-foreground" />
                  Nome do novo grupo
                </label>
                <div className="flex flex-wrap gap-2">
                  <Input
                    id={`new-group-${classId}`}
                    name="name"
                    required
                    maxLength={120}
                    disabled={busy}
                    placeholder="Ex.: Grupo 04"
                    className="min-w-40 flex-1"
                  />
                  <Button type="submit" variant="outline" disabled={busy}>
                    Cadastrar grupo
                  </Button>
                </div>
              </form>
            </li>
          </ul>
        </>
      )}
    </section>
  );
}

export function EvaluatorManager({
  projectId,
  classId,
  expired,
}: { projectId: number; classId: number } & Expiry) {
  const [data, setData] = useState<{
    people: Person[];
    links: Evaluators;
  } | null>(null);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState("");
  const { error, setError, fail } = usePlanningError(expired);
  useEffect(() => {
    let active = true;
    setData(null);
    void Promise.all([
      api<Administration>(`/classes/${classId}/administration`),
      api<Evaluators>(`/projects/${projectId}/evaluators`),
    ])
      .then(([administration, links]) => {
        if (active)
          setData({
            people: administration.people.filter((person) =>
              ["AVALIADOR", "ADMIN"].includes(person.role),
            ),
            links,
          });
      })
      .catch((failure) => {
        if (active) fail(failure);
      });
    return () => {
      active = false;
    };
  }, [classId, projectId, revision, fail]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const evaluatorIds = new FormData(event.currentTarget)
      .getAll("evaluatorIds")
      .map(Number);
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const links = await api<Evaluators>(`/projects/${projectId}/evaluators`, {
        method: "PUT",
        body: JSON.stringify({ evaluatorIds }),
      });
      setData((current) => ({ ...current!, links }));
      setSuccess("Avaliadores atualizados.");
    } catch (failure) {
      fail(failure);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={panelClass} aria-label="Gestão de avaliadores">
      <h3 className={panelTitle}>Avaliadores do projeto</h3>
      {error && (
        <Notice>
          {error}
          <Button
            variant="outline"
            size="xs"
            onClick={() => {
              setError("");
              setRevision((value) => value + 1);
            }}
          >
            Recarregar avaliadores
          </Button>
        </Notice>
      )}
      {success && (
        <Success>{success}</Success>
      )}
      {!data ? (
        <p role="status">Carregando avaliadores…</p>
      ) : (
        <>
          <form onSubmit={(event) => void save(event)}>
            <fieldset disabled={busy}>
              <legend>Contas avaliadoras</legend>
              <People
                key={JSON.stringify(data.links.evaluatorIds)}
                people={data.people}
                selected={data.links.evaluatorIds}
                name="evaluatorIds"
              />
              <button className={buttonVariants({ variant: "outline", size: "sm" })}>Salvar avaliadores</button>
            </fieldset>
          </form>
          <History items={data.links.history} people={data.people} />
        </>
      )}
    </section>
  );
}

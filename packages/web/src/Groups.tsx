import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api, ApiError } from "./api";
import type { Administration, LinkChange, Person, Evaluators, Project } from "./api";
import { buttonVariants } from "./components/ui/button";
import { noticeClass } from "./components/Feedback";
import { mutedText, panelClass } from "./components/Panel";
import { StatusBadge } from "./components/StatusBadge";
import { Badge } from "./components/ui/badge";
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
    <div className="flex flex-wrap gap-x-4 gap-y-2">
      {!people.length && <p className={mutedText}>Nenhuma conta ativa disponível.</p>}
      {people.map((person) => (
        <label key={person.id}>
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
function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={cn("rounded-lg px-3.5 py-2.5", warn ? "bg-warning/10" : "bg-muted")}>
      <dt className={cn("text-xs", warn ? "text-warning" : "text-muted-foreground")}>{label}</dt>
      <dd className={cn("text-lg font-semibold tabular-nums", warn && "text-warning")}>{value}</dd>
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
        <p role="status" className="rounded-lg bg-success/10 px-3.5 py-2.5 text-sm text-success">
          {success}
        </p>
      )}
      {error && (
        <div className={noticeClass}>
          <p role="alert">{error}</p>
          <button
            onClick={() => {
              setError("");
              setRevision((value) => value + 1);
            }}
          >
            Recarregar grupos
          </button>
        </div>
      )}
      {!data ? (
        <p role="status" className={mutedText}>Carregando grupos…</p>
      ) : (
        <>
          <dl className="m-0 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Stat label="Grupos" value={String(data.groups.length)} />
            {projects && (
              <Stat
                label="Com projeto"
                value={`${data.groups.filter((group) => projectOf(group.id)).length} / ${data.groups.length}`}
              />
            )}
            <Stat
              label="Alunos sem grupo"
              value={String(unassigned.length)}
              warn={unassigned.length > 0}
            />
          </dl>
          {unassigned.length > 0 && (
            <p className="-mt-1 text-xs text-muted-foreground">
              Sem grupo: {unassigned.map((person) => person.fullName).join(", ")}
            </p>
          )}
          {!data.groups.length && <p className={mutedText}>Nenhum grupo cadastrado.</p>}
          <ul className="m-0 list-none divide-y rounded-lg border p-0 empty:hidden">
            {data.groups.map((group) => {
              const project = projectOf(group.id);
              const editing = isEditing(group);
              return (
                <li key={group.id}>
                  <section
                    aria-labelledby={`group-${group.id}`}
                    className="grid grid-cols-[minmax(0,1fr)] gap-3 px-4 py-3"
                  >
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                      <h4 id={`group-${group.id}`} className="min-w-0 flex-1 text-sm font-medium sm:w-28 sm:flex-none">
                        {group.name}
                      </h4>
                      <div className="order-3 flex min-w-0 basis-full flex-wrap gap-1.5 sm:order-none sm:flex-1 sm:basis-auto">
                        {group.memberIds.length ? (
                          group.memberIds.map((id) => (
                            <Badge key={id} className="bg-card ring-1 ring-border">
                              {personName(data.people, id)}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-subtle-foreground">Sem integrantes</span>
                        )}
                      </div>
                      <div className="order-4 flex min-w-0 basis-full items-center gap-2 text-xs text-muted-foreground empty:hidden sm:order-none sm:w-64 sm:basis-auto">
                        {project ? (
                          <>
                            <a
                              className="min-w-0 truncate font-medium text-foreground no-underline hover:underline"
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
                          projects && <span>Sem projeto</span>
                        )}
                      </div>
                      <button
                        type="button"
                        className={buttonVariants({
                          variant: editing ? "default" : "outline",
                          size: "sm",
                        })}
                        aria-expanded={editing}
                        aria-label={`Editar integrantes de ${group.name}`}
                        onClick={() =>
                          setToggled((current) => ({ ...current, [group.id]: !editing }))
                        }
                      >
                        {editing ? "Fechar" : "Editar"}
                      </button>
                    </div>
                    {editing && (
                      <div className="grid gap-3 rounded-lg bg-muted/60 p-4">
                        <form onSubmit={(event) => void submit(event, group.id)}>
                          <fieldset disabled={busy}>
                            <legend>Integrantes de {group.name}</legend>
                            <People
                              key={JSON.stringify(group.memberIds)}
                              people={students}
                              selected={group.memberIds}
                              name="memberIds"
                            />
                            <button className={buttonVariants({ size: "sm" })}>
                              Salvar integrantes de {group.name}
                            </button>
                          </fieldset>
                        </form>
                        <History items={group.history} people={data.people} />
                      </div>
                    )}
                  </section>
                </li>
              );
            })}
          </ul>
          <form
            onSubmit={(event) => void submit(event)}
            className="flex flex-wrap items-center gap-2"
          >
            <label htmlFor={`new-group-${classId}`} className="sr-only">
              Nome do novo grupo
            </label>
            <Input
              id={`new-group-${classId}`}
              name="name"
              required
              maxLength={120}
              disabled={busy}
              placeholder="Nome do novo grupo"
              className="h-9 min-w-40 flex-1 sm:max-w-xs"
            />
            <button
              className={buttonVariants({ variant: "outline", size: "sm" })}
              disabled={busy}
            >
              Cadastrar grupo
            </button>
          </form>
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
      <h3>Avaliadores do projeto</h3>
      {error && (
        <>
          <p role="alert">{error}</p>
          <button
            onClick={() => {
              setError("");
              setRevision((value) => value + 1);
            }}
          >
            Recarregar avaliadores
          </button>
        </>
      )}
      {success && <p role="status">{success}</p>}
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

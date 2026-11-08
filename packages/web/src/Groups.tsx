import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api, ApiError } from "./api";
import type { Administration, LinkChange, Person, Evaluators } from "./api";

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
function History({ items }: { items: LinkChange[] }) {
  return (
    <details>
      <summary>Histórico de vínculos ({items.length})</summary>
      {!items.length && <p>Nenhuma alteração registrada.</p>}
      <ol>
        {items.map((item, index) => (
          <li key={index}>
            {new Date(item.changedAt).toLocaleString("pt-BR")} · Conta{" "}
            {item.changedBy}: [{item.before.join(", ")}] → [
            {item.after.join(", ")}]
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
    <div className="people-options">
      {!people.length && <p>Nenhuma conta ativa disponível.</p>}
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
export function GroupManager({
  classId,
  onChanged,
  expired,
}: { classId: number; onChanged: () => void } & Expiry) {
  const [data, setData] = useState<Administration | null>(null);
  const [revision, setRevision] = useState(0);
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
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
  return (
    <section className="create-panel" aria-label="Gestão de grupos">
      <h3>Grupos e integrantes</h3>
      {success && <p role="status">{success}</p>}
      {error && (
        <>
          <p role="alert">{error}</p>
          <button
            onClick={() => {
              setError("");
              setRevision((value) => value + 1);
            }}
          >
            Recarregar grupos
          </button>
        </>
      )}
      {!data ? (
        <p role="status">Carregando grupos…</p>
      ) : (
        <>
          <form onSubmit={(event) => void submit(event)}>
            <fieldset disabled={busy}>
              <label>
                Nome do novo grupo
                <input name="name" required maxLength={120} />
              </label>
              <button className="primary">Cadastrar grupo</button>
            </fieldset>
          </form>
          {!data.groups.length && <p>Nenhum grupo cadastrado.</p>}
          <div className="managed-groups">
            {data.groups.map((group) => (
              <section key={group.id} className="planning-block">
                <h4>{group.name}</h4>
                <form onSubmit={(event) => void submit(event, group.id)}>
                  <fieldset disabled={busy}>
                    <legend>Integrantes de {group.name}</legend>
                    <People
                      key={JSON.stringify(group.memberIds)}
                      people={data.people.filter((person) =>
                        ["ALUNO", "ADMIN"].includes(person.role),
                      )}
                      selected={group.memberIds}
                      name="memberIds"
                    />
                    <button className="secondary">
                      Salvar integrantes de {group.name}
                    </button>
                  </fieldset>
                </form>
                <History items={group.history} />
              </section>
            ))}
          </div>
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
    <section className="create-panel" aria-label="Gestão de avaliadores">
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
              <button className="secondary">Salvar avaliadores</button>
            </fieldset>
          </form>
          <History items={data.links.history} />
        </>
      )}
    </section>
  );
}

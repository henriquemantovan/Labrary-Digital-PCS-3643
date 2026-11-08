import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api, ApiError } from "./api";
import type {
  Administration,
  LinkChange,
  Person,
} from "./api";

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
  const [busy, setBusy] = useState(false);
  const { error, setError, fail } = usePlanningError(expired);
  useEffect(() => {
    let active = true;
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
          {data.groups.map((group) => (
            <section key={group.id} className="planning-block">
              <h4>{group.name}</h4>
              <form onSubmit={(event) => void submit(event, group.id)}>
                <fieldset disabled={busy}>
                  <legend>Integrantes de {group.name}</legend>
                  <People
                    key={JSON.stringify(group.memberIds)}
                    people={data.people.filter(
                      (person) => person.role === "ALUNO",
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
        </>
      )}
    </section>
  );
}

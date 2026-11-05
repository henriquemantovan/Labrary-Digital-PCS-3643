import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api, ApiError } from "./api";
import type {
  Administration,
  Criterion,
  Evaluators,
  LinkChange,
  Person,
  Project,
  Requirement,
  RubricVersion,
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
const kinds = ["VIDEO", "RELATORIO", "MANUAL"] as const;
const labels = { VIDEO: "Vídeo", RELATORIO: "Relatório", MANUAL: "Manual" };
const blankCriterion: Criterion = {
  title: "",
  description: "",
  weight: 100,
  minScore: 0,
  maxScore: 10,
};
export function ProjectPlanning({
  project,
  teacher,
  expired,
}: { project: Project; teacher: boolean } & Expiry) {
  const [data, setData] = useState<{
    requirements: Requirement[];
    rubrics: RubricVersion[];
    administration: Administration;
    evaluators: Evaluators;
  } | null>(null);
  const [criteria, setCriteria] = useState<Criterion[]>([blankCriterion]);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState("");
  const { error, setError, fail } = usePlanningError(expired);
  useEffect(() => {
    let active = true;
    setData(null);
    void Promise.all([
      api<Requirement[]>(`/projects/${project.id}/requirements`),
      api<RubricVersion[]>(`/projects/${project.id}/rubrics`),
      teacher
        ? api<Administration>(`/classes/${project.classId}/administration`)
        : Promise.resolve({ groups: [], people: [] }),
      teacher
        ? api<Evaluators>(`/projects/${project.id}/evaluators`)
        : Promise.resolve({ evaluatorIds: [], history: [] }),
    ])
      .then(([requirements, rubrics, administration, evaluators]) => {
        if (active) {
          setData({ requirements, rubrics, administration, evaluators });
          setCriteria(rubrics.at(-1)?.criteria ?? [blankCriterion]);
        }
      })
      .catch((failure) => {
        if (active) fail(failure);
      });
    return () => {
      active = false;
    };
  }, [project.id, project.classId, teacher, revision, fail]);
  async function save(
    event: FormEvent<HTMLFormElement>,
    section: "requirements" | "rubrics" | "evaluators",
  ) {
    event.preventDefault();
    const input = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      if (section === "requirements") {
        const requirements = kinds.map((kind) => ({
          kind,
          label: labels[kind],
          required: true,
          allowedMimeTypes: String(input.get(`${kind}-formats`))
            .split(",")
            .map((value) => value.trim()),
          maxSizeBytes: Number(input.get(`${kind}-size`)),
          dueAt: new Date(String(input.get(`${kind}-due`))).toISOString(),
        }));
        const saved = await api<Requirement[]>(
          `/projects/${project.id}/requirements`,
          { method: "PUT", body: JSON.stringify({ requirements }) },
        );
        setData((current) => ({ ...current!, requirements: saved }));
      } else if (section === "rubrics") {
        const version = await api<RubricVersion>(
          `/projects/${project.id}/rubrics`,
          {
            method: "POST",
            body: JSON.stringify({
              title: input.get("title"),
              criteria,
              baseVersion: data!.rubrics.at(-1)?.id ?? 0,
            }),
          },
        );
        setData((current) => ({
          ...current!,
          rubrics: [...current!.rubrics, version],
        }));
      } else {
        const evaluators = await api<Evaluators>(
          `/projects/${project.id}/evaluators`,
          {
            method: "PUT",
            body: JSON.stringify({
              evaluatorIds: input.getAll("evaluatorIds").map(Number),
            }),
          },
        );
        setData((current) => ({ ...current!, evaluators }));
      }
      setSuccess("Configuração salva.");
    } catch (failure) {
      fail(failure);
    } finally {
      setBusy(false);
    }
  }
  const total =
    criteria.reduce((sum, item) => sum + Math.round(item.weight * 100), 0) /
    100;
  function editCriterion(index: number, change: Partial<Criterion>) {
    setCriteria((items) =>
      items.map((item, position) =>
        position === index ? { ...item, ...change } : item,
      ),
    );
  }
  return (
    <section className="create-panel" aria-label="Configuração do projeto">
      <h2>Requisitos e rubricas</h2>
      {error && (
        <>
          <p role="alert">{error}</p>
          <button
            onClick={() => {
              setError("");
              setRevision((value) => value + 1);
            }}
          >
            Recarregar configuração
          </button>
        </>
      )}
      {success && <p role="status">{success}</p>}
      {!data ? (
        <p role="status">Carregando configuração…</p>
      ) : (
        <>
          <h3>Materiais obrigatórios</h3>
          {teacher ? (
            <form onSubmit={(event) => void save(event, "requirements")}>
              <fieldset disabled={busy}>
                <p>
                  Defina os formatos MIME, o limite em bytes e o prazo local
                  para cada material.
                </p>
                {kinds.map((kind) => {
                  const saved = data.requirements.find(
                    (item) => item.kind === kind,
                  );
                  return (
                    <fieldset key={kind} className="planning-block">
                      <legend>{labels[kind]}</legend>
                      <div className="form-grid">
                        <label>
                          Formatos de {labels[kind]} (MIME, separados por
                          vírgula)
                          <input
                            name={`${kind}-formats`}
                            required
                            defaultValue={saved?.allowedMimeTypes.join(", ")}
                            placeholder="application/pdf"
                          />
                        </label>
                        <label>
                          Tamanho máximo de {labels[kind]} (bytes)
                          <input
                            type="number"
                            min={1}
                            step={1}
                            name={`${kind}-size`}
                            required
                            defaultValue={saved?.maxSizeBytes}
                          />
                        </label>
                        <label>
                          Prazo de {labels[kind]}
                          <input
                            type="datetime-local"
                            name={`${kind}-due`}
                            required
                            defaultValue={saved && localDate(saved.dueAt)}
                          />
                        </label>
                      </div>
                    </fieldset>
                  );
                })}
                <button className="primary">Salvar requisitos</button>
              </fieldset>
            </form>
          ) : (
            <>
              {!data.requirements.length && (
                <p>Requisitos ainda não configurados pelo professor.</p>
              )}
              <ul>
                {data.requirements.map((item) => (
                  <li key={item.kind}>
                    {item.label} · {item.allowedMimeTypes.join(", ")} ·{" "}
                    {item.maxSizeBytes} bytes ·{" "}
                    {new Date(item.dueAt).toLocaleString("pt-BR")}
                  </li>
                ))}
              </ul>
            </>
          )}
          <h3>Versões da rubrica</h3>
          {!data.rubrics.length && <p>Nenhuma rubrica cadastrada.</p>}
          {data.rubrics.map((version) => (
            <details key={version.id}>
              <summary>
                v{version.versionNumber} · {version.title}
              </summary>
              <p>
                {new Date(version.createdAt).toLocaleString("pt-BR")} · Conta{" "}
                {version.createdBy}
              </p>
              <ul>
                {version.criteria.map((item, index) => (
                  <li key={index}>
                    {item.title} · {item.weight}% · escala 0–10
                    <p>{item.description}</p>
                  </li>
                ))}
              </ul>
            </details>
          ))}
          {teacher && (
            <>
              <form onSubmit={(event) => void save(event, "rubrics")}>
                <fieldset disabled={busy}>
                  <legend>Nova versão explícita da rubrica</legend>
                  <p>
                    Salvar sempre cria uma versão; as versões anteriores
                    permanecem disponíveis.
                  </p>
                  <label>
                    Título da rubrica
                    <input name="title" required maxLength={160} />
                  </label>
                  {criteria.map((item, index) => (
                    <div className="planning-block" key={index}>
                      <label>
                        Critério {index + 1}
                        <input
                          required
                          maxLength={160}
                          value={item.title}
                          onChange={(event) =>
                            editCriterion(index, { title: event.target.value })
                          }
                        />
                      </label>
                      <label>
                        Descrição do critério {index + 1}
                        <textarea
                          value={item.description}
                          onChange={(event) =>
                            editCriterion(index, {
                              description: event.target.value,
                            })
                          }
                        />
                      </label>
                      <label>
                        Peso do critério {index + 1} (%)
                        <input
                          type="number"
                          min={0.01}
                          max={100}
                          step={0.01}
                          required
                          value={item.weight}
                          onChange={(event) =>
                            editCriterion(index, {
                              weight: Number(event.target.value),
                            })
                          }
                        />
                      </label>
                      <button
                        type="button"
                        className="text-button"
                        disabled={criteria.length === 1}
                        onClick={() =>
                          setCriteria((items) =>
                            items.filter((_, position) => position !== index),
                          )
                        }
                      >
                        Remover critério {index + 1}
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="secondary"
                    onClick={() =>
                      setCriteria((items) => [
                        ...items,
                        { ...blankCriterion, weight: 1 },
                      ])
                    }
                  >
                    Adicionar critério
                  </button>
                  <p role="status">Soma dos pesos: {total}% · Escala: 0 a 10</p>
                  <button className="primary" disabled={total !== 100}>
                    Criar nova versão
                  </button>
                </fieldset>
              </form>
              <h3>Avaliadores</h3>
              <form onSubmit={(event) => void save(event, "evaluators")}>
                <fieldset disabled={busy}>
                  <legend>Avaliadores vinculados ao projeto</legend>
                  <People
                    key={JSON.stringify(data.evaluators.evaluatorIds)}
                    people={data.administration.people.filter(
                      (person) => person.role === "AVALIADOR",
                    )}
                    selected={data.evaluators.evaluatorIds}
                    name="evaluatorIds"
                  />
                  <button className="secondary">Salvar avaliadores</button>
                </fieldset>
              </form>
              <History items={data.evaluators.history} />
            </>
          )}
        </>
      )}
    </section>
  );
}
function localDate(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

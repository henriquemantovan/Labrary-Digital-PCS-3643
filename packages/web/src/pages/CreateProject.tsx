import { useState } from "react";
import type { FormEvent } from "react";
import { api, ApiError } from "../api";
import type { Project, Scope } from "../api";
import { Icon } from "../Icons";
import { Notice } from "../components/Feedback";

export function CreateProject({
  scope,
  projects,
  onCreated,
  expired,
}: {
  scope: Scope;
  projects: Project[];
  onCreated: (project: Project) => void;
  expired: () => void;
}) {
  const groups = scope.groups.filter(
    (group) => !projects.some((project) => project.groupId === group.id),
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const group = groups.find(
      (item) => item.id === Number(data.get("groupId")),
    );
    if (!group) return;
    setBusy(true);
    setError("");
    try {
      onCreated(
        await api<Project>("/projects", {
          method: "POST",
          body: JSON.stringify({
            groupId: group.id,
            classId: group.classId,
            title: data.get("title"),
            description: data.get("description"),
            category: data.get("category"),
          }),
        }),
      );
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) expired();
      else setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="create-panel">
      <h2>Novo projeto</h2>
      {error && <Notice>{error}</Notice>}
      {!groups.length ? (
        <p className="muted">
          Todos os grupos vinculados já têm projeto. Cadastre outro grupo em
          Minhas turmas.
        </p>
      ) : (
        <form onSubmit={submit}>
          <fieldset disabled={busy}>
            <div className="form-grid">
              <label>
                Título
                <input name="title" required maxLength={200} />
              </label>
              <label>
                Grupo
                <select name="groupId">
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name} ·{" "}
                      {
                        scope.classes.find((item) => item.id === group.classId)
                          ?.name
                      }
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Categoria
                <input name="category" required maxLength={100} />
              </label>
              <label>
                Descrição
                <textarea name="description" maxLength={10000} rows={2} />
              </label>
            </div>
            <button className="primary" type="submit">
              {busy ? "Criando…" : "Criar projeto"}
              <Icon name="arrow" size={17} />
            </button>
          </fieldset>
        </form>
      )}
    </section>
  );
}

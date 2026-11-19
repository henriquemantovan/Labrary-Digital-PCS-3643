import { useState } from "react";
import type { FormEvent } from "react";
import { api, ApiError } from "../api";
import type { Project, Scope } from "../api";
import { ArrowRight } from "lucide-react";
import { Notice } from "../components/Feedback";
import { Button } from "../components/ui/button";
import { fieldLabel, Input, NativeSelect, Textarea } from "../components/ui/input";

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
    <section className="mb-8 rounded-xl border bg-card p-5 md:p-6">
      <h2 className="mb-4 text-base font-semibold tracking-tight">Novo projeto</h2>
      {error && (
        <div className="mb-4">
          <Notice>{error}</Notice>
        </div>
      )}
      {!groups.length ? (
        <p className="text-sm text-muted-foreground">
          Todos os grupos vinculados já têm projeto. Cadastre outro grupo em
          Minhas turmas.
        </p>
      ) : (
        <form onSubmit={submit}>
          <fieldset disabled={busy} className="m-0 grid gap-5 border-0 p-0">
            <div className="grid gap-4 md:grid-cols-2">
              <label className={fieldLabel}>
                Título
                <Input name="title" required maxLength={200} />
              </label>
              <label className={fieldLabel}>
                Grupo
                <NativeSelect name="groupId">
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name} ·{" "}
                      {
                        scope.classes.find((item) => item.id === group.classId)
                          ?.name
                      }
                    </option>
                  ))}
                </NativeSelect>
              </label>
              <label className={fieldLabel}>
                Categoria
                <Input name="category" required maxLength={100} />
              </label>
              <label className={fieldLabel}>
                Descrição
                <Textarea name="description" maxLength={10000} rows={2} />
              </label>
            </div>
            <Button type="submit" className="justify-self-start">
              {busy ? "Criando…" : "Criar projeto"}
              <ArrowRight />
            </Button>
          </fieldset>
        </form>
      )}
    </section>
  );
}

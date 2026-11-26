import { useState } from "react";
import type { FormEvent } from "react";
import { api, ApiError } from "../api";
import type { Project, Scope } from "../api";
import { ArrowRight } from "lucide-react";
import { Notice } from "../components/Feedback";
import { Button } from "../components/ui/button";
import { Card, CardHeader, CardPanel, CardTitle } from "../components/ui/card";
import { Field, FieldLabel } from "../components/ui/field";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { NativeSelect } from "../components/ui/native-select";
import { Textarea } from "../components/ui/textarea";

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
    <Card render={<section aria-labelledby="create-project-title" />} className="mb-8">
      <CardHeader>
        <CardTitle render={<h2 id="create-project-title" />} className="text-base">
          Novo projeto
        </CardTitle>
      </CardHeader>
      <CardPanel className="grid gap-4">
        {error && <Notice>{error}</Notice>}
        {!groups.length ? (
          <p className="text-sm text-muted-foreground">
            Todos os grupos vinculados já têm projeto. Cadastre outro grupo em
            Minhas turmas.
          </p>
        ) : (
          <form onSubmit={submit}>
            <fieldset disabled={busy} className="m-0 grid gap-5 border-0 p-0">
              <div className="grid gap-4 md:grid-cols-2">
                <Field>
                  <FieldLabel>Título</FieldLabel>
                  <Input name="title" required maxLength={200} />
                </Field>
                <div className="flex flex-col items-start gap-2">
                  <Label htmlFor="create-project-group">Grupo</Label>
                  <NativeSelect id="create-project-group" name="groupId">
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
                </div>
                <Field>
                  <FieldLabel>Categoria</FieldLabel>
                  <Input name="category" required maxLength={100} />
                </Field>
                <Field>
                  <FieldLabel>Descrição</FieldLabel>
                  <Textarea name="description" maxLength={10000} rows={2} />
                </Field>
              </div>
              <Button type="submit" className="justify-self-start">
                {busy ? "Criando…" : "Criar projeto"}
                <ArrowRight />
              </Button>
            </fieldset>
          </form>
        )}
      </CardPanel>
    </Card>
  );
}

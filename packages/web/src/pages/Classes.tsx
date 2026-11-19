import type { Project, Scope } from "../api";
import { ArrowRight, BookOpen } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/ui/button";
import { Empty } from "../components/Feedback";
import { GroupManager } from "../Groups";

export function Classes({
  scope,
  projects,
  navigate,
  expired,
  onChanged,
}: {
  scope: Scope;
  projects: Project[];
  navigate: (path: string) => void;
  expired: () => void;
  onChanged: () => void;
}) {
  return (
      <>
        <PageHeader
          eyebrow="Gestão acadêmica"
          title="Minhas turmas"
          intro="Grupos e projetos sob sua responsabilidade."
        />
        <div className="grid gap-4">
          {scope.classes.map((item) => {
            const groups = scope.groups.filter((group) => group.classId === item.id);
            return (
              <article className="flex flex-col rounded-xl border bg-card p-5" key={item.id}>
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                    <BookOpen className="size-5" />
                  </span>
                  <div className="grid min-w-0 gap-0.5">
                    <span className="text-xs text-subtle-foreground">{item.academicYear}</span>
                    <h2 className="text-base font-semibold tracking-tight">{item.name}</h2>
                    <p className="text-xs text-muted-foreground">
                      {groups.length} grupos ·{" "}
                      {
                        projects.filter((project) => project.classId === item.id)
                          .length
                      }{" "}
                      projetos
                    </p>
                  </div>
                </div>
                <ul className="my-4 divide-y rounded-lg border text-sm empty:hidden">
                  {groups.map((group) => (
                    <li key={group.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                      <span>{group.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {projects.some(
                          (project) => project.groupId === group.id,
                        )
                          ? "Projeto cadastrado"
                          : "Sem projeto"}
                      </span>
                    </li>
                  ))}
                </ul>
                <GroupManager
                  classId={item.id}
                  onChanged={onChanged}
                  expired={expired}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-3 self-start"
                  onClick={() => navigate("/projetos")}
                >
                  Gerenciar projetos <ArrowRight />
                </Button>
              </article>
            );
          })}
        </div>
        {!scope.classes.length && (
          <Empty
            title="Nenhuma turma vinculada"
            text="Suas turmas aparecerão aqui quando forem vinculadas à sua conta."
          />
        )}
      </>
  );
}

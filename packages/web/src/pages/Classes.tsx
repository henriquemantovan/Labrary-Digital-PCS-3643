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
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
          {scope.classes.map((item) => (
            <article className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5 rounded-xl border bg-card p-5 md:p-6" key={item.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                    <BookOpen className="size-5" />
                  </span>
                  <div className="grid min-w-0 gap-0.5">
                    <span className="text-xs text-subtle-foreground">{item.academicYear}</span>
                    <h2 className="text-base font-semibold tracking-tight">{item.name}</h2>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => navigate("/projetos")}>
                  Gerenciar projetos <ArrowRight />
                </Button>
              </div>
              <GroupManager
                classId={item.id}
                projects={projects.filter((project) => project.classId === item.id)}
                navigate={navigate}
                onChanged={onChanged}
                expired={expired}
              />
            </article>
          ))}
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

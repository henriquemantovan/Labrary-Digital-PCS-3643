import type { Project, Scope } from "../api";
import { ArrowRight, BookOpen } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { Badge } from "../components/ui/badge";
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
        <div className="grid grid-cols-[minmax(0,1fr)] gap-12">
          {scope.classes.map((item) => (
            <section
              aria-labelledby={`class-${item.id}`}
              className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5"
              key={item.id}
            >
              <header className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg border bg-background text-muted-foreground shadow-xs/5">
                    <BookOpen className="size-5" />
                  </span>
                  <div className="grid min-w-0 gap-1">
                    <h2 id={`class-${item.id}`} className="truncate font-heading text-lg font-semibold">
                      {item.name}
                    </h2>
                    <Badge variant="outline" className="justify-self-start tabular-nums">
                      {item.academicYear}
                    </Badge>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate("/projetos")}>
                  Gerenciar projetos <ArrowRight />
                </Button>
              </header>
              <GroupManager
                classId={item.id}
                projects={projects.filter((project) => project.classId === item.id)}
                navigate={navigate}
                onChanged={onChanged}
                expired={expired}
              />
            </section>
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

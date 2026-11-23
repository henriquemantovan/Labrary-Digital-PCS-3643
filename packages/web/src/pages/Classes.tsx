import type { Project, Scope } from "../api";
import { ArrowRight, BookOpen } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
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
            <Card
              render={<article />}
              className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5 p-5 md:p-6"
              key={item.id}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg border bg-background text-muted-foreground shadow-xs/5">
                    <BookOpen className="size-5" />
                  </span>
                  <div className="grid min-w-0 gap-1">
                    <h2 className="font-heading text-base font-semibold">{item.name}</h2>
                    <Badge variant="outline" className="justify-self-start tabular-nums">{item.academicYear}</Badge>
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
            </Card>
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

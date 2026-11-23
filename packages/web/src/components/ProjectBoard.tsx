import type { MouseEvent, ReactNode } from "react";
import { ArrowUpRight, CalendarDays, Check, CircleAlert, CircleCheck, Users } from "lucide-react";
import type { Project } from "../api";
import { materialLabels, statusLabels } from "../labels";
import { cn } from "../lib/utils";

// Colunas na ordem de quem está com o projeto: o grupo prepara ou ajusta,
// a banca avalia e o professor finaliza.
const columns = [
  { status: "PREPARACAO", text: "text-info", fill: "bg-info" },
  { status: "AJUSTES", text: "text-destructive", fill: "bg-destructive" },
  { status: "EM_AVALIACAO", text: "text-warning", fill: "bg-warning" },
  { status: "FINALIZADO", text: "text-success", fill: "bg-success" },
] as const;

// Fatia do círculo de progresso de cada estado (centro 7,7, raio 4).
const slices: Record<string, string> = {
  PREPARACAO: "M7 7V3a4 4 0 0 1 4 4z",
  AJUSTES: "M7 3a4 4 0 0 1 0 8z",
  EM_AVALIACAO: "M7 7V3a4 4 0 1 1-4 4z",
};

export function StatusGlyph({ status, className }: { status: string; className?: string }) {
  if (status === "FINALIZADO")
    return (
      <span
        aria-hidden="true"
        className={cn("grid size-3.5 shrink-0 place-items-center rounded-full bg-current", className)}
      >
        <Check className="size-2.5 text-white" strokeWidth={3.5} />
      </span>
    );
  return (
    <svg viewBox="0 0 14 14" aria-hidden="true" className={cn("size-3.5 shrink-0", className)}>
      <circle cx="7" cy="7" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
      {slices[status] && <path d={slices[status]} fill="currentColor" />}
    </svg>
  );
}

const pill =
  "inline-flex h-7 max-w-full shrink-0 items-center gap-1.5 rounded-full border bg-card px-2.5 text-[13px] text-foreground/80 [&_svg]:size-3.5 [&_svg]:shrink-0";

const dayMonth = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short" });

function DuePill({ project }: { project: Project }) {
  if (!project.dueAt) return null;
  const due = new Date(project.dueAt);
  if (project.status !== "FINALIZADO" && due.getTime() < Date.now())
    return <span className={cn(pill, "text-destructive")}>Prazo vencido</span>;
  return (
    <span className={pill}>
      <CalendarDays className="text-muted-foreground" />
      <span className="sr-only">Prazo: </span>
      {dayMonth.format(due)}
    </span>
  );
}

function ProjectCard({
  project,
  tone,
  navigate,
}: {
  project: Project;
  tone: string;
  navigate: (path: string) => void;
}) {
  const href = `/projetos/${project.id}`;
  const open = (event: MouseEvent) => {
    event.preventDefault();
    navigate(href);
  };
  const missing = project.missingMaterials;
  return (
    <article className="group relative rounded-xl border bg-card shadow-card transition-[border-color,box-shadow] hover:border-input hover:shadow-raised has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring">
      <div className="px-4 pt-3.5 pb-3">
        <div className="flex items-start gap-2">
          <StatusGlyph status={project.status} className={cn("mt-[3px]", tone)} />
          <h4 className="min-w-0 flex-1 text-sm leading-5 font-medium [overflow-wrap:anywhere]">
            {/* O título cobre o cartão inteiro: clicar em qualquer ponto abre o projeto. */}
            <a
              className="text-foreground no-underline after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none"
              href={href}
              onClick={open}
            >
              {project.title}
            </a>
          </h4>
          <a
            className="relative z-10 -mt-0.5 -mr-1.5 grid size-6 shrink-0 place-items-center rounded-md text-subtle-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={`Abrir ${project.title}`}
            href={href}
            onClick={open}
          >
            <ArrowUpRight className="size-3.5" />
          </a>
        </div>
        <p className="mt-1 flex min-w-0 items-center gap-1.5 pl-5.5 text-[13px] text-muted-foreground">
          <span className="truncate">{project.category}</span>
          {project.academicYear && (
            <>
              <span aria-hidden="true" className="text-input">
                •
              </span>
              <span className="tabular-nums">{project.academicYear}</span>
            </>
          )}
        </p>
        <p className="mt-2 line-clamp-2 text-[13px] leading-5 text-muted-foreground [overflow-wrap:anywhere]">
          {project.description || "Descrição ainda não informada."}
        </p>
        {missing && (
          <p
            className={cn(
              "mt-2.5 flex items-start gap-1.5 text-xs leading-4",
              missing.length ? "text-warning" : "text-success",
            )}
          >
            {missing.length ? (
              <CircleAlert className="size-3.5 shrink-0" />
            ) : (
              <CircleCheck className="size-3.5 shrink-0" />
            )}
            <span>
              {missing.length
                ? `Pendentes: ${missing.map((kind) => materialLabels[kind]).join(", ")}`
                : "Materiais obrigatórios presentes"}
            </span>
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5 border-t px-4 py-3">
        <span className={pill}>
          <Users className="text-muted-foreground" />
          <span className="truncate">
            {project.groupName ?? `Grupo ${String(project.groupId).padStart(2, "0")}`}
          </span>
        </span>
        <DuePill project={project} />
      </div>
    </article>
  );
}

function Column({
  status,
  fill,
  children,
  count,
}: {
  status: string;
  fill: string;
  count: number;
  children: ReactNode;
}) {
  const id = `board-column-${status}`;
  return (
    <section
      aria-labelledby={id}
      className="flex min-w-0 flex-col border-b last:border-b-0 md:min-w-[264px] md:flex-1 md:border-r md:border-b-0 md:last:border-r-0"
    >
      <header className="flex h-12 shrink-0 items-center gap-2 px-4">
        <span
          aria-hidden="true"
          className={cn("grid size-4 shrink-0 place-items-center rounded-[5px] text-white", fill)}
        >
          {status === "FINALIZADO" ? (
            <Check className="size-2.5" strokeWidth={3.5} />
          ) : (
            <StatusGlyph status={status} className="size-2.5" />
          )}
        </span>
        <h3 id={id} className="text-sm font-medium">
          {statusLabels[status]}
        </h3>
        <span className="ml-auto text-xs text-subtle-foreground tabular-nums">
          <span className="sr-only">Projetos: </span>
          {count}
        </span>
      </header>
      <div className="flex flex-1 flex-col gap-3 px-3 pt-1 pb-4">{children}</div>
    </section>
  );
}

export function ProjectBoard({
  projects,
  navigate,
}: {
  projects: Project[];
  navigate: (path: string) => void;
}) {
  return (
    // "relative" faz a rolagem conter também os textos sr-only (position: absolute).
    <div className="relative grid md:flex md:overflow-x-auto">
      {columns.map(({ status, text, fill }) => {
        const items = projects.filter((project) => project.status === status);
        return (
          <Column key={status} status={status} fill={fill} count={items.length}>
            {items.length ? (
              items.map((project) => (
                <ProjectCard key={project.id} project={project} tone={text} navigate={navigate} />
              ))
            ) : (
              <p className="grid h-20 place-items-center rounded-xl border border-dashed text-xs text-subtle-foreground">
                Nenhum projeto
              </p>
            )}
          </Column>
        );
      })}
    </div>
  );
}

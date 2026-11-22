import { ArrowRight, Check, Lock } from "lucide-react";
import type { Project, User } from "../api";
import type { SubmissionChecklist } from "../submissionTypes";
import { StatusBadge } from "../components/StatusBadge";
import { materialLabels } from "../labels";
import { cn } from "../lib/utils";

type StepState = "done" | "current" | "blocked" | "todo";
interface Step {
  label: string;
  hint?: string;
  state: StepState;
}
export interface NextStep {
  text: string;
  /** Seção do detalhe para onde o botão leva. */
  target?: { id: string; label: string };
}

const blockedHints: Record<string, string> = {
  RUBRIC_NOT_CONFIGURED: "Aguardando requisitos do professor",
  DEADLINE_PASSED: "Prazo encerrado",
  SUBMISSION_LOCKED: "Indisponível no momento",
};
const plural = (count: number) =>
  `${count} ${count === 1 ? "material obrigatório" : "materiais obrigatórios"}`;

/** Etapas do fluxo do projeto, derivadas do estado e do checklist que a API já devolve. */
export function projectSteps(
  status: string,
  missing: string[],
  checklist: SubmissionChecklist | null,
): Step[] {
  const submitted = status === "EM_AVALIACAO" || status === "FINALIZADO";
  const block = checklist?.blockedBy;
  return [
    {
      label: "Materiais",
      hint: missing.length
        ? `Pendentes: ${missing.map((kind) => materialLabels[kind]).join(", ")}`
        : "Materiais obrigatórios presentes",
      state:
        submitted || (!missing.length && status !== "AJUSTES") ? "done" : "current",
    },
    {
      label: "Entrega",
      hint: submitted
        ? "Rodada submetida"
        : block && block !== "INCOMPLETE_SUBMISSION"
          ? blockedHints[block]
          : checklist?.canSubmit
            ? "Pronta para submeter"
            : undefined,
      state: submitted
        ? "done"
        : block && block !== "INCOMPLETE_SUBMISSION"
          ? "blocked"
          : checklist?.canSubmit
            ? "current"
            : "todo",
    },
    {
      label: "Avaliação",
      hint: status === "EM_AVALIACAO" ? "Em andamento" : undefined,
      state:
        status === "FINALIZADO" ? "done" : status === "EM_AVALIACAO" ? "current" : "todo",
    },
    {
      label: "Resultado",
      hint: status === "FINALIZADO" ? "Projeto finalizado" : undefined,
      state: status === "FINALIZADO" ? "done" : "todo",
    },
  ];
}

const goTo = (id: string, label: string) => ({ id, label });

/** Próxima ação de quem está vendo o projeto, conforme o papel. */
export function nextStep(
  role: User["role"],
  status: string,
  missing: string[],
  checklist: SubmissionChecklist | null,
): NextStep | null {
  const block = checklist?.blockedBy;
  if (status === "FINALIZADO")
    return role === "ALUNO"
      ? { text: "Projeto finalizado. Confira o resultado do grupo.", target: goTo("secao-resultado", "Ver resultado") }
      : ["PROFESSOR", "ADMIN"].includes(role)
        ? { text: "Projeto finalizado. Gerencie a publicação no acervo.", target: goTo("secao-publicacao", "Ir para publicação") }
        : { text: "Projeto finalizado." };
  if (status === "EM_AVALIACAO")
    return role === "ALUNO"
      ? { text: "Entrega em avaliação. Acompanhe o feedback da equipe.", target: goTo("secao-feedback", "Ir para feedback") }
      : role === "AVALIADOR"
        ? { text: "Próximo passo: avaliar a rodada submetida.", target: goTo("secao-avaliacao", "Ir para avaliação") }
        : { text: "Rodada em avaliação. Acompanhe as avaliações por rubrica.", target: goTo("secao-avaliacao", "Ir para avaliação") };
  if (role === "AVALIADOR") return { text: "Aguardando a submissão do grupo." };
  const staff = role !== "ALUNO";
  if (staff && block === "RUBRIC_NOT_CONFIGURED")
    return { text: "Próximo passo: configurar os requisitos e a rubrica da entrega.", target: goTo("secao-avaliacao", "Configurar") };
  if (missing.length)
    return staff
      ? { text: `Aguardando o grupo enviar ${plural(missing.length)}.`, target: goTo("secao-materiais", "Ver materiais") }
      : { text: `Próximo passo: enviar ${plural(missing.length)}.`, target: goTo("secao-materiais", "Enviar materiais") };
  if (block === "RUBRIC_NOT_CONFIGURED")
    return { text: "Materiais completos. Aguardando o professor configurar a entrega." };
  if (block === "DEADLINE_PASSED")
    return staff
      ? { text: "O prazo terminou. Você pode reabrir a entrega do grupo.", target: goTo("secao-entrega", "Ir para a entrega") }
      : { text: "O prazo terminou. Fale com o professor para reabrir a entrega." };
  if (checklist?.canSubmit)
    return staff
      ? { text: "Materiais completos. Aguardando a submissão do grupo." }
      : { text: "Tudo pronto. Submeta a entrega para avaliação.", target: goTo("secao-entrega", "Ir para a entrega") };
  return null;
}

export function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView?.({ behavior: "smooth", block: "start" });
}

const markers: Record<StepState, string> = {
  done: "bg-success",
  current: "bg-warning",
  blocked: "bg-subtle-foreground",
  todo: "bg-border",
};

export function ProjectProgress({
  project,
  role,
  missing,
  checklist,
}: {
  project: Pick<Project, "status">;
  role: User["role"];
  missing: string[];
  checklist: SubmissionChecklist | null;
}) {
  const steps = projectSteps(project.status, missing, checklist);
  const next = nextStep(role, project.status, missing, checklist);
  return (
    <section
      aria-label="Andamento do projeto"
      className="mb-6 rounded-xl border bg-card p-5 md:p-6"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Andamento</h2>
        <StatusBadge status={project.status} />
      </div>
      <ol className="m-0 grid list-none grid-cols-2 gap-x-3 gap-y-4 p-0 sm:grid-cols-4">
        {steps.map((step, index) => (
          <li
            key={step.label}
            aria-current={step.state === "current" ? "step" : undefined}
            className="grid content-start gap-1.5"
          >
            <span className={cn("h-1 rounded-full", markers[step.state])} />
            <span
              className={cn(
                "flex items-center gap-1.5 text-sm",
                step.state === "todo" ? "text-subtle-foreground" : "font-medium",
              )}
            >
              {step.state === "done" ? (
                <Check className="size-3.5 text-success" aria-hidden="true" />
              ) : step.state === "blocked" ? (
                <Lock className="size-3.5 text-muted-foreground" aria-hidden="true" />
              ) : (
                <span className="text-xs text-subtle-foreground tabular-nums">{index + 1}</span>
              )}
              {step.label}
            </span>
            {step.hint && (
              <span className="text-xs leading-snug text-muted-foreground">{step.hint}</span>
            )}
          </li>
        ))}
      </ol>
      {next && (
        <div
          className={cn(
            "mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg px-4 py-3",
            next.target ? "bg-warning/10" : "bg-muted",
          )}
        >
          <p className={cn("text-sm", next.target ? "text-foreground" : "text-muted-foreground")}>
            {next.text}
          </p>
          {next.target && (
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-3.5 text-[13px] font-medium text-primary-foreground hover:bg-primary/85 [&_svg]:size-3.5"
              onClick={() => scrollToSection(next.target!.id)}
            >
              {next.target.label}
              <ArrowRight aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </section>
  );
}

export function SectionNav({ items }: { items: { id: string; label: string }[] }) {
  return (
    <nav
      aria-label="Seções do projeto"
      className="z-10 -mx-1 mb-6 flex gap-1 overflow-x-auto bg-card/90 px-1 py-2 backdrop-blur [scrollbar-width:none] lg:sticky lg:top-0"
    >
      {items.map((item) => (
        <a
          key={item.id}
          href={`#${item.id}`}
          className="shrink-0 rounded-full px-3 py-1.5 text-[13px] text-muted-foreground no-underline transition-colors hover:bg-muted hover:text-foreground"
          onClick={(event) => {
            event.preventDefault();
            scrollToSection(item.id);
          }}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}

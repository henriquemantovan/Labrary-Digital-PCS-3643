import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  ClipboardCheck,
  Globe,
  LayoutGrid,
  MessagesSquare,
  Sigma,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import { Brand } from "../components/Brand";
import { StatusGlyph } from "../components/ProjectBoard";
import { Badge } from "../components/ui/badge";
import { buttonVariants } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { cn } from "../lib/utils";

const features: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: LayoutGrid,
    title: "Quadro de projetos",
    text: "Cada projeto da turma em uma coluna por estado: em preparação, em ajustes, em avaliação ou finalizado.",
  },
  {
    icon: UploadCloud,
    title: "Materiais versionados",
    text: "Vídeo, relatório e manual com prazo por material e histórico de todas as versões enviadas.",
  },
  {
    icon: MessagesSquare,
    title: "Feedback privado",
    text: "Conversa entre o grupo e a equipe acadêmica, sobre o projeto ou sobre um material específico.",
  },
  {
    icon: ClipboardCheck,
    title: "Avaliação por rubrica",
    text: "O professor define requisitos e critérios; cada avaliador registra notas e comentários por rodada.",
  },
  {
    icon: Sigma,
    title: "Consolidação de notas",
    text: "Notas parciais e finais por grupo, exportação em CSV e liberação do resultado quando tudo estiver avaliado.",
  },
  {
    icon: Globe,
    title: "Acervo público",
    text: "Projetos finalizados e autorizados viram uma vitrine aberta para qualquer visitante.",
  },
];

const steps = [
  { title: "Preparação", text: "O grupo envia vídeo, relatório e manual e acompanha o que falta." },
  { title: "Entrega", text: "Com o checklist completo, o grupo submete a rodada para avaliação." },
  { title: "Avaliação", text: "Avaliadores aplicam a rubrica; o professor consolida e libera as notas." },
  { title: "Publicação", text: "Com a autorização do grupo, o projeto entra no acervo público." },
];

const roles = [
  {
    title: "Aluno",
    items: ["Envia e versiona os materiais", "Submete a entrega do grupo", "Consulta feedback e resultado"],
  },
  {
    title: "Avaliador",
    items: ["Vê só os projetos atribuídos", "Avalia por critérios da rubrica", "Comenta cada rodada"],
  },
  {
    title: "Professor",
    items: ["Organiza turmas e grupos", "Define requisitos e rubrica", "Libera notas e publica projetos"],
  },
];

// Prévia ilustrativa do quadro (decorativa, sem dados reais).
const preview = [
  { status: "PREPARACAO", label: "Em preparação", tone: "text-info", cards: ["Relógio digital", "Contador síncrono"] },
  { status: "AJUSTES", label: "Em ajustes", tone: "text-destructive", cards: ["Calculadora em FPGA"] },
  { status: "EM_AVALIACAO", label: "Em avaliação", tone: "text-warning", cards: ["Controlador de semáforo", "Monitor de energia"] },
  { status: "FINALIZADO", label: "Finalizado", tone: "text-success", cards: ["Alarme residencial"] },
];

const link = "text-muted-foreground no-underline transition-colors hover:text-foreground";

export function Landing() {
  return (
    <div className="min-h-dvh overflow-x-clip bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
        <div className="flex h-14 items-center justify-between gap-4 px-5 md:px-10">
          <a href="/" className="no-underline" aria-label="labrary digital — início">
            <Brand />
          </a>
          <nav aria-label="Seções da página" className="hidden items-center gap-6 text-sm md:flex">
            <a className={link} href="#recursos">Recursos</a>
            <a className={link} href="#como-funciona">Como funciona</a>
            <a className={link} href="#perfis">Perfis</a>
            <a className={link} href="/acervo">Acervo</a>
          </nav>
          <div className="flex items-center gap-2">
            <a
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "md:hidden")}
              href="/acervo"
            >
              Acervo
            </a>
            <a className={buttonVariants({ size: "sm" })} href="/login">
              Entrar
            </a>
          </div>
        </div>
      </header>

      <main>
        <section className="relative px-5 pt-20 pb-16 md:px-10 md:pt-28">
          {/* Grade de fundo esmaecida nas bordas. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-0 bg-[linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] bg-size-[48px_48px] [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_70%)]"
          />
          <div className="relative mx-auto flex max-w-4xl flex-col items-center text-center">
            <Badge variant="outline" size="lg" className="mb-6 h-auto max-w-full gap-1.5 rounded-full px-3 py-1 font-normal whitespace-normal">
              <Sparkles className="text-warning" />
              PCS3643 · Laboratório de Engenharia de Software
            </Badge>
            <h1 className="font-heading text-5xl leading-[1.02] font-semibold tracking-[-0.04em] text-balance md:text-7xl">
              Do primeiro circuito{" "}
              <span className="bg-linear-to-r from-foreground to-foreground/45 bg-clip-text text-transparent">
                à última entrega.
              </span>
            </h1>
            <p className="mt-6 max-w-2xl text-base text-balance text-muted-foreground md:text-lg">
              Entregas, feedback, avaliação por rubrica e um acervo público dos
              projetos de laboratório — tudo em um só lugar, para alunos,
              avaliadores e professores.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <a className={buttonVariants({ size: "lg" })} href="/login">
                Entrar no meu espaço
                <ArrowRight />
              </a>
              <a className={buttonVariants({ variant: "outline", size: "lg" })} href="/acervo">
                Explorar o acervo
              </a>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              As contas são criadas pelo professor da turma.
            </p>
          </div>

          <div aria-hidden="true" className="relative mx-auto mt-16 max-w-6xl">
            <div className="absolute inset-x-10 -top-6 -z-0 h-40 rounded-full bg-info/10 blur-3xl" />
            <Card className="relative overflow-hidden p-0 shadow-lg/5">
              <div className="flex items-center gap-1.5 border-b bg-muted/40 px-4 py-3">
                <span className="size-2.5 rounded-full bg-destructive/60" />
                <span className="size-2.5 rounded-full bg-warning/70" />
                <span className="size-2.5 rounded-full bg-success/70" />
                <span className="ml-3 truncate text-xs text-muted-foreground">labrary.digital/projetos</span>
              </div>
              <div className="grid grid-cols-2 divide-x md:grid-cols-4">
                {preview.map((column) => (
                  <div key={column.status} className="flex min-h-56 flex-col gap-2.5 p-3">
                    <div className="flex items-center gap-2 px-1 text-xs font-medium">
                      <StatusGlyph status={column.status} className={column.tone} />
                      {column.label}
                      <span className="ml-auto text-muted-foreground tabular-nums">{column.cards.length}</span>
                    </div>
                    {column.cards.map((title) => (
                      <div key={title} className="rounded-xl border bg-card p-3 text-left shadow-card">
                        <p className="flex items-center gap-1.5 text-xs font-medium">
                          <StatusGlyph status={column.status} className={cn("size-3", column.tone)} />
                          <span className="truncate">{title}</span>
                        </p>
                        <div className="mt-2 h-1.5 w-4/5 rounded-full bg-muted" />
                        <div className="mt-1.5 h-1.5 w-3/5 rounded-full bg-muted" />
                        <div className="mt-3 flex gap-1.5">
                          <span className="h-4 w-14 rounded-full border bg-background" />
                          <span className="h-4 w-10 rounded-full border bg-background" />
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </section>

        <section id="recursos" aria-labelledby="recursos-title" className="scroll-mt-16 px-5 py-20 md:px-10">
          <div className="mx-auto max-w-6xl">
            <p className="text-sm font-medium text-muted-foreground">Recursos</p>
            <h2 id="recursos-title" className="mt-2 max-w-2xl font-heading text-3xl font-semibold tracking-tight text-balance md:text-4xl">
              Tudo o que o laboratório precisa, do envio à vitrine.
            </h2>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map(({ icon: Icon, title, text }) => (
                <Card key={title} className="p-6">
                  <span className="grid size-10 place-items-center rounded-lg border bg-background shadow-xs/5">
                    <Icon aria-hidden="true" className="size-5 text-muted-foreground" />
                  </span>
                  <h3 className="mt-5 font-heading text-base font-semibold">{title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{text}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="como-funciona" aria-labelledby="como-funciona-title" className="scroll-mt-16 border-y bg-muted/30 px-5 py-20 md:px-10">
          <div className="mx-auto max-w-6xl">
            <p className="text-sm font-medium text-muted-foreground">Como funciona</p>
            <h2 id="como-funciona-title" className="mt-2 font-heading text-3xl font-semibold tracking-tight md:text-4xl">
              Quatro etapas, um só fluxo.
            </h2>
            <ol className="m-0 mt-10 grid list-none gap-6 p-0 md:grid-cols-4">
              {steps.map((step, index) => (
                <li key={step.title} className="relative">
                  <div className="flex items-center gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full border bg-background text-sm font-semibold tabular-nums shadow-xs/5">
                      {index + 1}
                    </span>
                    <span aria-hidden="true" className="hidden h-px flex-1 bg-border md:block" />
                  </div>
                  <h3 className="mt-4 font-heading text-base font-semibold">{step.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="perfis" aria-labelledby="perfis-title" className="scroll-mt-16 px-5 py-20 md:px-10">
          <div className="mx-auto max-w-6xl">
            <p className="text-sm font-medium text-muted-foreground">Perfis</p>
            <h2 id="perfis-title" className="mt-2 font-heading text-3xl font-semibold tracking-tight md:text-4xl">
              Cada um vê o que precisa.
            </h2>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {roles.map((role) => (
                <Card key={role.title} className="p-6">
                  <h3 className="font-heading text-lg font-semibold">{role.title}</h3>
                  <ul className="m-0 mt-4 grid list-none gap-2.5 p-0 text-sm text-muted-foreground">
                    {role.items.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-foreground/40" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="cta-title" className="px-5 pb-20 md:px-10">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 rounded-2xl bg-primary px-8 py-12 text-primary-foreground md:flex-row md:items-center md:px-12">
            <div>
              <h2 id="cta-title" className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
                Seu próximo projeto começa aqui.
              </h2>
              <p className="mt-2 text-sm text-primary-foreground/70">
                Entre com a conta da sua turma ou conheça os projetos já publicados.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a
                className={buttonVariants({ variant: "outline", size: "lg" })}
                href="/login"
              >
                Entrar
                <ArrowRight />
              </a>
              <a
                className={cn(
                  buttonVariants({ variant: "ghost", size: "lg" }),
                  "text-primary-foreground hover:bg-primary-foreground/10",
                )}
                href="/acervo"
              >
                Ver o acervo
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="overflow-hidden border-t">
        <div className="grid gap-10 px-5 pt-14 md:grid-cols-[2fr_1fr_1fr] md:px-10">
          <div className="grid content-start gap-3">
            <Brand />
            <p className="max-w-xs text-sm text-muted-foreground">
              A biblioteca digital dos projetos de laboratório.
            </p>
          </div>
          <nav aria-label="Plataforma" className="grid content-start gap-2 text-sm">
            <p className="font-medium">Plataforma</p>
            <a className={link} href="/acervo">Acervo público</a>
            <a className={link} href="/login">Entrar</a>
          </nav>
          <nav aria-label="Projeto" className="grid content-start gap-2 text-sm">
            <p className="font-medium">Projeto</p>
            <a className={link} href="https://github.com/henriquemantovan/Labrary-Digital-PCS-3643">
              Repositório no GitHub
            </a>
            <a className={link} href="#como-funciona">Como funciona</a>
          </nav>
        </div>
        <p className="mt-12 px-5 text-xs text-muted-foreground md:px-10">
          © 2026 Labrary Digital · PCS3643
        </p>
        {/* Marca em tamanho gigante, cortada pela borda inferior. */}
        <p
          aria-hidden="true"
          className="-mb-[3.5vw] mt-6 bg-linear-to-b from-foreground/85 to-foreground/5 bg-clip-text text-center font-heading text-[21vw] leading-[0.8] font-bold tracking-[-0.07em] whitespace-nowrap text-transparent select-none"
        >
          labdigital
        </p>
      </footer>
    </div>
  );
}

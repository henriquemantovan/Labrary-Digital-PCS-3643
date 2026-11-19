import type { ReactNode } from "react";
import { BookOpen, Globe, LayoutGrid, LogOut, Sigma, User as UserIcon, Users } from "lucide-react";
import type { User } from "../api";
import { Brand } from "../components/Brand";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { roleLabels } from "../labels";
import { cn } from "../lib/utils";

const navItem =
  "flex h-9 shrink-0 cursor-pointer items-center gap-2.5 rounded-full px-3.5 text-sm text-muted-foreground no-underline transition-colors hover:text-foreground [&_svg]:size-4 [&_svg]:shrink-0";
const navActive =
  "bg-card text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.06)]";

export function AppShell({
  user,
  visibleUser,
  path,
  navigate,
  busy,
  logout,
  children,
}: {
  user: User;
  visibleUser: User;
  path: string;
  navigate: (path: string) => void;
  busy: boolean;
  logout: () => Promise<void>;
  children: ReactNode;
}) {
  const staff = ["PROFESSOR", "ADMIN"].includes(visibleUser.role);
  const item = (target: string, active: boolean, label: ReactNode, icon: ReactNode) => (
    <button
      key={target}
      className={cn(navItem, active && navActive)}
      aria-current={active ? "page" : undefined}
      onClick={() => navigate(target)}
    >
      {icon}
      {label}
    </button>
  );
  return (
    <div className="min-h-dvh bg-background lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-full focus:bg-card focus:px-4 focus:py-2 focus:text-sm"
        href="#main"
      >
        Pular para o conteúdo
      </a>
      <aside className="sticky top-0 z-20 flex flex-wrap items-center gap-x-3 gap-y-2 bg-background/90 px-4 pt-3 backdrop-blur lg:h-dvh lg:flex-col lg:flex-nowrap lg:items-stretch lg:gap-6 lg:bg-transparent lg:px-5 lg:pt-6 lg:pb-5 lg:backdrop-blur-none">
        <a
          href="/projetos"
          className="no-underline lg:px-1.5"
          onClick={(event) => {
            event.preventDefault();
            navigate("/projetos");
          }}
        >
          <Brand />
        </a>
        <div className="order-last -mx-4 w-[calc(100%+2rem)] lg:order-none lg:mx-0 lg:w-auto">
          <p className="mb-2 hidden px-3.5 text-[11px] font-medium tracking-wider text-subtle-foreground lg:block">
            MEU ESPAÇO
          </p>
          <nav
            aria-label="Navegação principal"
            className="flex gap-1 overflow-x-auto px-4 pb-3 [scrollbar-width:none] lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0"
          >
            <a className={navItem} href="/acervo">
              <Globe />
              Acervo público
            </a>
            {item(
              "/projetos",
              path.startsWith("/projetos") || path === "/",
              visibleUser.role === "ALUNO" ? "Meu projeto" : "Projetos",
              <LayoutGrid />,
            )}
            {staff && item("/turmas", path === "/turmas", "Minhas turmas", <BookOpen />)}
            {user.role === "ADMIN" &&
              item("/administracao", path === "/administracao", "Administrar usuários", <Users />)}
            {staff && item("/notas", path === "/notas", "Consolidação de notas", <Sigma />)}
            {item("/perfil", path === "/perfil", "Meu perfil", <UserIcon />)}
          </nav>
        </div>
        <div className="ml-auto flex items-center gap-2 lg:mt-auto lg:ml-0 lg:flex-col lg:items-stretch lg:gap-3">
          <div className="hidden items-center gap-2.5 px-1.5 lg:flex">
            <span
              aria-hidden="true"
              className="grid size-8 shrink-0 place-items-center rounded-full border bg-card text-[11px] font-semibold"
            >
              {user.fullName
                .split(" ")
                .map((part) => part[0])
                .slice(0, 2)
                .join("")}
            </span>
            <div className="grid min-w-0 leading-tight">
              <strong className="truncate text-sm font-medium">{user.fullName}</strong>
              <span className="text-xs text-muted-foreground">{roleLabels[user.role]}</span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground lg:justify-start lg:px-3"
            disabled={busy}
            onClick={() => void logout()}
          >
            <LogOut />
            {busy ? "Saindo…" : "Sair da conta"}
          </Button>
        </div>
      </aside>
      <div className="lg:py-2 lg:pr-2">
        <div className="flex min-h-[calc(100dvh-16px)] flex-col bg-card lg:rounded-xl lg:border">
          <header className="flex items-center justify-between gap-3 border-b px-5 py-3 text-sm md:px-10">
            <span className="text-muted-foreground">
              Meu espaço <span className="mx-1.5 text-subtle-foreground">/</span>{" "}
              <strong className="font-medium text-foreground">
                {path === "/notas"
                  ? "Notas"
                  : path === "/administracao"
                    ? "Administração"
                    : path === "/perfil"
                      ? "Perfil"
                      : path === "/turmas"
                        ? "Turmas"
                        : "Projetos"}
              </strong>
            </span>
            <Badge>{roleLabels[user.role]}</Badge>
          </header>
          <main
            id="main"
            className="mx-auto w-full max-w-[1120px] flex-1 px-5 py-8 md:px-10 md:py-10"
          >
            {children}
          </main>
          <footer className="flex flex-wrap justify-between gap-2 px-5 py-5 text-xs text-subtle-foreground md:px-10">
            <span>Labrary Digital</span>
            <span>Um espaço para aprender e construir.</span>
          </footer>
        </div>
      </div>
    </div>
  );
}

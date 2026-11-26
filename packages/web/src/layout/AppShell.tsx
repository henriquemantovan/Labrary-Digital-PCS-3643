import type { ReactNode } from "react";
import { BookOpen, Globe, LayoutGrid, LogOut, Sigma, User as UserIcon, Users } from "lucide-react";
import type { User } from "../api";
import { Brand } from "../components/Brand";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { Badge } from "../components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../components/ui/breadcrumb";
import { Button } from "../components/ui/button";
import { roleLabels } from "../labels";
import { cn } from "../lib/utils";

// Itens no estilo do SidebarMenuButton do coss.
const navItem =
  "flex h-8 shrink-0 cursor-pointer items-center gap-2 rounded-lg px-2.5 text-sm font-medium text-muted-foreground no-underline outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-4 [&_svg]:shrink-0";
const navActive = "bg-accent text-foreground";

const pageNames: Record<string, string> = {
  "/notas": "Notas",
  "/administracao": "Administração",
  "/perfil": "Perfil",
  "/turmas": "Turmas",
};

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
  const initials = user.fullName
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");
  return (
    <div className="min-h-dvh bg-sidebar lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:bg-background focus:px-4 focus:py-2 focus:text-sm"
        href="#main"
      >
        Pular para o conteúdo
      </a>
      <aside className="sticky top-0 z-20 flex flex-wrap items-center gap-x-3 gap-y-2 border-b bg-sidebar/90 px-4 pt-3 backdrop-blur lg:h-dvh lg:flex-col lg:flex-nowrap lg:items-stretch lg:gap-6 lg:border-b-0 lg:bg-transparent lg:px-3 lg:pt-5 lg:pb-4 lg:backdrop-blur-none">
        <a
          href="/projetos"
          className="no-underline lg:px-2"
          onClick={(event) => {
            event.preventDefault();
            navigate("/projetos");
          }}
        >
          <Brand />
        </a>
        <div className="order-last -mx-4 w-[calc(100%+2rem)] lg:order-none lg:mx-0 lg:w-auto">
          <p className="mb-1.5 hidden px-2.5 text-xs font-medium text-muted-foreground lg:block">
            Meu espaço
          </p>
          <nav
            aria-label="Navegação principal"
            className="flex gap-1 overflow-x-auto px-4 pb-3 [scrollbar-width:none] lg:flex-col lg:gap-0.5 lg:overflow-visible lg:px-0 lg:pb-0"
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
        <div className="ml-auto flex items-center gap-2 lg:mt-auto lg:ml-0 lg:flex-col lg:items-stretch lg:gap-2">
          <div className="hidden items-center gap-2.5 rounded-lg px-2 py-1.5 lg:flex">
            <Avatar className="size-8 border bg-background">
              <AvatarFallback className="bg-background text-xs font-semibold">{initials}</AvatarFallback>
            </Avatar>
            <div className="grid min-w-0 leading-tight">
              <strong className="truncate text-sm font-medium">{user.fullName}</strong>
              <span className="text-xs text-muted-foreground">{roleLabels[user.role]}</span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground lg:justify-start"
            disabled={busy}
            onClick={() => void logout()}
          >
            <LogOut />
            {busy ? "Saindo…" : "Sair da conta"}
          </Button>
        </div>
      </aside>
      <div className="lg:py-2 lg:pr-2">
        <div className="flex min-h-[calc(100dvh-16px)] flex-col bg-background lg:rounded-2xl lg:border lg:shadow-xs/5">
          <header className="flex items-center justify-between gap-3 border-b px-5 py-3 md:px-10">
            <Breadcrumb aria-label="Trilha de navegação">
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink
                    href="/projetos"
                    onClick={(event) => {
                      event.preventDefault();
                      navigate("/projetos");
                    }}
                  >
                    Meu espaço
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage className="font-medium">
                    {pageNames[path] ?? "Projetos"}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <Badge variant="outline">{roleLabels[user.role]}</Badge>
          </header>
          <main
            id="main"
            // Sem largura máxima: as páginas ocupam o painel inteiro; textos longos
            // limitam a própria largura (PageHeader, descrições).
            className="w-full flex-1 px-5 py-8 md:px-10 md:py-10"
          >
            {children}
          </main>
          <footer className="flex flex-wrap justify-between gap-2 px-5 py-5 text-xs text-muted-foreground md:px-10">
            <span>Labrary Digital</span>
            <span>Um espaço para aprender e construir.</span>
          </footer>
        </div>
      </div>
    </div>
  );
}

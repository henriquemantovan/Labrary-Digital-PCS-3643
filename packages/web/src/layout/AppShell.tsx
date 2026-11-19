import type { ReactNode } from "react";
import type { User } from "../api";
import { Icon } from "../Icons";
import { Brand } from "../components/Brand";
import { roleLabels } from "../labels";

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
  return (
    <div
      className={`workspace${user.role === "ADMIN" ? " workspace-admin" : ""}`}
    >
      <a className="skip-link" href="#main">
        Pular para o conteúdo
      </a>
      <aside className="sidebar">
        <a
          href="/projetos"
          onClick={(event) => {
            event.preventDefault();
            navigate("/projetos");
          }}
        >
          <Brand />
        </a>
        <div className="workspace-name">
          <span className="workspace-dot" /> Espaço acadêmico{" "}
          <span className="tiny-badge">2026</span>
        </div>
        <p className="nav-label">MEU ESPAÇO</p>
        <nav aria-label="Navegação principal">
          <a className="nav-item" href="/acervo">Acervo público</a>
          <button
            className={
              path.startsWith("/projetos") || path === "/"
                ? "nav-item active"
                : "nav-item"
            }
            onClick={() => navigate("/projetos")}
          >
            <Icon name="grid" />
            {visibleUser.role === "ALUNO" ? "Meu projeto" : "Projetos"}
            <span className="nav-active-dot" />
          </button>
          {["PROFESSOR", "ADMIN"].includes(visibleUser.role) && (
            <button
              className={`nav-item ${path === "/turmas" ? "active" : ""}`}
              onClick={() => navigate("/turmas")}
            >
              <Icon name="book" />
              Minhas turmas
            </button>
          )}
          {user.role === "ADMIN" && (
            <button
              className={`nav-item ${path === "/administracao" ? "active" : ""}`}
              onClick={() => navigate("/administracao")}
            >
              <Icon name="user" />
              Administrar usuários
            </button>
          )}
          {["PROFESSOR", "ADMIN"].includes(visibleUser.role) && (
            <button className={`nav-item ${path === "/notas" ? "active" : ""}`} onClick={() => navigate("/notas")}>
              <Icon name="book" /> Consolidação de notas
            </button>
          )}
          <button
            className={`nav-item ${path === "/perfil" ? "active" : ""}`}
            onClick={() => navigate("/perfil")}
          >
            <Icon name="user" />
            Meu perfil
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="note-spark">✦</span>
            <strong>
              Ideias ganham vida
              <br />
              quando conectadas.
            </strong>
            <p>Seu laboratório de possibilidades.</p>
          </div>
          <div className="sidebar-user">
            <span className="avatar">
              {user.fullName
                .split(" ")
                .map((part) => part[0])
                .slice(0, 2)
                .join("")}
            </span>
            <div>
              <strong>{user.fullName}</strong>
              <span>{roleLabels[user.role]}</span>
            </div>
          </div>
          <button
            className="logout"
            disabled={busy}
            onClick={() => void logout()}
          >
            <Icon name="logout" size={17} />
            {busy ? "Saindo…" : "Sair da conta"}
          </button>
        </div>
      </aside>
      <div className="workspace-body">
        <header className="workspace-header">
          <span>
            Meu espaço <span className="breadcrumb">/</span>{" "}
            <strong>
              {path === "/notas" ? "Notas" : path === "/administracao"
                ? "Administração"
                : path === "/perfil"
                  ? "Perfil"
                  : path === "/turmas"
                    ? "Turmas"
                    : "Projetos"}
            </strong>
          </span>
          <span className="profile-badge">
            <span className="small-dot" />
            {roleLabels[user.role]}
          </span>
        </header>
        <main id="main" className="workspace-main">
          {children}
        </main>
        <footer className="workspace-footer">
          <span>LABRARY DIGITAL</span>
          <span>Um espaço para aprender e construir.</span>
        </footer>
      </div>
    </div>
  );
}

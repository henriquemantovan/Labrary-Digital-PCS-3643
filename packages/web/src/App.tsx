import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { Catalog } from "./Catalog";
import { httpCatalog } from "./catalogClient";
import { api, ApiError } from "./api";
import type { User } from "./api";
import { AdminUsers } from "./AdminUsers";
import { Gradebook } from "./Gradebook";
import { Brand } from "./components/Brand";
import { Loading, Notice } from "./components/Feedback";
import { roleLabels } from "./labels";
import { AppShell } from "./layout/AppShell";
import { Dashboard } from "./pages/Dashboard";
import { Login } from "./pages/Login";

const CatalogDemo = import.meta.env.DEV
  ? lazy(() => import("./CatalogDemo"))
  : null;

export function App() {
  const path = window.location.pathname;
  if (
    CatalogDemo &&
    (path === "/demo/acervo" || path.startsWith("/demo/acervo/"))
  )
    return (
      <Suspense fallback={<p role="status">Carregando demonstração…</p>}>
        <CatalogDemo />
      </Suspense>
    );
  if (path === "/acervo" || path.startsWith("/acervo/"))
    return <Catalog provider={httpCatalog} />;
  return <PrivateApp />;
}

function PrivateApp() {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [startupError, setStartupError] = useState("");
  const [message, setMessage] = useState("");
  const [path, setPath] = useState(window.location.pathname);
  const [busy, setBusy] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [viewBusy, setViewBusy] = useState(false);
  const [viewError, setViewError] = useState("");
  const navigate = useCallback((next: string) => {
    window.history.pushState(null, "", next);
    setPath(next);
  }, []);
  const expired = useCallback(() => {
    setUser(null);
    setMessage("Sua sessão terminou. Entre novamente para continuar.");
  }, []);
  const bootstrap = useCallback(async () => {
    setInitializing(true);
    setStartupError("");
    try {
      setUser(await api<User>("/auth/me"));
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 401))
        setStartupError((error as Error).message);
    } finally {
      setInitializing(false);
    }
  }, []);
  useEffect(() => {
    void bootstrap();
    const pop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, [bootstrap]);
  useEffect(() => {
    if (!user) return;
    let active = true;
    const check = () => {
      if (document.visibilityState === "visible")
        void api<User>("/auth/me")
          .then((current) => {
            if (active) setUser(current);
          })
          .catch((error) => {
            if (active && error instanceof ApiError && error.status === 401)
              expired();
          });
    };
    document.addEventListener("visibilitychange", check);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", check);
    };
  }, [user, expired]);
  async function logout() {
    setBusy(true);
    setLogoutError("");
    try {
      await api<void>("/auth/logout", { method: "POST" });
      setUser(null);
      setMessage("");
      navigate("/");
    } catch (error) {
      setLogoutError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function changeView(role: string) {
    setViewBusy(true);
    setViewError("");
    try {
      const current = await api<User>("/auth/view-role", {
        method: "POST",
        body: JSON.stringify({ role: role === "ADMIN" ? null : role }),
      });
      setUser(current);
      navigate("/projetos");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) expired();
      else setViewError((error as Error).message);
    } finally {
      setViewBusy(false);
    }
  }
  if (initializing)
    return (
      <main className="startup">
        <Brand />
        <Loading />
      </main>
    );
  if (startupError)
    return (
      <main className="startup">
        <Brand />
        <Notice>{startupError}</Notice>
        <button className="primary" onClick={() => void bootstrap()}>
          Tentar novamente
        </button>
      </main>
    );
  if (!user)
    return (
      <Login
        message={message}
        onLogin={(current) => {
          setUser(current);
          setMessage("");
          setLogoutError("");
          if (path === "/" || path === "/login") navigate("/projetos");
        }}
      />
    );
  const visibleUser: User =
    user.role === "ADMIN" && user.viewRole
      ? { ...user, role: user.viewRole }
      : user;
  return (
    <AppShell
      user={user}
      visibleUser={visibleUser}
      path={path}
      navigate={navigate}
      busy={busy}
      logout={logout}
    >
          {logoutError && <Notice>{logoutError}</Notice>}
          {user.role === "ADMIN" && (
            <section className="admin-view" aria-label="Visualização de perfis">
              <label htmlFor="view-role">Visualizar como</label>
              <select
                id="view-role"
                value={user.viewRole ?? "ADMIN"}
                disabled={viewBusy}
                onChange={(event) => void changeView(event.target.value)}
              >
                <option value="ADMIN">Administrador</option>
                <option value="ALUNO">Aluno</option>
                <option value="AVALIADOR">Avaliador</option>
                <option value="PROFESSOR">Professor</option>
              </select>
              <p>
                {user.viewRole
                  ? `Visualização de ${roleLabels[user.viewRole]}. Sua conta continua sendo Administrador; o acesso segue seus vínculos nesse perfil.`
                  : "Visão administrativa de todas as turmas e projetos."}
              </p>
            </section>
          )}
          {viewError && <Notice>{viewError}</Notice>}
          {path === "/notas" && ["PROFESSOR", "ADMIN"].includes(visibleUser.role) ? (
            <Gradebook key={`${user.id}-${user.viewRole ?? ""}`} expired={expired} />
          ) : path === "/administracao" && user.role === "ADMIN" ? (
            <AdminUsers
              expired={expired}
              onSessionChanged={(current) => {
                setUser(current);
                if (current.role !== "ADMIN") navigate("/projetos");
              }}
            />
          ) : (
            <Dashboard
              key={`${user.id}-${user.role}-${user.viewRole ?? ""}`}
              user={path === "/perfil" ? user : visibleUser}
              path={path}
              navigate={navigate}
              expired={expired}
            />
          )}
    </AppShell>
  );
}

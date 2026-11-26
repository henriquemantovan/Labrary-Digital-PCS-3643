import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { Catalog } from "./Catalog";
import { httpCatalog } from "./catalogClient";
import { api, ApiError } from "./api";
import type { User } from "./api";
import { AdminUsers } from "./AdminUsers";
import { AcademicRegistration } from "./AcademicRegistration";
import { GuestInvitations } from "./GuestInvitations";
import { Gradebook } from "./Gradebook";
import { Brand } from "./components/Brand";
import { Loading, Notice } from "./components/Feedback";
import { Button } from "./components/ui/button";
import { Label } from "./components/ui/label";
import { NativeSelect } from "./components/ui/native-select";
import { roleLabels } from "./labels";
import { AppShell } from "./layout/AppShell";
import { Dashboard } from "./pages/Dashboard";
import { Landing } from "./pages/Landing";
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
  // Página inicial pública; o login fica em /login.
  if (path === "/") return <Landing />;
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
  // Sessão já ativa ao abrir /login: segue direto para os projetos.
  useEffect(() => {
    if (user && path === "/login")
      navigate(user.requiresAcademicProfile ? "/cadastro" : "/projetos");
  }, [user, path, navigate]);
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
      navigate("/login");
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
      <main className="grid min-h-dvh place-content-center justify-items-center gap-2 bg-sidebar p-6">
        <Brand />
        <Loading />
      </main>
    );
  if (startupError)
    return (
      <main className="grid min-h-dvh place-content-center justify-items-center gap-4 bg-sidebar p-6">
        <Brand />
        <Notice>{startupError}</Notice>
        <Button onClick={() => void bootstrap()}>Tentar novamente</Button>
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
          if (current.requiresAcademicProfile) navigate("/cadastro");
          else if (path === "/" || path === "/login") navigate("/projetos");
        }}
      />
    );
  if (user.requiresAcademicProfile)
    return (
      <AcademicRegistration
        user={user}
        expired={expired}
        logout={logout}
        logoutBusy={busy}
        logoutError={logoutError}
        onSaved={(current) => {
          setUser(current);
          navigate("/projetos");
        }}
      />
    );
  // Evita piscar "Página indisponível" enquanto o efeito redireciona de /login.
  if (path === "/login") return null;
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
      <div className="mb-6 grid gap-4 empty:hidden">
        {logoutError && <Notice>{logoutError}</Notice>}
        {user.role === "ADMIN" && (
          <section
            className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border bg-muted/50 px-4 py-3"
            aria-label="Visualização de perfis"
          >
            <Label htmlFor="view-role">Visualizar como</Label>
            <NativeSelect
              id="view-role"
              className="w-auto min-w-44"
              value={user.viewRole ?? "ADMIN"}
              disabled={viewBusy}
              onChange={(event) => void changeView(event.target.value)}
            >
              <option value="ADMIN">Administrador</option>
              <option value="ALUNO">Aluno</option>
              <option value="AVALIADOR">Avaliador</option>
              <option value="PROFESSOR">Professor</option>
            </NativeSelect>
            <p className="basis-full text-xs text-muted-foreground md:basis-auto">
              {user.viewRole
                ? `Visualização de ${roleLabels[user.viewRole]}. Sua conta continua sendo Administrador; o acesso segue seus vínculos nesse perfil.`
                : "Visão administrativa de todas as turmas e projetos."}
            </p>
          </section>
        )}
        {viewError && <Notice>{viewError}</Notice>}
      </div>
      {path === "/notas" &&
      ["PROFESSOR", "ADMIN"].includes(visibleUser.role) ? (
        <Gradebook
          key={`${user.id}-${user.viewRole ?? ""}`}
          expired={expired}
        />
      ) : path === "/administracao" && user.role === "ADMIN" ? (
        <>
          <AdminUsers
            expired={expired}
            onSessionChanged={(current) => {
              setUser(current);
              if (current.role !== "ADMIN") navigate("/projetos");
            }}
          />
          <GuestInvitations expired={expired} />
        </>
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

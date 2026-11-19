import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../api";
import type { User } from "../api";
import { ArrowRight, Eye, EyeOff, Lock } from "lucide-react";
import { Brand } from "../components/Brand";
import { Notice, Spinner } from "../components/Feedback";
import { Button, buttonVariants } from "../components/ui/button";
import { Input, Label } from "../components/ui/input";

export function Login({
  onLogin,
  message,
}: {
  onLogin: (user: User) => void;
  message: string;
}) {
  const [providers, setProviders] = useState<{
    google: boolean;
    local: boolean;
  } | null>(null);
  const [providerError, setProviderError] = useState("");
  async function loadProviders() {
    setProviderError("");
    try {
      setProviders(
        await api<{ google: boolean; local: boolean }>("/auth/providers"),
      );
    } catch (error) {
      setProviderError((error as Error).message);
    }
  }
  useEffect(() => {
    void loadProviders();
  }, []);
  const authError = new URLSearchParams(window.location.search).get(
    "authError",
  );
  const googleError =
    authError === "account_conflict"
      ? "Já existe uma conta com esse e-mail. Solicite ao responsável a vinculação da conta Google."
      : authError === "inactive"
        ? "Sua conta está desativada. Contate o responsável."
        : authError
          ? "Não foi possível entrar com o Google. Tente novamente; se persistir, contate o responsável."
          : "";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      onLogin(
        await api<User>("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email: email.trim(), password }),
        }),
      );
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-[400px]">
        <div className="mb-6 flex items-center justify-between">
          <Brand />
          <a
            className={buttonVariants({ variant: "ghost", size: "sm" })}
            href="/acervo"
          >
            Explorar acervo público
          </a>
        </div>
        <section
          className="rounded-xl border bg-card p-8 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
          aria-labelledby="login-title"
        >
          <p className="text-xs font-medium tracking-wide text-subtle-foreground uppercase">
            Bem-vindo de volta
          </p>
          <h1
            id="login-title"
            className="mt-2 text-2xl leading-tight font-semibold tracking-tight"
          >
            Seu próximo projeto <br />
            começa aqui.
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Entre com sua conta para acessar seu espaço.
          </p>
          <div className="mt-6 grid gap-4">
            {(error || message || googleError) && (
              <Notice>{error || message || googleError}</Notice>
            )}
            {providerError && (
              <Notice>
                {providerError}
                <button onClick={() => void loadProviders()}>
                  Tentar novamente
                </button>
              </Notice>
            )}
            {!providers && !providerError && (
              <p role="status" className="text-sm text-muted-foreground">
                Carregando opções de acesso…
              </p>
            )}
            {providers?.google && (
              <div className="grid gap-2">
                <a
                  className={buttonVariants({
                    variant: "outline",
                    size: "lg",
                    className: "w-full",
                  })}
                  href="/api/auth/google"
                >
                  <img
                    src="/google-logo.webp"
                    alt=""
                    aria-hidden="true"
                    width={20}
                    height={20}
                  />
                  <span>Entrar com Google</span>
                </a>
                <p className="text-center text-xs text-muted-foreground">
                  Use sua conta Google para acessar seu espaço.
                </p>
              </div>
            )}
            {providers?.local && (
              <form
                onSubmit={submit}
                aria-label="Entrar na conta"
                className="grid gap-4"
              >
                <div className="grid gap-1.5">
                  <Label htmlFor="email">E-mail institucional</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="username"
                    placeholder="seu.nome@instituicao.br"
                    required
                    maxLength={254}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    disabled={busy}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="password">Senha</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={visible ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="Digite sua senha"
                      required
                      maxLength={256}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      disabled={busy}
                      className="pr-11"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-0.5 right-0.5 text-muted-foreground"
                      aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
                      aria-pressed={visible}
                      onClick={() => setVisible(!visible)}
                    >
                      {visible ? <EyeOff /> : <Eye />}
                    </Button>
                  </div>
                </div>
                <Button
                  type="submit"
                  size="lg"
                  className="mt-1 w-full"
                  disabled={busy}
                >
                  <span>{busy ? "Entrando…" : "Entrar no meu espaço"}</span>
                  {busy ? <Spinner /> : <ArrowRight />}
                </Button>
              </form>
            )}
          </div>
        </section>
        <div className="mt-6 grid gap-3 text-center text-xs text-muted-foreground">
          <p className="[&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-2">
            Precisa de acesso ou esqueceu sua senha?
            <br />
            {providers?.google ? (
              <span>
                Para recuperar a senha, acesse o{" "}
                <a href="https://accounts.google.com/signin/recovery">Google</a>
                . Para vínculos de turma, fale com o professor.
              </span>
            ) : (
              <span>Entre em contato com o professor da sua turma.</span>
            )}
          </p>
          <p className="inline-flex items-center justify-center gap-1.5 text-subtle-foreground">
            <Lock className="size-3.5" />
            Acesso de acordo com o seu perfil acadêmico.
          </p>
        </div>
      </div>
    </main>
  );
}

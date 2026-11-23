import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../api";
import type { User } from "../api";
import { ArrowRight, Eye, EyeOff, Lock } from "lucide-react";
import { Brand } from "../components/Brand";
import { Notice } from "../components/Feedback";
import { Button, buttonVariants } from "../components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardPanel,
  CardTitle,
} from "../components/ui/card";
import { Field, FieldLabel } from "../components/ui/field";
import { Input } from "../components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "../components/ui/input-group";
import { Spinner } from "../components/ui/spinner";

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
    <main className="grid min-h-dvh place-items-center bg-sidebar px-4 py-10">
      <div className="w-full max-w-[400px]">
        <div className="mb-6 flex items-center justify-between">
          <a href="/" className="no-underline" aria-label="labrary digital — início">
            <Brand />
          </a>
          <a
            className={buttonVariants({ variant: "ghost", size: "sm" })}
            href="/acervo"
          >
            Explorar acervo público
          </a>
        </div>
        <Card render={<section aria-labelledby="login-title" />}>
          <CardHeader>
            <p className="text-xs font-medium text-muted-foreground">
              Bem-vindo de volta
            </p>
            <CardTitle
              render={<h1 id="login-title" />}
              className="text-2xl leading-tight tracking-tight"
            >
              Seu próximo projeto <br />
              começa aqui.
            </CardTitle>
            <CardDescription>
              Entre com sua conta para acessar seu espaço.
            </CardDescription>
          </CardHeader>
          <CardPanel className="grid gap-4">
            {(error || message || googleError) && (
              <Notice>{error || message || googleError}</Notice>
            )}
            {providerError && (
              <Notice>
                {providerError}
                <Button variant="outline" size="xs" onClick={() => void loadProviders()}>
                  Tentar novamente
                </Button>
              </Notice>
            )}
            {!providers && !providerError && (
              <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner aria-hidden="true" aria-label={undefined} role="presentation" className="size-4" />
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
                <Field>
                  <FieldLabel>E-mail institucional</FieldLabel>
                  <Input
                    type="email"
                    autoComplete="username"
                    placeholder="seu.nome@instituicao.br"
                    required
                    maxLength={254}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    disabled={busy}
                  />
                </Field>
                <Field>
                  <FieldLabel>Senha</FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      type={visible ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="Digite sua senha"
                      required
                      maxLength={256}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      disabled={busy}
                    />
                    <InputGroupAddon align="inline-end">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
                        aria-pressed={visible}
                        onClick={() => setVisible(!visible)}
                      >
                        {visible ? <EyeOff /> : <Eye />}
                      </Button>
                    </InputGroupAddon>
                  </InputGroup>
                </Field>
                <Button
                  type="submit"
                  size="lg"
                  className="mt-1 w-full"
                  disabled={busy}
                >
                  <span>{busy ? "Entrando…" : "Entrar no meu espaço"}</span>
                  {busy ? (
                    <Spinner aria-hidden="true" aria-label={undefined} role="presentation" />
                  ) : (
                    <ArrowRight />
                  )}
                </Button>
              </form>
            )}
          </CardPanel>
        </Card>
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
          <p className="inline-flex items-center justify-center gap-1.5">
            <Lock className="size-3.5" />
            Acesso de acordo com o seu perfil acadêmico.
          </p>
        </div>
      </div>
    </main>
  );
}

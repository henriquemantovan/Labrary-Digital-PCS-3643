import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../api";
import type { User } from "../api";
import { Icon } from "../Icons";
import { Brand } from "../components/Brand";
import { Notice } from "../components/Feedback";

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
    <main className="login-layout">
      <section className="login-story" aria-labelledby="story-title">
        <Brand />
        <div className="story-copy">
          <p className="eyebrow">
            <span className="live-dot" /> UM ESPAÇO PARA CONSTRUIR
          </p>
          <h1 id="story-title">
            Grandes ideias.
            <br />
            Conexões <em>reais.</em>
          </h1>
          <p>
            Do primeiro circuito à última entrega.
            <br />O ponto de encontro dos seus projetos de sistemas digitais.
          </p>
        </div>
        <div className="circuit-art" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="orbit orbit-three" />
          <div className="circuit-line line-one" />
          <div className="circuit-line line-two" />
          <span className="art-node node-one">01</span>
          <span className="art-node node-two">10</span>
          <span className="art-label label-one">ideia</span>
          <span className="art-label label-two">conexão</span>
          <div className="chip">
            <span className="chip-pins" />
            <Icon name="book" size={60} />
            <span className="chip-caption">LABRARY / DIGITAL</span>
          </div>
          <span className="orbit-dot dot-one" />
          <span className="orbit-dot dot-two" />
        </div>
        <div className="story-footer">
          <span>Aprender. Criar. Compartilhar.</span>
          <span>PCS3643 ↗</span>
        </div>
      </section>
      <section className="login-form-panel" aria-labelledby="login-title">
        <div className="login-top">
          <span className="small-dot" /> AMBIENTE ACADÊMICO
        </div>
        <div className="login-form-wrap">
          <span className="login-symbol">
            <Icon name="lock" size={24} />
          </span>
          <p className="eyebrow">BEM-VINDO DE VOLTA</p>
          <h2 id="login-title">
            Seu próximo projeto <br />
            começa aqui.
          </h2>
          <a href="/acervo">Explorar acervo público</a>
          <p className="muted login-description">
            Entre com sua conta para acessar seu espaço.
          </p>
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
            <p role="status">Carregando opções de acesso…</p>
          )}
          {providers?.google && (
            <p>
              <a
                className="primary login-submit google-login"
                href="/api/auth/google"
              >
                <img
                  src="/google-logo.webp"
                  alt=""
                  aria-hidden="true"
                  width={28}
                  height={28}
                />
                <span>Entrar com Google</span>
              </a>
            </p>
          )}
          {providers?.google && (
            <p className="muted">
              Use sua conta Google para acessar seu espaço.
            </p>
          )}
          {providers?.local && (
            <form onSubmit={submit} aria-label="Entrar na conta">
              <label htmlFor="email">E-mail institucional</label>
              <input
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
              <label htmlFor="password">Senha</label>
              <div className="password-field">
                <input
                  id="password"
                  type={visible ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Digite sua senha"
                  required
                  maxLength={256}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={busy}
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
                  aria-pressed={visible}
                  onClick={() => setVisible(!visible)}
                >
                  <Icon name={visible ? "eyeOff" : "eye"} />
                </button>
              </div>
              <button
                className="primary login-submit"
                disabled={busy}
                type="submit"
              >
                <span>{busy ? "Entrando…" : "Entrar no meu espaço"}</span>
                {busy ? <span className="spinner" /> : <Icon name="arrow" />}
              </button>
            </form>
          )}
          <p className="account-help">
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
          <div className="login-security">
            <Icon name="lock" size={15} />
            <span>Acesso de acordo com o seu perfil acadêmico.</span>
          </div>
        </div>
        <footer className="login-footer">
          Labrary Digital <span>Projetos que conectam.</span>
        </footer>
      </section>
    </main>
  );
}

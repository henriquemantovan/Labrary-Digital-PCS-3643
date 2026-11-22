import { useState, type FormEvent } from "react";
import { api, ApiError, type User } from "./api";

export function AcademicRegistration({
  user,
  onSaved,
  expired,
  logout,
  logoutError,
  logoutBusy,
}: {
  user: User;
  onSaved: (user: User) => void;
  expired: () => void;
  logout: () => Promise<void>;
  logoutError: string;
  logoutBusy: boolean;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const currentYear = new Date().getUTCFullYear();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      onSaved(
        await api<User>("/auth/profile", {
          method: "POST",
          body: JSON.stringify({
            fullName: data.get("fullName"),
            uspNumber: data.get("uspNumber"),
            entryYear: Number(data.get("entryYear")),
          }),
        }),
      );
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) expired();
      else setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="academic-registration">
      <section className="create-panel">
        <p className="eyebrow">CADASTRO ACADÊMICO</p>
        <h1>Complete seu cadastro</h1>
        <p>
          Seu acesso Google foi confirmado com {user.email}. Confirme seu nome
          completo e informe seus dados acadêmicos para continuar.
        </p>
        <p>O preenchimento não atribui uma turma ou grupo automaticamente.</p>
        {(error || logoutError) && <p role="alert">{error || logoutError}</p>}
        <form onSubmit={(event) => void submit(event)}>
          <fieldset disabled={busy || logoutBusy}>
            <label>
              Nome completo
              <input
                name="fullName"
                autoComplete="name"
                defaultValue={user.fullName}
                required
                minLength={3}
                maxLength={160}
              />
            </label>
            <label>
              NUSP
              <input
                name="uspNumber"
                inputMode="numeric"
                pattern="[0-9]+"
                maxLength={32}
                defaultValue={user.uspNumber ?? ""}
                required
              />
            </label>
            <label>
              Ano de ingresso
              <input
                name="entryYear"
                type="number"
                min={1900}
                max={currentYear}
                step={1}
                defaultValue={user.entryYear ?? ""}
                required
              />
            </label>
            <button className="primary" type="submit">
              {busy ? "Salvando cadastro…" : "Salvar e continuar"}
            </button>
          </fieldset>
        </form>
        <button
          className="secondary"
          disabled={busy || logoutBusy}
          onClick={() => void logout()}
        >
          Sair da conta
        </button>
      </section>
    </main>
  );
}

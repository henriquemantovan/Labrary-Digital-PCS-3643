import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { panelClass } from "./components/Panel";
import { noticeClass } from "./components/Feedback";
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
    <main className="grid min-h-dvh place-items-center bg-sidebar px-4 py-8">
      <section className={`${panelClass} w-full max-w-xl`}>
        <p className="text-xs font-semibold tracking-widest text-muted-foreground">
          CADASTRO ACADÊMICO
        </p>
        <h1 className="font-heading text-2xl font-semibold">
          Complete seu cadastro
        </h1>
        <p>
          Seu acesso Google foi confirmado com {user.email}. Confirme seu nome
          completo e informe seus dados acadêmicos para continuar.
        </p>
        <p>O preenchimento não atribui uma turma ou grupo automaticamente.</p>
        {(error || logoutError) && (
          <p className={noticeClass} role="alert">
            {error || logoutError}
          </p>
        )}
        <form className="my-3" onSubmit={(event) => void submit(event)}>
          <fieldset
            className="grid min-w-0 gap-4"
            disabled={busy || logoutBusy}
          >
            <label className="grid min-w-0 gap-2 text-sm font-medium">
              Nome completo
              <Input
                name="fullName"
                autoComplete="name"
                defaultValue={user.fullName}
                required
                minLength={3}
                maxLength={160}
              />
            </label>
            <label className="grid min-w-0 gap-2 text-sm font-medium">
              NUSP
              <Input
                name="uspNumber"
                inputMode="numeric"
                pattern="[0-9]+"
                maxLength={32}
                defaultValue={user.uspNumber ?? ""}
                required
              />
            </label>
            <label className="grid min-w-0 gap-2 text-sm font-medium">
              Ano de ingresso
              <Input
                name="entryYear"
                type="number"
                min={1900}
                max={currentYear}
                step={1}
                defaultValue={user.entryYear ?? ""}
                required
              />
            </label>
            <Button className="w-full" type="submit">
              {busy ? "Salvando cadastro…" : "Salvar e continuar"}
            </Button>
          </fieldset>
        </form>
        <Button
          variant="outline"
          disabled={busy || logoutBusy}
          onClick={() => void logout()}
        >
          Sair da conta
        </Button>
      </section>
    </main>
  );
}

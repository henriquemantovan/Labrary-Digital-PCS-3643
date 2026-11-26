import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { panelClass } from "./components/Panel";
import { noticeClass } from "./components/Feedback";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "./api";
import type { GuestInvitation } from "../../api/src/models/academicAccess";

export function GuestInvitations({ expired }: { expired: () => void }) {
  const [items, setItems] = useState<GuestInvitation[] | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [confirmation, setConfirmation] = useState<GuestInvitation | null>(
    null,
  );
  const fail = useCallback(
    (failure: unknown) => {
      if (failure instanceof ApiError && failure.status === 401) expired();
      else setError((failure as Error).message);
    },
    [expired],
  );
  const load = useCallback(async () => {
    setError("");
    try {
      setItems(await api<GuestInvitation[]>("/admin/guests"));
    } catch (failure) {
      fail(failure);
    }
  }, [fail]);
  useEffect(() => {
    void load();
  }, [load]);
  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const item = await api<GuestInvitation>("/admin/guests", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setItems((previous) => [
        ...(previous ?? []).filter((old) => old.id !== item.id),
        item,
      ]);
      setEmail("");
      setSuccess(`Acesso de convidado autorizado para ${item.email}.`);
    } catch (failure) {
      fail(failure);
    } finally {
      setBusy(false);
    }
  }
  async function revoke() {
    if (!confirmation) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await api(`/admin/guests/${confirmation.id}`, { method: "DELETE" });
      await load();
      setConfirmation(null);
      setSuccess("Acesso de convidado revogado.");
    } catch (failure) {
      fail(failure);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={`${panelClass} mt-6`} aria-label="Convidados externos">
      <h2 className="font-heading text-lg font-semibold">
        Convidados externos
      </h2>
      <p>
        Autorize o e-mail Google do convidado antes do primeiro acesso. O
        convite dispensa o domínio USP e os dados de aluno; o perfil e os
        vínculos são definidos separadamente.
      </p>
      {error && (
        <div className={noticeClass} role="alert">
          {error}{" "}
          <Button variant="outline" disabled={busy} onClick={() => void load()}>
            Recarregar convidados
          </Button>
        </div>
      )}
      {success && (
        <p className="text-sm text-success-foreground" role="status">
          {success}
        </p>
      )}
      <form className="my-3" onSubmit={(event) => void invite(event)}>
        <fieldset className="grid min-w-0 gap-4" disabled={busy}>
          <label className="grid min-w-0 gap-2 text-sm font-medium">
            E-mail Google do convidado
            <Input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              maxLength={254}
              required
            />
          </label>
          <Button type="submit">Autorizar convidado</Button>
        </fieldset>
      </form>
      {items === null ? (
        !error && <p role="status">Carregando convidados…</p>
      ) : !items.length ? (
        <p>Nenhum convidado cadastrado.</p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {items.map((item) => (
            <li
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm [overflow-wrap:anywhere]"
              key={item.id}
            >
              <span>
                {item.email} · {item.revokedAt ? "Revogado" : "Autorizado"}
              </span>
              {!item.revokedAt && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => setConfirmation(item)}
                  aria-label={`Revogar acesso de ${item.email}`}
                >
                  Revogar acesso
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {confirmation && (
        <div
          className={noticeClass}
          role="group"
          aria-label="Confirmar revogação de convidado"
        >
          <p>
            Revogar o acesso de {confirmation.email}? As próximas requisições e
            novos logins serão bloqueados.
          </p>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => setConfirmation(null)}
          >
            Cancelar revogação
          </Button>
          <Button type="submit" disabled={busy} onClick={() => void revoke()}>
            Confirmar revogação
          </Button>
        </div>
      )}
    </section>
  );
}

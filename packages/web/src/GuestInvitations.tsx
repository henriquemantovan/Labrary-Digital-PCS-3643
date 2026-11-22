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
    <section
      className="create-panel guest-invitations"
      aria-label="Convidados externos"
    >
      <h2>Convidados externos</h2>
      <p>
        Autorize o e-mail Google do convidado antes do primeiro acesso. O
        convite dispensa o domínio USP e os dados de aluno; o perfil e os
        vínculos são definidos separadamente.
      </p>
      {error && (
        <div role="alert">
          {error}{" "}
          <button
            className="secondary"
            disabled={busy}
            onClick={() => void load()}
          >
            Recarregar convidados
          </button>
        </div>
      )}
      {success && <p role="status">{success}</p>}
      <form onSubmit={(event) => void invite(event)}>
        <fieldset disabled={busy}>
          <label>
            E-mail Google do convidado
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              maxLength={254}
              required
            />
          </label>
          <button className="primary">Autorizar convidado</button>
        </fieldset>
      </form>
      {items === null ? (
        !error && <p role="status">Carregando convidados…</p>
      ) : !items.length ? (
        <p>Nenhum convidado cadastrado.</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <span>
                {item.email} · {item.revokedAt ? "Revogado" : "Autorizado"}
              </span>
              {!item.revokedAt && (
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => setConfirmation(item)}
                  aria-label={`Revogar acesso de ${item.email}`}
                >
                  Revogar acesso
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {confirmation && (
        <div
          className="notice"
          role="group"
          aria-label="Confirmar revogação de convidado"
        >
          <p>
            Revogar o acesso de {confirmation.email}? As próximas requisições e
            novos logins serão bloqueados.
          </p>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => setConfirmation(null)}
          >
            Cancelar revogação
          </button>
          <button
            className="primary"
            disabled={busy}
            onClick={() => void revoke()}
          >
            Confirmar revogação
          </button>
        </div>
      )}
    </section>
  );
}

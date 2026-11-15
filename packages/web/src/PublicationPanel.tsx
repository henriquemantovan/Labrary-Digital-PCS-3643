import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api, ApiError } from "./api";
import type { PublicationManagement } from "../../api/src/models/publicationDecision";
const labels = {
  FINALIZADO: "Finalizado — acesso privado",
  PUBLICADO: "Publicado no acervo",
  RETIRADO: "Publicação retirada",
  EM_AVALIACAO: "Em avaliação",
  PREPARACAO: "Em preparação",
  AJUSTES: "Em ajustes",
};
export function PublicationPanel({
  projectId,
  expired,
  onChanged,
}: {
  projectId: number;
  expired: () => void;
  onChanged: () => void;
}) {
  const [data, setData] = useState<PublicationManagement | null>(null);
  const [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const [attempt, setAttempt] = useState(0),
    [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false),
    [withdrawConfirmed, setWithdrawConfirmed] = useState(false);
  const fail = useCallback(
    (failure: unknown) => {
      if (failure instanceof ApiError && failure.status === 401) expired();
      else setError((failure as Error).message);
    },
    [expired],
  );
  useEffect(() => {
    let active = true;
    setData(null);
    setError("");
    void api<PublicationManagement>(`/projects/${projectId}/publication`)
      .then((value) => {
        if (active) setData(value);
      })
      .catch((failure) => {
        if (active) fail(failure);
      });
    return () => {
      active = false;
    };
  }, [projectId, attempt, fail]);
  async function action(
    event: FormEvent<HTMLFormElement>,
    kind: "finalize" | "publish" | "withdraw",
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const path = `/projects/${projectId}/${kind === "finalize" ? "finalization" : "publication"}`;
      const options: RequestInit =
        kind === "withdraw"
          ? { method: "DELETE" }
          : {
              method: "POST",
              body: JSON.stringify(
                kind === "finalize"
                  ? { submissionId: data!.submissionId }
                  : {
                      submissionId: data!.submissionId,
                      materialVersionIds: form.getAll("versions").map(Number),
                      groupAuthorization: {
                        confirmed: form.get("authorization") === "on",
                        reference: form.get("reference"),
                      },
                    },
              ),
            };
      if (kind === "publish" && !form.getAll("versions").length) {
        setError("Selecione ao menos um material autorizado para divulgação.");
        return;
      }
      await api(path, options);
      const current = await api<PublicationManagement>(
        `/projects/${projectId}/publication`,
      );
      setData(current);
      setConfirmed(false);
      setWithdrawConfirmed(false);
      onChanged();
      setSuccess(
        kind === "finalize"
          ? "Projeto finalizado. O conteúdo continua privado."
          : kind === "publish"
            ? "Projeto publicado com os materiais autorizados."
            : "Publicação retirada. O conteúdo privado foi preservado.",
      );
    } catch (failure) {
      fail(failure);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="create-panel publication-panel"
      aria-label="Finalização e publicação"
    >
      <h2>Finalização e publicação</h2>
      <p>
        Finalize a rodada avaliada e registre a autorização do grupo antes de
        divulgar seus materiais.
      </p>
      {error && (
        <>
          <p role="alert">{error}</p>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => setAttempt((value) => value + 1)}
          >
            Recarregar publicação
          </button>
        </>
      )}
      {success && <p role="status">{success}</p>}
      {!data && !error && <p role="status">Carregando publicação…</p>}
      {data && (
        <>
          <p>
            <strong>
              {labels[data.status as keyof typeof labels] ?? data.status}
            </strong>
          </p>
          {data.reason && <p>{data.reason}</p>}
          {!["FINALIZADO", "PUBLICADO", "RETIRADO"].includes(data.status) && (
            <form onSubmit={(event) => void action(event, "finalize")}>
              <fieldset disabled={busy || !data.canFinalize}>
                <label className="publication-check">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(event) => setConfirmed(event.target.checked)}
                  />
                  Confirmo a finalização desta rodada.
                </label>
                <button className="primary" disabled={!confirmed}>
                  Finalizar projeto
                </button>
              </fieldset>
            </form>
          )}
          {["FINALIZADO", "RETIRADO"].includes(data.status) && (
            <form onSubmit={(event) => void action(event, "publish")}>
              <fieldset disabled={busy || !data.canPublish}>
                <legend>Materiais autorizados para o acervo</legend>
                {data.materials.map((material) => (
                  <label className="publication-check" key={material.versionId}>
                    <input
                      type="checkbox"
                      name="versions"
                      value={material.versionId}
                    />
                    {material.title} · v{material.versionNumber}
                  </label>
                ))}
                <label className="publication-check">
                  <input type="checkbox" name="authorization" required />O grupo
                  autorizou a divulgação dos materiais selecionados.
                </label>
                <label>
                  Registro da autorização do grupo
                  <textarea
                    name="reference"
                    required
                    minLength={5}
                    maxLength={1000}
                    rows={2}
                    placeholder="Referência da ata, declaração ou autorização recebida"
                  />
                </label>
                <p>Notas, rubrica e mensagens permanecem privadas.</p>
                <button className="primary">Publicar no acervo</button>
              </fieldset>
            </form>
          )}
          {data.status === "PUBLICADO" && (
            <>
              <p>
                <a href={`/acervo/${projectId}`}>Abrir projeto no acervo</a>
              </p>
              <form onSubmit={(event) => void action(event, "withdraw")}>
                <fieldset disabled={busy}>
                  <label className="publication-check">
                    <input
                      type="checkbox"
                      checked={withdrawConfirmed}
                      onChange={(event) =>
                        setWithdrawConfirmed(event.target.checked)
                      }
                    />
                    Confirmo a retirada do acervo.
                  </label>
                  <button className="secondary" disabled={!withdrawConfirmed}>
                    Retirar publicação
                  </button>
                </fieldset>
              </form>
            </>
          )}
          <details>
            <summary>Histórico de publicação ({data.history.length})</summary>
            {!data.history.length ? (
              <p>Nenhuma decisão registrada.</p>
            ) : (
              <ol>
                {data.history.map((event) => (
                  <li key={event.id}>
                    {labels[event.action]} · Conta {event.actorId} ·{" "}
                    {new Date(event.createdAt).toLocaleString("pt-BR")}
                    {event.authorizationReference && (
                      <p>Autorização: {event.authorizationReference}</p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </details>
        </>
      )}
    </section>
  );
}

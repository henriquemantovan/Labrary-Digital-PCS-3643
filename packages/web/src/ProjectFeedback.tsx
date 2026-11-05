import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { api, ApiError } from "./api";
import type { Material, ProjectMessage } from "./api";

export function ProjectFeedback({
  projectId,
  materials,
  expired,
}: {
  projectId: number;
  materials: Material[];
  expired: () => void;
}) {
  const [messages, setMessages] = useState<ProjectMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [sendError, setSendError] = useState("");
  const [body, setBody] = useState("");
  const [version, setVersion] = useState("");
  const [blocked, setBlocked] = useState(false);
  const [success, setSuccess] = useState("");
  const attempt = useRef<{ payload: string; id: string } | null>(null);
  const endpoint = `/projects/${projectId}/messages`;
  const handleAccessError = useCallback(
    (error: unknown) => {
      if (error instanceof ApiError && error.status === 401) expired();
      if (error instanceof ApiError && error.status === 404) {
        setMessages([]);
        setBlocked(true);
      }
    },
    [expired],
  );
  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      setMessages(await api<ProjectMessage[]>(endpoint));
      setBlocked(false);
    } catch (error) {
      handleAccessError(error);
      setLoadError((error as Error).message);
    } finally {
      setLoading(false);
    }
  }, [endpoint, handleAccessError]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (sending || !body.trim()) return;
    const payload = JSON.stringify({
      body: body.trim(),
      materialVersionId: version ? Number(version) : null,
    });
    if (attempt.current?.payload !== payload)
      attempt.current = { payload, id: crypto.randomUUID() };
    setSending(true);
    setSendError("");
    setSuccess("");
    try {
      const message = await api<ProjectMessage>(endpoint, {
        method: "POST",
        body: JSON.stringify({
          ...JSON.parse(payload),
          clientMessageId: attempt.current.id,
        }),
      });
      setMessages((items) =>
        [...items.filter((item) => item.id !== message.id), message].sort(
          (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id,
        ),
      );
      setBody("");
      setVersion("");
      attempt.current = null;
      setSuccess("Mensagem enviada.");
    } catch (error) {
      handleAccessError(error);
      setSendError((error as Error).message);
    } finally {
      setSending(false);
    }
  }
  return (
    <section
      className="detail-section feedback"
      aria-labelledby="feedback-title"
    >
      <div className="section-heading">
        <h2 id="feedback-title">Feedback do projeto</h2>
        <button
          className="secondary"
          disabled={loading || sending}
          onClick={() => void refresh()}
        >
          Atualizar conversa
        </button>
      </div>
      <p className="muted">
        Conversa privada do grupo e da equipe acadêmica autorizada. Atualize
        para consultar novas mensagens.
      </p>
      {loadError && <p role="alert">{loadError}</p>}
      {loading && <p role="status">Carregando conversa…</p>}
      {!loading && !loadError && !messages.length && (
        <p>Nenhuma mensagem ainda. Comece a conversa.</p>
      )}
      <ol className="feedback-messages" aria-label="Mensagens do projeto">
        {messages.map((message) => (
          <li key={message.id}>
            <div className="feedback-meta">
              <strong>{message.author.fullName}</strong>
              <time dateTime={message.createdAt}>
                {new Date(message.createdAt).toLocaleString("pt-BR")}
              </time>
            </div>
            <p className="muted">
              {message.materialVersion
                ? `${message.materialVersion.title} · v${message.materialVersion.versionNumber}`
                : "Contexto geral do projeto"}
            </p>
            <p className="feedback-body">{message.body}</p>
          </li>
        ))}
      </ol>
      {!blocked && (
        <form onSubmit={submit}>
          <fieldset disabled={sending || loading || !!loadError}>
            <div className="feedback-field">
              <label htmlFor={`feedback-context-${projectId}`}>
                Contexto da mensagem
              </label>
              <select
                id={`feedback-context-${projectId}`}
                value={version}
                onChange={(event) => setVersion(event.target.value)}
              >
                <option value="">Projeto em geral</option>
                {materials.flatMap((material) =>
                  material.versions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {material.title} · v{item.versionNumber}
                    </option>
                  )),
                )}
              </select>
            </div>
            <div className="feedback-field">
              <label htmlFor={`feedback-message-${projectId}`}>Mensagem</label>
              <textarea
                id={`feedback-message-${projectId}`}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                required
                maxLength={5000}
                rows={4}
              />
            </div>
            <p className="muted">
              Até 5.000 caracteres. Mensagens são exibidas como texto.
            </p>
            <button
              className="primary"
              type="submit"
              disabled={sending || loading || !!loadError || !body.trim()}
            >
              {sending ? "Enviando…" : "Enviar mensagem"}
            </button>
          </fieldset>
        </form>
      )}
      {sendError && (
        <p role="alert">
          {sendError} Seu texto foi mantido para tentar novamente.
        </p>
      )}
      {success && <p role="status">{success}</p>}
    </section>
  );
}

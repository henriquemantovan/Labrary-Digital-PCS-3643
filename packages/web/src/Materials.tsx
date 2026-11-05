import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { ApiError, uploadFile } from "./api";
import type { Material, MaterialRule, MaterialRules } from "./api";
import { Icon } from "./Icons";

const numberFormat = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 1,
});
export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${numberFormat.format(bytes / 1024)} KB`;
  return `${numberFormat.format(bytes / (1024 * 1024))} MB`;
}
const formatDate = (value: string) =>
  new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
const formatsText = (rule: MaterialRule) =>
  `${rule.formats.map((format) => format.label).join(", ")} · até ${formatBytes(rule.maxSizeBytes)}`;

/** Mesmas regras do servidor, para avisar antes de transferir o arquivo. */
export function validateFile(rule: MaterialRule, file: File) {
  const extension = /\.[^.]+$/.exec(file.name)?.[0].toLowerCase() ?? "";
  if (!file.size) return "O arquivo selecionado está vazio.";
  if (file.size > rule.maxSizeBytes)
    return `O arquivo excede o limite de ${formatBytes(rule.maxSizeBytes)}. Escolha outro arquivo.`;
  if (!rule.formats.some((format) => format.extensions.includes(extension)))
    return `Formato não aceito. Envie ${rule.formats.map((format) => format.label).join(", ")}.`;
  return "";
}

interface UploadTarget {
  materialId?: number;
  title?: string;
}

function useMaterialUpload(
  projectId: number,
  rule: MaterialRule,
  onSaved: (material: Material) => void,
  expired: () => void,
) {
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [failed, setFailed] = useState<{
    file: File;
    target: UploadTarget;
  } | null>(null);
  const abort = useRef<() => void>(undefined);
  useEffect(() => () => abort.current?.(), []);

  async function send(file: File, target: UploadTarget = {}) {
    setError("");
    setFailed(null);
    const invalid = validateFile(rule, file);
    if (invalid) {
      setError(invalid);
      return;
    }
    const form = new FormData();
    if (!target.materialId) {
      // O tipo vem antes do arquivo: o servidor usa-o para aplicar o limite.
      form.append("kind", rule.kind);
      if (target.title) form.append("title", target.title);
    }
    form.append("file", file);
    const path = target.materialId
      ? `/projects/${projectId}/materials/${target.materialId}/versions`
      : `/projects/${projectId}/materials`;
    const request = uploadFile<Material>(path, form, setProgress);
    abort.current = request.abort;
    setProgress(0);
    try {
      onSaved(await request.promise);
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) {
        expired();
        return;
      }
      setError((failure as Error).message);
      setFailed({ file, target });
    } finally {
      abort.current = undefined;
      setProgress(null);
    }
  }
  return {
    send,
    progress,
    error,
    fail(message: string) {
      setFailed(null);
      setError(message);
    },
    cancel: () => abort.current?.(),
    retry: failed ? () => send(failed.file, failed.target) : undefined,
  };
}

type Upload = ReturnType<typeof useMaterialUpload>;

function UploadFeedback({ upload, label }: { upload: Upload; label: string }) {
  return (
    <>
      {upload.progress !== null && (
        <div className="upload-progress">
          <progress
            max={100}
            value={upload.progress}
            aria-label={`Enviando ${label}`}
          />
          <span aria-live="polite">{upload.progress}%</span>
          <button className="text-button" type="button" onClick={upload.cancel}>
            Cancelar
          </button>
        </div>
      )}
      {upload.error && (
        <div className="notice upload-error" role="alert">
          <span>{upload.error}</span>
          {upload.retry && (
            <button
              className="text-button"
              type="button"
              onClick={() => void upload.retry?.()}
            >
              Tentar novamente
            </button>
          )}
        </div>
      )}
    </>
  );
}

function FileButton({
  rule,
  label,
  text,
  primary,
  disabled,
  onFile,
}: {
  rule: MaterialRule;
  label: string;
  text: string;
  primary?: boolean;
  disabled: boolean;
  onFile: (file: File) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        className={`${primary ? "primary" : "secondary"} compact`}
        disabled={disabled}
        onClick={() => input.current?.click()}
      >
        {text}
      </button>
      <input
        ref={input}
        type="file"
        className="visually-hidden"
        tabIndex={-1}
        aria-label={label}
        accept={rule.formats
          .flatMap((format) => [...format.extensions, format.mimeType])
          .join(",")}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onFile(file);
        }}
      />
    </>
  );
}

function MaterialCard({
  projectId,
  rule,
  material,
  canUpload,
  onSaved,
  expired,
}: {
  projectId: number;
  rule: MaterialRule;
  material?: Material;
  canUpload: boolean;
  onSaved: (material: Material) => void;
  expired: () => void;
}) {
  const upload = useMaterialUpload(projectId, rule, onSaved, expired);
  const [history, setHistory] = useState(false);
  const title = material?.title ?? rule.defaultTitle;
  const current = material?.currentVersion;
  const author = (version: Material["currentVersion"]) =>
    version.uploadedBy.fullName ?? "Autor removido";
  return (
    <li className={`material-card${current ? " is-sent" : ""}`}>
      <span className="material-icon">
        <Icon name={current ? "check" : "folder"} size={19} />
      </span>
      <div className="material-info">
        <strong>{title}</strong>
        <span>{formatsText(rule)}</span>
        {current ? (
          <span className="material-state">
            Enviado · versão {current.versionNumber} · {author(current)} ·{" "}
            {formatDate(current.uploadedAt)}
          </span>
        ) : (
          <span className="material-state pending">
            {rule.required ? "Pendente" : "Opcional"}
          </span>
        )}
        {current && (
          <span className="material-file">
            {current.originalFilename} · {formatBytes(current.sizeBytes)}
          </span>
        )}
      </div>
      <div className="material-actions">
        {current && (
          <a className="secondary compact" href={current.downloadUrl} download>
            Baixar
          </a>
        )}
        {canUpload && (
          <FileButton
            rule={rule}
            label={`Arquivo para ${title}`}
            text={current ? "Substituir" : "Enviar arquivo"}
            primary={!current}
            disabled={upload.progress !== null}
            onFile={(file) =>
              void upload.send(file, { materialId: material?.id })
            }
          />
        )}
        {material && (
          <button
            className="text-button"
            type="button"
            aria-expanded={history}
            onClick={() => setHistory(!history)}
          >
            Histórico ({material.versions.length})
          </button>
        )}
      </div>
      <UploadFeedback upload={upload} label={title} />
      {material && history && (
        <ol className="version-history" aria-label={`Versões de ${title}`}>
          {material.versions.map((version) => (
            <li key={version.id}>
              <span className="tiny-badge">v{version.versionNumber}</span>
              <span>
                {version.originalFilename} · {formatBytes(version.sizeBytes)} ·{" "}
                {author(version)} · {formatDate(version.uploadedAt)}
              </span>
              <a
                className="text-button"
                href={version.downloadUrl}
                download
                aria-label={`Baixar versão ${version.versionNumber} de ${title}`}
              >
                Baixar
              </a>
            </li>
          ))}
        </ol>
      )}
    </li>
  );
}

function SupplementForm({
  projectId,
  rule,
  onSaved,
  expired,
}: {
  projectId: number;
  rule: MaterialRule;
  onSaved: (material: Material) => void;
  expired: () => void;
}) {
  const upload = useMaterialUpload(projectId, rule, onSaved, expired);
  const [title, setTitle] = useState("");
  const file = useRef<HTMLInputElement>(null);
  function submit(event: FormEvent) {
    event.preventDefault();
    const selected = file.current?.files?.[0];
    if (!selected) {
      upload.fail("Selecione um arquivo para enviar.");
      return;
    }
    void upload
      .send(selected, { title: title.trim() || undefined })
      .then(() => {
        if (file.current) file.current.value = "";
      });
  }
  return (
    <form className="supplement-form" onSubmit={submit}>
      <h3>Adicionar material complementar</h3>
      <p className="muted">{formatsText(rule)}</p>
      <fieldset disabled={upload.progress !== null}>
        <label>
          Título
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={200}
            placeholder={rule.defaultTitle}
          />
        </label>
        <label>
          Arquivo
          <input
            ref={file}
            type="file"
            accept={rule.formats
              .flatMap((format) => [...format.extensions, format.mimeType])
              .join(",")}
          />
        </label>
        <button className="secondary compact" type="submit">
          Enviar complementar
        </button>
      </fieldset>
      <UploadFeedback upload={upload} label="material complementar" />
    </form>
  );
}

export function MaterialsPanel({
  projectId,
  materials,
  rules,
  onSaved,
  expired,
}: {
  projectId: number;
  materials: Material[];
  rules: MaterialRules;
  onSaved: (material: Material) => void;
  expired: () => void;
}) {
  const required = rules.rules.filter((rule) => rule.required);
  const missing = required.filter(
    (rule) => !materials.some((material) => material.kind === rule.kind),
  );
  const cards = rules.rules.flatMap<{
    rule: MaterialRule;
    material?: Material;
  }>((rule) => {
    const ofKind = materials.filter((material) => material.kind === rule.kind);
    if (ofKind.length) return ofKind.map((material) => ({ rule, material }));
    return rule.required ? [{ rule }] : [];
  });
  const supplement = rules.rules.find((rule) => !rule.required);
  return (
    <section className="detail-section">
      <div className="section-heading">
        <h2>Materiais do projeto</h2>
        <span>
          {required.length - missing.length} de {required.length} obrigatórios
          enviados
          {missing.length > 0 &&
            ` · falta${missing.length > 1 ? "m" : ""}: ${missing
              .map((rule) => rule.defaultTitle)
              .join(", ")}`}
        </span>
      </div>
      {rules.lock === "DEADLINE_PASSED" && (
        <p className="material-lock">
          <Icon name="lock" size={16} />O prazo de entrega terminou
          {rules.dueAt && ` em ${formatDate(rules.dueAt)}`}. Fale com o
          professor para reabrir a entrega.
        </p>
      )}
      {rules.lock === "PROJECT_LOCKED" && (
        <p className="material-lock">
          <Icon name="lock" size={16} />
          Os materiais ficam bloqueados enquanto o projeto não está em
          preparação ou em ajustes.
        </p>
      )}
      {!rules.lock && rules.dueAt && (
        <p className="material-due">
          Prazo de entrega: {formatDate(rules.dueAt)}
        </p>
      )}
      <ul className="material-list">
        {cards.map(({ rule, material }) => (
          <MaterialCard
            key={material ? `m${material.id}` : `k${rule.kind}`}
            projectId={projectId}
            rule={rule}
            material={material}
            canUpload={rules.canUpload}
            onSaved={onSaved}
            expired={expired}
          />
        ))}
      </ul>
      {rules.canUpload && supplement && (
        <SupplementForm
          projectId={projectId}
          rule={supplement}
          onSaved={onSaved}
          expired={expired}
        />
      )}
    </section>
  );
}

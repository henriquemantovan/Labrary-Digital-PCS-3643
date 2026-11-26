import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { ApiError, uploadFile } from "./api";
import type { Material, MaterialRule, MaterialRules } from "./api";
import { BookOpen, Check, File, FileText, Lock, Video } from "lucide-react";
import { Notice } from "./components/Feedback";
import { Badge } from "./components/ui/badge";
import { Button, buttonVariants } from "./components/ui/button";
import { Field, FieldLabel } from "./components/ui/field";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import {
  fileInput,
  hintText,
  lockNote,
  mutedText,
  Panel,
  panelTitle,
  progressBar,
  subTitle,
} from "./components/Panel";
import { cn } from "./lib/utils";

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
        <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
          <progress
            className={progressBar}
            max={100}
            value={upload.progress}
            aria-label={`Enviando ${label}`}
          />
          <span aria-live="polite" className="tabular-nums">
            {upload.progress}%
          </span>
          <Button variant="ghost" size="sm" onClick={upload.cancel}>
            Cancelar
          </Button>
        </div>
      )}
      {upload.error && (
        <div className="mt-3">
          <Notice>
            <span>{upload.error}</span>
            {upload.retry && (
              <Button
                variant="outline"
                size="xs"
                onClick={() => void upload.retry?.()}
              >
                Tentar novamente
              </Button>
            )}
          </Notice>
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
      <Button
        variant={primary ? "default" : "outline"}
        size="sm"
        disabled={disabled}
        onClick={() => input.current?.click()}
      >
        {text}
      </Button>
      <input
        ref={input}
        type="file"
        className="sr-only"
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

function MaterialVideo({
  version,
  title,
}: {
  version: Material["currentVersion"];
  title: string;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="mt-3 min-w-0">
      {failed ? (
        <div
          className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"
          role="alert"
        >
          <p>
            Não foi possível reproduzir este vídeo. Tente novamente ou use
            Baixar.
          </p>
          <button
            className={buttonVariants({
              variant: "outline",
              size: "sm",
              className: "mt-3",
            })}
            type="button"
            onClick={() => setFailed(false)}
          >
            Tentar reproduzir novamente
          </button>
        </div>
      ) : (
        <video
          className="block aspect-video max-h-[65vh] w-full max-w-[760px] rounded-xl border bg-black object-contain"
          controls
          playsInline
          preload="none"
          aria-label={`Assistir ${title} — versão ${version.versionNumber}`}
          src={version.playbackUrl}
          onError={() => setFailed(true)}
        >
          Seu navegador não oferece suporte à reprodução. Use o botão Baixar.
        </video>
      )}
    </div>
  );
}

function KindIcon({ kind }: { kind: string }) {
  if (kind === "VIDEO") return <Video aria-hidden="true" />;
  if (kind === "RELATORIO") return <FileText aria-hidden="true" />;
  if (kind === "MANUAL") return <BookOpen aria-hidden="true" />;
  return <File aria-hidden="true" />;
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
    // "material-card" é gancho dos testes E2E, sem estilo próprio.
    <li className="material-card px-4 py-4">
      <div className="flex flex-wrap items-start gap-3">
        <span
          className={cn(
            "relative grid size-9 shrink-0 place-items-center rounded-lg border [&>svg]:size-4",
            current
              ? "border-success/24 bg-success/8 text-success-foreground"
              : "bg-background text-muted-foreground",
          )}
        >
          <KindIcon kind={rule.kind} />
          {current && (
            <Check className="absolute -right-1 -bottom-1 size-3.5! rounded-full bg-success p-0.5 text-white" />
          )}
        </span>
        <div className="grid min-w-0 flex-1 gap-0.5 text-xs text-muted-foreground [overflow-wrap:anywhere]">
          <strong className="text-sm font-medium text-foreground">
            {title}
          </strong>
          <span>{formatsText(rule)}</span>
          {rule.dueAt && (
            <span>
              Prazo de {title}: {formatDate(rule.dueAt)}
            </span>
          )}
          {rule.lock === "DEADLINE_PASSED" && (
            <span>Prazo deste material encerrado.</span>
          )}
          {current && (
            <span>
              Enviado · versão {current.versionNumber} · {author(current)} ·{" "}
              {formatDate(current.uploadedAt)}
            </span>
          )}
          {current && (
            <span>
              {current.originalFilename} · {formatBytes(current.sizeBytes)}
            </span>
          )}
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          {!current && (
            <Badge variant={rule.required ? "warning" : "secondary"}>
              {rule.required ? "Pendente" : "Opcional"}
            </Badge>
          )}
          {current && (
            <a
              className={buttonVariants({ variant: "outline", size: "sm" })}
              href={current.downloadUrl}
              download
            >
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
            <Button
              variant="ghost"
              size="sm"
              aria-expanded={history}
              onClick={() => setHistory(!history)}
            >
              Histórico ({material.versions.length})
            </Button>
          )}
        </div>
      </div>
      {current?.playbackUrl && current.mimeType.startsWith("video/") && (
        <MaterialVideo key={current.id} version={current} title={title} />
      )}
      <UploadFeedback upload={upload} label={title} />
      {material && history && (
        <ol
          className="mt-3 grid gap-1 rounded-xl border bg-muted/40 p-2 text-xs"
          aria-label={`Versões de ${title}`}
        >
          {material.versions.map((version) => (
            <li
              key={version.id}
              className="flex flex-wrap items-center gap-2 rounded-md px-2 py-1.5"
            >
              <Badge variant="outline">v{version.versionNumber}</Badge>
              <span className="min-w-0 flex-1 text-muted-foreground [overflow-wrap:anywhere]">
                {version.originalFilename} · {formatBytes(version.sizeBytes)} ·{" "}
                {author(version)} · {formatDate(version.uploadedAt)}
              </span>
              <a
                className="font-medium text-foreground underline-offset-2 hover:underline"
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
    <form className="mt-5 border-t pt-5" onSubmit={submit}>
      <h3 className={subTitle}>Adicionar material complementar</h3>
      <p className={cn(hintText, "mt-0.5 mb-4")}>{formatsText(rule)}</p>
      <fieldset
        className="m-0 grid items-end gap-3 border-0 p-0 md:grid-cols-[1fr_1fr_auto]"
        disabled={upload.progress !== null}
      >
        <Field>
          <FieldLabel>Título</FieldLabel>
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={200}
            placeholder={rule.defaultTitle}
          />
        </Field>
        <div className="flex flex-col items-start gap-2">
          <Label htmlFor={`supplement-file-${projectId}`}>Arquivo</Label>
          <input
            id={`supplement-file-${projectId}`}
            className={cn(fileInput, "h-9 content-center")}
            ref={file}
            type="file"
            accept={rule.formats
              .flatMap((format) => [...format.extensions, format.mimeType])
              .join(",")}
          />
        </div>
        <Button variant="outline" type="submit">
          Enviar complementar
        </Button>
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
    <Panel
      heading={<h2 className={panelTitle}>Materiais do projeto</h2>}
      aside={
        <>
          {required.length - missing.length} de {required.length} obrigatórios
          enviados
          {missing.length > 0 &&
            ` · falta${missing.length > 1 ? "m" : ""}: ${missing
              .map((rule) => rule.defaultTitle)
              .join(", ")}`}
        </>
      }
    >
      {rules.lock === "DEADLINE_PASSED" && (
        <p className={cn(lockNote, "mb-4")}>
          <Lock />
          <span>
            O prazo de entrega terminou
            {rules.dueAt && ` em ${formatDate(rules.dueAt)}`}. Fale com o
            professor para reabrir a entrega.
          </span>
        </p>
      )}
      {rules.lock === "PROJECT_LOCKED" && (
        <p className={cn(lockNote, "mb-4")}>
          <Lock />
          Os materiais ficam bloqueados enquanto o projeto não está em
          preparação ou em ajustes.
        </p>
      )}
      {!rules.lock && rules.dueAt && (
        <p className={cn(mutedText, "mb-4")}>
          Prazo de entrega: {formatDate(rules.dueAt)}
        </p>
      )}
      {required.length > 0 && (
        <div
          aria-hidden="true"
          className="-mt-1 mb-4 h-1.5 overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full rounded-full bg-success transition-[width]"
            style={{
              width: `${((required.length - missing.length) / required.length) * 100}%`,
            }}
          />
        </div>
      )}
      <ul className="m-0 list-none divide-y rounded-xl border p-0">
        {cards.map(({ rule, material }) => (
          <MaterialCard
            key={material ? `m${material.id}` : `k${rule.kind}`}
            projectId={projectId}
            rule={rule}
            material={material}
            canUpload={rule.canUpload ?? rules.canUpload}
            onSaved={onSaved}
            expired={expired}
          />
        ))}
      </ul>
      {supplement && (supplement.canUpload ?? rules.canUpload) && (
        <SupplementForm
          projectId={projectId}
          rule={supplement}
          onSaved={onSaved}
          expired={expired}
        />
      )}
    </Panel>
  );
}

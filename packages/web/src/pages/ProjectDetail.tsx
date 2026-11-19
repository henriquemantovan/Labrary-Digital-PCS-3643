import type { Dispatch, SetStateAction } from "react";
import { ApiError } from "../api";
import type { Material, MaterialRules, Project, User } from "../api";
import { ArrowLeft, Lock } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { Button } from "../components/ui/button";
import { materialLabels } from "../labels";
import { MaterialsPanel } from "../Materials";
import { SubmissionPanel } from "../Submission";
import { GroupResult } from "../GroupResult";
import { EvaluatorManager } from "../Groups";
import { PublicationPanel } from "../PublicationPanel";
import { ProjectAssessment } from "../ProjectAssessment";
import { ProjectFeedback } from "../ProjectFeedback";

export function ProjectDetail({
  detail,
  setDetail,
  materials,
  setMaterials,
  materialRules,
  refreshMaterialRules,
  reload,
  user,
  navigate,
  expired,
}: {
  detail: Project;
  setDetail: Dispatch<SetStateAction<Project | null>>;
  materials: Material[];
  setMaterials: Dispatch<SetStateAction<Material[]>>;
  materialRules: MaterialRules | null;
  refreshMaterialRules: () => Promise<void>;
  reload: () => void;
  user: User;
  navigate: (path: string) => void;
  expired: () => void;
}) {
  return (
      <>
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3 mb-4 text-muted-foreground"
          onClick={() => navigate("/projetos")}
        >
          <ArrowLeft />
          Todos os projetos
        </Button>
        <PageHeader
          eyebrow={
            <>
              {detail.category} ·{" "}
              {detail.groupName ??
                `Grupo ${String(detail.groupId).padStart(2, "0")}`}
            </>
          }
          title={detail.title}
          intro={detail.description || "Este projeto ainda não tem uma descrição."}
        />
        <div className="-mt-4 mb-8 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <StatusBadge status={detail.status} />
          {detail.missingMaterials && (
            <p>
              {detail.missingMaterials.length
                ? `Pendentes: ${detail.missingMaterials.map((kind) => materialLabels[kind]).join(", ")}`
                : "Materiais obrigatórios presentes"}
            </p>
          )}
        </div>
        <div className="grid gap-6">
        {materialRules && (
          <MaterialsPanel
            projectId={detail.id}
            materials={materials}
            rules={materialRules}
            onSaved={(saved) => {
              setMaterials((current) =>
                current.some((item) => item.id === saved.id)
                  ? current.map((item) => (item.id === saved.id ? saved : item))
                  : [...current, saved],
              );
              setDetail(
                (current) =>
                  current && {
                    ...current,
                    missingMaterials: current.missingMaterials?.filter(
                      (kind) => kind !== saved.kind,
                    ),
                  },
              );
            }}
            expired={expired}
          />
        )}
        <SubmissionPanel
          key={`submission-${detail.id}`}
          project={detail}
          user={user}
          materials={materials}
          refreshKey={materialRules}
          expired={expired}
          onStatusChanged={(status) => {
            setDetail((current) => current && { ...current, status });
            // O novo estado muda o bloqueio de upload; recarrega as regras dos materiais.
            refreshMaterialRules().catch((failure) => {
              if (failure instanceof ApiError && failure.status === 401) expired();
              else reload();
            });
          }}
        />
        <p className="flex items-center gap-1.5 text-xs text-subtle-foreground">
          <Lock className="size-3.5" />
          Acesso restrito ao grupo e à equipe acadêmica vinculada ao projeto.
        </p>
        {user.role === "ALUNO" && <GroupResult key={`result-${detail.id}`} projectId={detail.id} expired={expired} />}
        {["PROFESSOR", "ADMIN"].includes(user.role) && (
          <EvaluatorManager
            key={`evaluators-${detail.id}`}
            projectId={detail.id}
            classId={detail.classId}
            expired={expired}
          />
        )}
        {["PROFESSOR", "ADMIN"].includes(user.role) && (
          <PublicationPanel
            key={`publication-${detail.id}`}
            projectId={detail.id}
            expired={expired}
            onChanged={() =>
              setDetail(
                (current) => current && { ...current, status: "FINALIZADO" },
              )
            }
          />
        )}
        <ProjectAssessment
          key={`assessment-${detail.id}-${user.role}`}
          projectId={detail.id}
          projectStatus={detail.status}
          user={user}
          expired={expired}
          onConfigurationSaved={refreshMaterialRules}
        />
        <ProjectFeedback
          key={detail.id}
          projectId={detail.id}
          materials={materials}
          expired={expired}
        />
        </div>
      </>
  );
}

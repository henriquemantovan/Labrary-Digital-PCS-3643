import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { ApiError } from "../api";
import type { Material, MaterialRules, Project, User } from "../api";
import { ArrowLeft, Lock } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/ui/button";
import type { SubmissionChecklist } from "../submissionTypes";
import { ProjectProgress, SectionNav } from "./ProjectProgress";
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
  const [checklist, setChecklist] = useState<SubmissionChecklist | null>(null);
  const staff = ["PROFESSOR", "ADMIN"].includes(user.role);
  const missing =
    detail.missingMaterials ??
    (materialRules?.rules ?? [])
      .filter(
        (rule) =>
          rule.required && !materials.some((material) => material.kind === rule.kind),
      )
      .map((rule) => rule.kind);
  const sections = [
    materialRules && { id: "secao-materiais", label: "Materiais" },
    { id: "secao-entrega", label: "Entrega" },
    user.role === "ALUNO" && { id: "secao-resultado", label: "Resultado" },
    staff && { id: "secao-avaliadores", label: "Avaliadores" },
    staff && { id: "secao-publicacao", label: "Publicação" },
    { id: "secao-avaliacao", label: "Avaliação" },
    { id: "secao-feedback", label: "Feedback" },
  ].filter((item): item is { id: string; label: string } => !!item);
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
        <ProjectProgress
          project={detail}
          role={user.role}
          missing={missing}
          checklist={checklist}
        />
        <SectionNav items={sections} />
        <div className="grid gap-6 [&>div]:scroll-mt-16">
        {materialRules && (
          <div id="secao-materiais">
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
          </div>
        )}
        <div id="secao-entrega">
        <SubmissionPanel
          key={`submission-${detail.id}`}
          project={detail}
          user={user}
          materials={materials}
          refreshKey={materialRules}
          expired={expired}
          onChecklist={setChecklist}
          onStatusChanged={(status) => {
            setDetail((current) => current && { ...current, status });
            // O novo estado muda o bloqueio de upload; recarrega as regras dos materiais.
            refreshMaterialRules().catch((failure) => {
              if (failure instanceof ApiError && failure.status === 401) expired();
              else reload();
            });
          }}
        />
        </div>
        {user.role === "ALUNO" && (
          <div id="secao-resultado">
            <GroupResult key={`result-${detail.id}`} projectId={detail.id} expired={expired} />
          </div>
        )}
        {staff && (
          <div id="secao-avaliadores">
          <EvaluatorManager
            key={`evaluators-${detail.id}`}
            projectId={detail.id}
            classId={detail.classId}
            expired={expired}
          />
          </div>
        )}
        {staff && (
          <div id="secao-publicacao">
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
          </div>
        )}
        <div id="secao-avaliacao">
        <ProjectAssessment
          key={`assessment-${detail.id}-${user.role}`}
          projectId={detail.id}
          projectStatus={detail.status}
          user={user}
          expired={expired}
          onConfigurationSaved={refreshMaterialRules}
        />
        </div>
        <div id="secao-feedback">
        <ProjectFeedback
          key={detail.id}
          projectId={detail.id}
          materials={materials}
          expired={expired}
        />
        </div>
        <p className="flex items-center gap-1.5 text-xs text-subtle-foreground">
          <Lock className="size-3.5" />
          Acesso restrito ao grupo e à equipe acadêmica vinculada ao projeto.
        </p>
        </div>
      </>
  );
}

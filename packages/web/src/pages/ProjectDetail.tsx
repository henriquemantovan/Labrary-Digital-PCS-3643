import type { Dispatch, SetStateAction } from "react";
import { ApiError } from "../api";
import type { Material, MaterialRules, Project, User } from "../api";
import { Icon } from "../Icons";
import { materialLabels, statusLabels } from "../labels";
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
        <button
          className="text-button back"
          onClick={() => navigate("/projetos")}
        >
          <Icon name="back" size={17} />
          Todos os projetos
        </button>
        <p className="eyebrow">
          {detail.category} ·{" "}
          {detail.groupName ??
            `Grupo ${String(detail.groupId).padStart(2, "0")}`}
        </p>
        <h1>{detail.title}</h1>
        <p className="page-intro">
          {detail.description || "Este projeto ainda não tem uma descrição."}
        </p>
        <span className={`status-pill status-${detail.status}`}>
          <span />
          {statusLabels[detail.status]}
        </span>
        {detail.missingMaterials && (
          <p>
            {detail.missingMaterials.length
              ? `Pendentes: ${detail.missingMaterials.map((kind) => materialLabels[kind]).join(", ")}`
              : "Materiais obrigatórios presentes"}
          </p>
        )}
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
        <div className="access-note">
          <Icon name="lock" size={17} />
          Acesso restrito ao grupo e à equipe acadêmica vinculada ao projeto.
        </div>
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
      </>
  );
}

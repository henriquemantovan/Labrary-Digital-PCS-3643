import type { Project, Scope } from "../api";
import { Icon } from "../Icons";
import { Empty } from "../components/Feedback";
import { GroupManager } from "../Groups";

export function Classes({
  scope,
  projects,
  navigate,
  expired,
  onChanged,
}: {
  scope: Scope;
  projects: Project[];
  navigate: (path: string) => void;
  expired: () => void;
  onChanged: () => void;
}) {
  return (
      <>
        <p className="eyebrow">GESTÃO ACADÊMICA</p>
        <h1>Minhas turmas</h1>
        <p className="page-intro">
          Grupos e projetos sob sua responsabilidade.
        </p>
        <div className="class-grid">
          {scope.classes.map((item) => (
            <article className="class-card" key={item.id}>
              <Icon name="book" size={28} />
              <span className="eyebrow">{item.academicYear}</span>
              <h2>{item.name}</h2>
              <p>
                {
                  scope.groups.filter((group) => group.classId === item.id)
                    .length
                }{" "}
                grupos ·{" "}
                {
                  projects.filter((project) => project.classId === item.id)
                    .length
                }{" "}
                projetos
              </p>
              <ul className="group-list">
                {scope.groups
                  .filter((group) => group.classId === item.id)
                  .map((group) => (
                    <li key={group.id}>
                      <span>{group.name}</span>
                      <span>
                        {projects.some(
                          (project) => project.groupId === group.id,
                        )
                          ? "Projeto cadastrado"
                          : "Sem projeto"}
                      </span>
                    </li>
                  ))}
              </ul>
              <GroupManager
                classId={item.id}
                onChanged={onChanged}
                expired={expired}
              />
              <button
                className="text-button"
                onClick={() => navigate("/projetos")}
              >
                Gerenciar projetos <Icon name="arrow" size={16} />
              </button>
            </article>
          ))}
        </div>
        {!scope.classes.length && (
          <Empty
            title="Nenhuma turma vinculada"
            text="Suas turmas aparecerão aqui quando forem vinculadas à sua conta."
          />
        )}
      </>
  );
}

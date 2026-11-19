import type { User } from "../api";
import { Icon } from "../Icons";
import { roleDescriptions, roleLabels } from "../labels";

export function Profile({ user }: { user: User }) {
  return (
      <>
        <p className="eyebrow">SUA CONTA</p>
        <h1>Meu perfil</h1>
        <p className="page-intro">Seu lugar na comunidade Labrary.</p>
        <section className="profile-card">
          <span className="avatar large">
            <Icon name="user" size={32} />
          </span>
          <h2>{user.fullName}</h2>
          <span className="profile-badge">{roleLabels[user.role]}</span>
          <dl>
            <dt>E-mail</dt>
            <dd>{user.email}</dd>
            {user.googleLinked && (
              <>
                <dt>Autenticação</dt>
                <dd>Conta Google vinculada</dd>
              </>
            )}
            <dt>Permissões</dt>
            <dd>{roleDescriptions[user.role]}</dd>
          </dl>
          <p className="muted">
            Para atualizar sua conta ou seus vínculos, fale com o professor
            responsável.
          </p>
        </section>
      </>
  );
}

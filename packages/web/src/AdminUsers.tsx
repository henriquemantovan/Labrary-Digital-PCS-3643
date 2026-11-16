import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "./api";
import type { ManagedUser, User } from "./api";
const labels: Record<User["role"], string> = {
  ADMIN: "Administrador",
  ALUNO: "Aluno",
  AVALIADOR: "Avaliador",
  PROFESSOR: "Professor",
};
export function AdminUsers({
  expired,
  onSessionChanged,
}: {
  expired: () => void;
  onSessionChanged: (user: User) => void;
}) {
  const [users, setUsers] = useState<ManagedUser[]>([]),
    [drafts, setDrafts] = useState<Record<number, User["role"]>>({});
  const [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState(""),
    [actionError, setActionError] = useState(""),
    [success, setSuccess] = useState(""),
    [search, setSearch] = useState(""),
    [saving, setSaving] = useState<number | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      setUsers(await api<ManagedUser[]>("/admin/users"));
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) expired();
      setLoadError((error as Error).message);
    } finally {
      setLoading(false);
    }
  }, [expired]);
  useEffect(() => {
    void load();
  }, [load]);
  async function save(user: ManagedUser) {
    setSaving(user.id);
    setActionError("");
    setSuccess("");
    try {
      const updated = await api<ManagedUser>(`/admin/users/${user.id}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role: drafts[user.id] ?? user.role }),
      });
      setUsers((items) =>
        items.map((item) => (item.id === updated.id ? updated : item)),
      );
      setSuccess(
        `Perfil de ${updated.fullName} atualizado para ${labels[updated.role]}.`,
      );
      onSessionChanged(await api<User>("/auth/me"));
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) expired();
      setActionError((error as Error).message);
    } finally {
      setSaving(null);
    }
  }
  const filtered = users.filter((user) =>
    `${user.fullName} ${user.email}`
      .toLocaleLowerCase("pt-BR")
      .includes(search.toLocaleLowerCase("pt-BR")),
  );
  return (
    <>
      <p className="eyebrow">ADMINISTRAÇÃO</p>
      <h1>Administrar usuários</h1>
      <button
        className="secondary"
        disabled={loading || saving !== null}
        onClick={() => void load()}
      >
        Atualizar usuários
      </button>
      <p className="page-intro">
        Defina os perfis das contas já cadastradas. Alterar o perfil não cria
        vínculos com turmas, grupos ou projetos.
      </p>
      <label htmlFor="admin-search">Buscar usuários</label>
      <input
        id="admin-search"
        className="admin-search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Nome ou e-mail"
      />
      {loadError && (
        <div role="alert" className="notice">
          {loadError}
          <button onClick={() => void load()}>Tentar novamente</button>
        </div>
      )}
      {actionError && (
        <div role="alert" className="notice">
          {actionError}
        </div>
      )}
      {success && <p role="status">{success}</p>}
      {loading ? (
        <p role="status">Carregando usuários…</p>
      ) : (
        !loadError && (
          <div className="admin-users">
            {filtered.length === 0 && <p>Nenhum usuário encontrado.</p>}
            {filtered.map((user) => (
              <article
                className="admin-user-card"
                key={user.id}
                aria-labelledby={`user-${user.id}`}
              >
                <div>
                  <h2 id={`user-${user.id}`}>{user.fullName}</h2>
                  <p>{user.email}</p>
                  <span className="profile-badge">
                    {labels[user.role]} · {user.active ? "Ativa" : "Desativada"}
                  </span>
                </div>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void save(user);
                  }}
                >
                  <label htmlFor={`user-role-${user.id}`}>
                    Perfil de {user.fullName}
                  </label>
                  <select
                    id={`user-role-${user.id}`}
                    value={drafts[user.id] ?? user.role}
                    disabled={saving !== null}
                    onChange={(event) =>
                      setDrafts((items) => ({
                        ...items,
                        [user.id]: event.target.value as User["role"],
                      }))
                    }
                  >
                    {Object.entries(labels).map(([role, label]) => (
                      <option key={role} value={role}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="primary"
                    disabled={
                      saving !== null ||
                      (drafts[user.id] ?? user.role) === user.role
                    }
                    aria-label={`Salvar perfil de ${user.fullName}`}
                  >
                    {saving === user.id ? "Salvando…" : "Salvar perfil"}
                  </button>
                </form>
              </article>
            ))}
          </div>
        )
      )}
    </>
  );
}

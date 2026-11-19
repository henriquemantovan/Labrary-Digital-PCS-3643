import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "./api";
import type { ManagedUser, User } from "./api";
import { buttonVariants } from "./components/ui/button";
import { Search } from "lucide-react";
import { Loading, noticeClass } from "./components/Feedback";
import { PageHeader } from "./components/PageHeader";
import { Badge } from "./components/ui/badge";
import { Input, Label, NativeSelect } from "./components/ui/input";
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
      <PageHeader
        eyebrow="Administração"
        title="Administrar usuários"
        intro="Defina os perfis das contas já cadastradas. Alterar o perfil não cria vínculos com turmas, grupos ou projetos."
        actions={
          <button
            className={buttonVariants({ variant: "outline" })}
            disabled={loading || saving !== null}
            onClick={() => void load()}
          >
            Atualizar usuários
          </button>
        }
      />
      <div className="mb-6 grid max-w-md gap-1.5">
        <Label htmlFor="admin-search">Buscar usuários</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle-foreground" />
          <Input
            id="admin-search"
            className="pl-9"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nome ou e-mail"
          />
        </div>
      </div>
      <div className="grid gap-4 empty:hidden">
      {loadError && (
        <div role="alert" className={noticeClass}>
          {loadError}
          <button onClick={() => void load()}>Tentar novamente</button>
        </div>
      )}
      {actionError && (
        <div role="alert" className={noticeClass}>
          {actionError}
        </div>
      )}
      {success && (
        <p
          role="status"
          className="rounded-lg bg-success/10 px-3.5 py-2.5 text-sm text-success"
        >
          {success}
        </p>
      )}
      </div>
      {loading ? (
        <Loading label="Carregando usuários…" />
      ) : (
        !loadError && (
          <div className="mt-4 divide-y rounded-xl border bg-card">
            {filtered.length === 0 && (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                Nenhum usuário encontrado.
              </p>
            )}
            {filtered.map((user) => (
              <article
                className="flex flex-wrap items-end justify-between gap-4 px-5 py-4"
                key={user.id}
                aria-labelledby={`user-${user.id}`}
              >
                <div className="grid min-w-0 gap-1 [overflow-wrap:anywhere]">
                  <h2 id={`user-${user.id}`} className="text-sm font-medium">
                    {user.fullName}
                  </h2>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                  <Badge>
                    {labels[user.role]} · {user.active ? "Ativa" : "Desativada"}
                  </Badge>
                </div>
                <form
                  className="flex flex-wrap items-end gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void save(user);
                  }}
                >
                  <div className="grid gap-1.5">
                  <Label htmlFor={`user-role-${user.id}`} className="text-xs text-muted-foreground">
                    Perfil de {user.fullName}
                  </Label>
                  <NativeSelect
                    className="h-9 w-48"
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
                  </NativeSelect>
                  </div>
                  <button
                    type="submit"
                    className={buttonVariants()}
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

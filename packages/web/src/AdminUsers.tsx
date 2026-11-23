import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "./api";
import type { ManagedUser, User } from "./api";
import { RefreshCw, Search } from "lucide-react";
import { Loading, Notice, Success } from "./components/Feedback";
import { PageHeader } from "./components/PageHeader";
import { Avatar, AvatarFallback } from "./components/ui/avatar";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Card } from "./components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "./components/ui/input-group";
import { Label } from "./components/ui/label";
import { NativeSelect } from "./components/ui/native-select";
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
          <Button
            variant="outline"
            disabled={loading || saving !== null}
            onClick={() => void load()}
          >
            <RefreshCw />
            Atualizar usuários
          </Button>
        }
      />
      <div className="mb-6 flex max-w-md flex-col gap-2">
        <Label htmlFor="admin-search">Buscar usuários</Label>
        <InputGroup>
          <InputGroupInput
            id="admin-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nome ou e-mail"
          />
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
        </InputGroup>
      </div>
      <div className="grid gap-4 empty:hidden">
        {loadError && (
          <Notice>
            {loadError}
            <Button variant="outline" size="xs" onClick={() => void load()}>
              Tentar novamente
            </Button>
          </Notice>
        )}
        {actionError && <Notice>{actionError}</Notice>}
        {success && (
          <Success>{success}</Success>
        )}
      </div>
      {loading ? (
        <Loading label="Carregando usuários…" />
      ) : (
        !loadError && (
          <Card className="mt-4 divide-y overflow-hidden">
            {filtered.length === 0 && (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                Nenhum usuário encontrado.
              </p>
            )}
            {filtered.map((user) => (
              <article
                className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"
                key={user.id}
                aria-labelledby={`user-${user.id}`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar className="size-9 border bg-background">
                    <AvatarFallback className="bg-background text-xs font-semibold">
                      {user.fullName
                        .split(" ")
                        .map((part) => part[0])
                        .slice(0, 2)
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid min-w-0 gap-1 [overflow-wrap:anywhere]">
                    <h2 id={`user-${user.id}`} className="text-sm font-medium">
                      {user.fullName}
                    </h2>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="outline">{labels[user.role]}</Badge>
                      <Badge variant={user.active ? "success" : "secondary"}>
                        {user.active ? "Ativa" : "Desativada"}
                      </Badge>
                    </div>
                  </div>
                </div>
                <form
                  className="flex flex-wrap items-end gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void save(user);
                  }}
                >
                  <div className="flex flex-col gap-1.5">
                    <Label
                      htmlFor={`user-role-${user.id}`}
                      className="text-xs font-normal text-muted-foreground"
                    >
                      Perfil de {user.fullName}
                    </Label>
                    <NativeSelect
                      className="w-48"
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
                  <Button
                    type="submit"
                    disabled={
                      saving !== null ||
                      (drafts[user.id] ?? user.role) === user.role
                    }
                    aria-label={`Salvar perfil de ${user.fullName}`}
                  >
                    {saving === user.id ? "Salvando…" : "Salvar perfil"}
                  </Button>
                </form>
              </article>
            ))}
          </Card>
        )
      )}
    </>
  );
}

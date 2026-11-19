import { User as UserIcon } from "lucide-react";
import type { User } from "../api";
import { PageHeader } from "../components/PageHeader";
import { Badge } from "../components/ui/badge";
import { roleDescriptions, roleLabels } from "../labels";

export function Profile({ user }: { user: User }) {
  return (
    <>
      <PageHeader
        eyebrow="Sua conta"
        title="Meu perfil"
        intro="Seu lugar na comunidade Labrary."
      />
      <section className="max-w-xl rounded-xl border bg-card p-6">
        <div className="flex items-center gap-4">
          <span className="grid size-14 place-items-center rounded-full bg-muted text-muted-foreground">
            <UserIcon className="size-6" />
          </span>
          <div className="grid gap-1">
            <h2 className="text-lg font-semibold tracking-tight">{user.fullName}</h2>
            <Badge>{roleLabels[user.role]}</Badge>
          </div>
        </div>
        <dl className="mt-6 grid gap-x-6 gap-y-3 border-t pt-6 text-sm sm:grid-cols-[max-content_1fr]">
          <dt className="text-muted-foreground">E-mail</dt>
          <dd className="[overflow-wrap:anywhere]">{user.email}</dd>
          {user.googleLinked && (
            <>
              <dt className="text-muted-foreground">Autenticação</dt>
              <dd>Conta Google vinculada</dd>
            </>
          )}
          <dt className="text-muted-foreground">Permissões</dt>
          <dd>{roleDescriptions[user.role]}</dd>
        </dl>
        <p className="mt-6 text-xs text-subtle-foreground">
          Para atualizar sua conta ou seus vínculos, fale com o professor
          responsável.
        </p>
      </section>
    </>
  );
}

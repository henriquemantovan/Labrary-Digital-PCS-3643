import { Info } from "lucide-react";
import type { User } from "../api";
import { PageHeader } from "../components/PageHeader";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { Badge } from "../components/ui/badge";
import { Card, CardFooter, CardHeader, CardPanel } from "../components/ui/card";
import { roleDescriptions, roleLabels } from "../labels";

export function Profile({ user }: { user: User }) {
  const initials = user.fullName
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");
  return (
    <>
      <PageHeader
        eyebrow="Sua conta"
        title="Meu perfil"
        intro="Seu lugar na comunidade Labrary."
      />
      <Card
        render={<section aria-labelledby="profile-name" />}
        className="max-w-xl"
      >
        <CardHeader className="flex items-center gap-4">
          <Avatar className="size-14 border bg-background">
            <AvatarFallback className="bg-muted text-base font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="grid gap-1.5">
            <h2
              id="profile-name"
              className="font-heading text-lg font-semibold"
            >
              {user.fullName}
            </h2>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline">{roleLabels[user.role]}</Badge>
              {user.googleLinked && <Badge variant="info">Google</Badge>}
            </div>
          </div>
        </CardHeader>
        <CardPanel>
          <dl className="grid gap-x-6 gap-y-3 border-t pt-6 text-sm sm:grid-cols-[max-content_1fr]">
            <dt className="text-muted-foreground">E-mail</dt>
            <dd className="[overflow-wrap:anywhere]">{user.email}</dd>
            {user.uspNumber && (
              <>
                <dt className="text-muted-foreground">NUSP</dt>
                <dd>{user.uspNumber}</dd>
              </>
            )}
            {user.entryYear && (
              <>
                <dt className="text-muted-foreground">Ano de ingresso</dt>
                <dd>{user.entryYear}</dd>
              </>
            )}
            {user.googleLinked && (
              <>
                <dt className="text-muted-foreground">Autenticação</dt>
                <dd>Conta Google vinculada</dd>
              </>
            )}
            <dt className="text-muted-foreground">Permissões</dt>
            <dd>{roleDescriptions[user.role]}</dd>
          </dl>
        </CardPanel>
        <CardFooter className="gap-2 text-xs text-muted-foreground">
          <Info className="size-3.5 shrink-0" />
          Para atualizar sua conta ou seus vínculos, fale com o professor
          responsável.
        </CardFooter>
      </Card>
    </>
  );
}

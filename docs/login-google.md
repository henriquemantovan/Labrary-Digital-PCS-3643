# Login Google e contas de desenvolvimento

O ambiente entregue já possui cliente Google, PostgreSQL e R2 configurados. Para usá-lo, siga o [README](../README.md#instalação-no-ubuntu-2604). Os passos abaixo são para configurar um ambiente próprio.

## Configurar Google OAuth

Crie um cliente OAuth do tipo **Aplicativo da Web** no [Google Cloud Console](https://console.cloud.google.com/). Cadastre o callback de desenvolvimento exatamente como:

```text
http://localhost:5173/api/auth/google/callback
```

Se o aplicativo estiver em testes, inclua as contas de avaliação entre os usuários permitidos quando exigido pela configuração Google. Preencha o `.env` privado na raiz:

```dotenv
AUTH_PROVIDER=google
AUTH_DEMO=false
APP_ORIGIN=http://localhost:5173
API_PORT=3000
WEB_PORT=5173
DATABASE_URL=postgresql://usuario:senha@host:porta/banco
GOOGLE_CLIENT_ID=seu-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=preencher-no-ambiente-privado
```

Neste modo, contas, sessões, vínculos, projetos, critérios, avaliações, resultados e controle R2 são persistidos no PostgreSQL. Uma cópia com o mesmo `.env` acessa os mesmos dados, sem precisar de snapshots locais.

Não use `AUTH_USERS_FILE` nesse modo. Para um banco próprio novo, execute `pnpm db:deploy` e `pnpm db:status` antes de iniciar `pnpm dev`. Em produção, utilize HTTPS e mantenha o login de teste desativado.

## Cadastro e convidados

A API verifica a identidade Google e o e-mail antes de permitir acesso. São aceitos endereços `@usp.br` ou convidados previamente autorizados pelo administrador. Novos usuários recebem o papel **Aluno**, sem vínculos automáticos.

Alunos USP devem completar **nome completo, NUSP e ano de ingresso**. O NUSP é numérico e único, e o ano deve estar entre 1900 e o ano atual. Os dados são declarados pelo aluno; não há integração com matrícula ou Senha Única USP.

Em **Administrar usuários → Convidados externos**, o administrador autoriza o endereço Google antes do primeiro login. Não é enviado e-mail automático. Convidados são dispensados dos campos acadêmicos; o convite não concede turma, grupo ou papel privilegiado. Revogar o convite bloqueia sessões e novos logins.

## Papéis e vínculos

O Google não define quem é professor, avaliador ou administrador. Um administrador atribui os papéis pela aplicação; professores gerenciam seus grupos e atribuições. As permissões estão no [manual de uso](manual-de-uso.md#acesso-e-permissões).

O primeiro administrador real deve ser provisionado no banco pelo responsável pelo ambiente, após conferir a identidade. A aplicação preserva o último administrador real ativo. A opção **Visualizar como** muda o perfil efetivo da sessão usando os vínculos da própria conta.

## Contas fictícias com senha

Para habilitar as oito contas reservadas em um ambiente próprio Google/PostgreSQL:

```dotenv
NODE_ENV=development
DEV_TEST_LOGIN=true
```

A origem deve ser local (`localhost` ou `127.0.0.1`). A API escuta somente em `127.0.0.1` quando essa opção está ativa. Execute `pnpm contas:teste` para provisionar contas ausentes e reinicie a API. O comando não sobrescreve contas existentes nem reativa um convite revogado.

Use o formulário **E-mail da conta de teste** com as [contas e senhas do README](../README.md#contas-de-teste). Elas utilizam o PostgreSQL e o armazenamento configurados, sem criar identidades Google. A conta `cadastro` demonstra o preenchimento acadêmico com dados fictícios; `convidado` depende de convite ativo.

Para desativar, defina `DEV_TEST_LOGIN=false` e reinicie a API. As contas são preservadas para manter o histórico, mas suas sessões deixam de dar acesso. O login real continua pelo botão **Entrar com Google**.

## Sessões

O fluxo usa OpenID Connect com validação de assinatura, destinatário, expiração, e-mail verificado, state, nonce e PKCE. O navegador recebe cookie HttpOnly; o banco armazena somente o hash do token de sessão. A sessão expira em oito horas e é revogada ao sair. Não são armazenadas senhas ou tokens de acesso Google.

Os testes automatizados usam um provedor OIDC isolado. A configuração de um cliente próprio deve ser conferida também com uma conta Google autorizada.

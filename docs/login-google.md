# SSO Google e autenticação PostgreSQL

O Labrary usa o [fluxo de servidor OpenID Connect do Google](https://developers.google.com/identity/openid-connect/openid-connect). O usuário escolhe sua conta na página oficial Google; a senha não passa pelo Labrary. A API troca o código de autorização e verifica a assinatura RS256 pelas chaves públicas Google, emissor, destinatário, expiração, tempo de emissão, nonce e e-mail verificado. PKCE S256 e state vinculado ao cookie protegem a tentativa. Escopos solicitados: `openid email profile`.

## Configurar o cliente Google

1. Acesse [Google Cloud Console](https://console.cloud.google.com/) e selecione/crie um projeto.
2. Em **Google Auth Platform**, configure a marca e o público do aplicativo. Em modo de testes, adicione as contas que vão testar em **Audience / Test users**, quando aplicável.
3. Em **Clients**, crie um cliente OAuth do tipo **Web application / Aplicativo da Web**.
4. Em **Authorized JavaScript origins / Origens JavaScript autorizadas**, pode cadastrar `http://localhost:5173` (somente origem, sem caminho). Esse campo é opcional no fluxo de servidor implementado; o callback abaixo é o endereço usado na autenticação. Veja as [regras dos clientes OAuth](https://support.google.com/cloud/answer/15549257).
5. Em **Authorized redirect URIs**, cadastre exatamente `http://localhost:5173/api/auth/google/callback` para desenvolvimento. Na implantação, cadastre `https://seu-dominio/api/auth/google/callback`. O host e a porta devem corresponder a `APP_ORIGIN`.
6. Copie o Client ID e o Client Secret para o `.env` privado da raiz. A criação de um cliente exige acesso ao projeto Google Cloud; não são credenciais do PostgreSQL. Não é necessário pedir um consumidor à USP.

```dotenv
AUTH_PROVIDER=google
AUTH_DEMO=false
APP_ORIGIN=http://localhost:5173
API_PORT=3000
WEB_PORT=5173
DATABASE_URL=postgresql://usuario:senha@host:porta/nome_do_banco
GOOGLE_CLIENT_ID=seu-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=seu-segredo
```

Remova `AUTH_USERS_FILE`. Não exponha segredo em variável Vite, frontend, Git ou argumento de linha de comando. Configuração Google incompleta interrompe a inicialização com uma mensagem clara. Em produção configure `NODE_ENV=production` e `APP_ORIGIN` HTTPS. Frontend e `/api` compartilham a mesma origem, por proxy. Os endpoints Google de produção são fixos; o servidor simulado só é injetado pelos testes.

Depois de configurar o `.env`, na raiz:

```sh
nvm use
pnpm install --frozen-lockfile
pnpm db:deploy
pnpm db:status
pnpm dev
```

Abra `http://localhost:5173` e clique em **Entrar com Google**. O primeiro acesso cria a conta, o retorno abre `/projetos`, e **Meu perfil** mostra nome, e-mail, papel e conta Google vinculada. Sair revoga a sessão no banco. Usuários novos começam sem turma/grupo; a autenticação não cria vínculos acadêmicos automaticamente.

Para demonstrar sem credenciais Google: `AUTH_PROVIDER=local`, `AUTH_DEMO=true`, sem `AUTH_USERS_FILE`; os dados demonstrativos e a senha local estão em [HU01](hu01.md). Esse modo é proibido em produção e não autentica no Google.

## Identidade, perfis e contas antigas

A chave da identidade é o `sub` estável e verificado do Google, persistido como `google_subject` único. Nome/e-mail são sincronizados em cada login. Não são armazenados access token, refresh token, ID token nem senha Google. Um e-mail não verificado, token adulterado/expirado ou conta desativada não cria sessão.

O Google não informa se alguém é aluno, professor ou avaliador. Novos usuários recebem **ALUNO**. O papel **ADMIN** concede a área de administração e precisa ser atribuído por outro administrador ou por uma operação inicial autorizada no banco. Contas existentes conservam o `role` e o estado `active`; o callback nunca promove alguém por claims, domínio de e-mail, parâmetros da URL ou escolha no navegador. Administradores gerenciam papéis em **Administrar usuários** (`/administracao`) após verificar a identidade. A operação no banco abaixo fica reservada a manutenção administrativa, usando o ID confirmado:

```sql
-- Substitua o ID confirmado; não use o valor abaixo sem conferir a conta.
UPDATE app_user SET role = 'PROFESSOR' WHERE id = 123;
```

As permissões continuam dependendo das turmas, grupos e atribuições explícitas no banco. Mudanças de papel/desativação são verificadas nas requisições autenticadas.

Contas antigas com o mesmo e-mail não são mescladas automaticamente. O login mostra orientação para contatar o responsável. Para preservar seus vínculos, o administrador verifica a identidade e associa explicitamente o `google_subject` à conta existente. Não associe um `sub` por suposição. Não há endpoint público para definir papéis ou vincular identidades a outras contas.

## Migrations e preservação do banco

Os arquivos `schema.sql` são snapshots históricos. As migrations já aplicadas permanecem intactas:

- `20261001000000_baseline`: as 20 tabelas iniciais.
- `20261022000000_usp_identity`: identidade USP anterior.
- `20261102000000_google_auth`: identidade Google, e-mail único sem distinguir maiúsculas, `auth_session` e `oauth_login_attempt`.
- `20261102010000_admin_access`: papel ADMIN, visualização por sessão e `user_role_audit` (23 tabelas de domínio ao todo).

A migration Google é transacional e preserva tabelas, chaves estrangeiras, contas, papéis, hashes e dados USP. E-mails antigos duplicados por diferença de maiúsculas precisam ser resolvidos administrativamente antes do deploy; a migration falha sem mesclá-los silenciosamente. As rotas e serviços USP foram removidos; suas colunas foram mantidas para preservar o histórico.

Em **banco vazio**, use `pnpm db:deploy`. Em **banco já gerenciado pelas migrations**, use `pnpm db:status` e `pnpm db:deploy`, sem registrar novamente a baseline. Apenas na primeira adoção de um banco com o `schema.sql` original, após backup e conferência do schema, execute `pnpm db:baseline` antes de `pnpm db:deploy`. Não use baseline em banco vazio, reset ou reaplicação do SQL antigo em banco existente.

## Sessões e limites

`auth_session` guarda SHA-256 do token opaco aleatório de 32 bytes, usuário e expiração absoluta de oito horas. O navegador recebe somente cookie HttpOnly, SameSite=Lax, Path=/api e Secure em produção. Sessões sobrevivem ao reinício e são compartilhadas por instâncias que usam o mesmo banco. Logout remove a sessão. Desativação revoga a sessão encontrada e impede novo login; não reativa a conta durante sincronização Google.

Tentativas OAuth duram dez minutos e persistem no banco por hash do state. O cookie HttpOnly vincula a tentativa ao navegador. O callback valida state, consome a tentativa atomicamente e só então troca o código com seu verificador PKCE e nonce. Repetir o callback não cria sessão. Sessões e tentativas expiradas são removidas durante novas criações; o banco pode agendar limpeza adicional. Tentativas de login são limitadas por IP por processo, com `429` e `Retry-After`; o limite não é distribuído entre réplicas.

Projetos, metadados e mensagens continuam no arquivo privado da HU07; `PROJECT_DATA_FILE` pode manter o caminho já usado. O padrão do modo Google é `.data/projects-google.json`. Não reutilize snapshots com IDs de um diretório de demonstração em identidades reais. As tabelas de projeto existem no PostgreSQL, mas esse adapter de arquivos e o armazenamento de bytes não foram migrados nesta mudança de autenticação.

## Verificações

```sh
pnpm build
pnpm test
pnpm exec playwright install chromium
pnpm test:e2e
# Somente em cluster descartável com permissão CREATEDB:
TEST_DATABASE_URL=postgresql://usuario:senha@localhost:5432/postgres pnpm db:test
```

`db:test` cria/remove bancos exclusivos e verifica migração do zero e de schema antigo com dados, repetição de deploy, preservação da identidade USP, identidade Google, papel sem promoção, colisão de e-mail, sessões entre instâncias, logout, expiração, desativação e consumo concorrente de tentativa OAuth.

Os E2E usam `packages/api/integration/googleFixture.ts`: provedor OIDC isolado com tokens RSA assinados, JWKS via HTTP e validação de PKCE. Cobrem aluno, professor previamente provisionado, e-mail não verificado, cancelamento, recarga, perfil e logout em desktop/celular. O fixture só existe no Playwright, nas portas 3004/3005/5181; não habilita um login falso em produção. Os testes automatizados não substituem entrar no Google real após configurar o cliente OAuth.


## Administradores

Na conta ADMIN, abra **Administrar usuários** para listar/buscar contas já cadastradas, escolher o perfil e clicar em **Salvar perfil**. É possível conceder e remover ADMIN, preservando vínculos e histórico. O último administrador ativo não pode ser destituído pela API. As alterações são auditadas no PostgreSQL; o nome do autor vem da sessão validada, nunca do corpo enviado pelo navegador. Contas novas pelo Google continuam ALUNO.

Em **Visualizar como**, escolha Administrador, Aluno, Avaliador ou Professor. A escolha acadêmica muda os controles da interface e as permissões acadêmicas da sessão no servidor, sem alterar `app_user.role`. A prévia utiliza os vínculos da própria conta; sem grupo, turma ou atribuição correspondente, a lista poderá ficar vazia. Não é impersonação de outro usuário. A administração permanece acessível e **Administrador** restaura o acesso global aos projetos/turmas. A escolha sobrevive à recarga, é específica da sessão e não modifica outras sessões do usuário.

O login Google preserva ADMIN assim como os demais perfis. Rebaixar uma conta por meio da administração limpa as visualizações de suas sessões; as permissões são relidas no banco a cada requisição. A seleção de perfil e a administração são negadas a contas comuns mesmo por acesso direto à API.


## Grupos e vínculos — semana 5

A migration `20261107000000_academic_links` acrescenta auditoria de vínculos, permite participações explícitas em vários grupos e adapta a atribuição de avaliadores aos IDs dos projetos ainda persistidos em arquivo. Não altera migrations anteriores nem apaga vínculos existentes. Execute `pnpm db:deploy` antes de iniciar a API atualizada. O Prisma acompanha a mudança; os snapshots `schema.sql` continuam históricos.

Em **Minhas turmas**, professor/ADMIN cria grupos e seleciona integrantes entre contas Google/ADMIN provisionadas. No detalhe do projeto, seleciona avaliadores. Turmas precisam estar provisionadas no banco. A API grava grupos/participações/atribuições e histórico no PostgreSQL; o diretório de autorização é recarregado a cada requisição, preservando alterações e revogações em sessões abertas e após reinício. `GROUP_DATA_FILE` só é usado no modo local. Decisões de adapter, backup e migração futura da FK estão na [HU02](hu02.md).

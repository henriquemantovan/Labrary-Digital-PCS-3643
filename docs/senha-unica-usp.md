# Senha Única USP e migrations

A integração usa OAuth 1.0 HMAC-SHA1, conforme o [serviço oficial da STI](https://servicos.sti.usp.br/oauth/) e a [implementação de referência uspdev/senhaunica](https://github.com/uspdev/senhaunica). A senha é digitada no portal USP. O Labrary recebe nome, número USP, e-mail e vínculos; não recebe nem armazena a senha USP. A normalização da assinatura segue a [biblioteca de referência](https://github.com/thephpleague/oauth1-client/blob/master/src/Signature/EncodesUrl.php), que consolida parâmetros repetidos na troca do token. Os endpoints são `request_token`, `authorize`, `access_token` e `usuariousp` (POST para tokens/perfil).

## Banco existente: adoção das migrations

`db/schema.sql` e `schema.sql` permanecem imutáveis como snapshot do que já foi implantado. A migration `20261001000000_baseline` é uma cópia integral desse SQL, incluindo constraints e índices parciais. `20261022000000_usp_identity` acrescenta identidade institucional e permite contas sem senha local. Nenhuma tabela ou dado existente é apagado.

Com `DATABASE_URL` apontando para o banco desejado no `.env` da raiz, após backup e conferência de que o schema corresponde ao snapshot:

```sh
pnpm install --frozen-lockfile
# Apenas na primeira adoção do histórico, se o schema.sql já foi aplicado:
pnpm db:baseline
pnpm db:deploy
pnpm db:status
```

`db:baseline` registra a migration inicial como já aplicada; não executa seu SQL. Não use esse comando em banco vazio ou com schema diferente. Nunca reaplique `schema.sql` em um banco existente nem use reset para esta atualização. Se já houver histórico `_prisma_migrations`, confira `db:status` antes de resolver a baseline. Em banco vazio use somente `pnpm db:deploy`: as duas migrations serão executadas em ordem. Deploys seguintes usam `db:deploy` e `db:status`. Novas alterações devem receber outra pasta de migration; não altere migrations aplicadas.

A integração verifica banco vazio e schema antigo com dados, preservação de hashes/IDs, segundo deploy sem alterações e persistência da identidade:

```sh
# Cluster descartável; o teste cria e remove dois bancos de nomes exclusivos.
TEST_DATABASE_URL=postgresql://usuario:senha@localhost:5432/postgres pnpm db:test
```

O usuário de teste precisa poder criar bancos. O CI fornece um PostgreSQL isolado para essa verificação.

## Configuração da aplicação USP

Cadastre o consumidor em [Administração OAuth USP](https://uspdigital.usp.br/adminws/oauthConsumidorAcessar), obtenha a chave e o segredo, e registre exatamente `https://seu-dominio/api/auth/usp/callback` como callback. Configure:

```dotenv
AUTH_DEMO=false
APP_ORIGIN=https://seu-dominio
DATABASE_URL=postgresql://usuario:senha@host:5432/labrary_digital
SENHAUNICA_KEY=chave-do-consumidor
SENHAUNICA_SECRET=segredo-do-consumidor
SENHAUNICA_CALLBACK_ID=0
```

Use o ID do callback cadastrado; `0` é somente exemplo. Remova `AUTH_USERS_FILE`. As três variáveis USP são obrigatórias em conjunto; configuração incompleta interrompe a inicialização. Nunca envie chave/segredo para o frontend. O provedor padrão é `https://uspdigital.usp.br/wsusuario/oauth`; `SENHAUNICA_BASE_URL` permite um provedor alternativo HTTPS ou HTTP em localhost fora de produção. Frontend e `/api` devem compartilhar a origem, por proxy, com HTTPS em produção.

A tela consulta `/api/auth/providers` e oferece **Entrar com Senha Única USP**. O modo USP desabilita `POST /api/auth/login`. O modo local continua disponível quando não há configuração USP, com as contas demonstrativas já existentes.

## Identidade e autorização

- O número USP (`loginUsuario`) é a chave institucional única. Nome, e-mail e vínculos são atualizados a cada login e persistidos em `app_user`. Preferência de e-mail: `emailUspUsuario`, depois `emailPrincipalUsuario`.
- `DOCENTE`, ou `SERVIDOR`/`SERVIIDOR` com `tipoFuncao=Docente`, resulta em `PROFESSOR`. `ALUNO`, `ALUNOGR`, `ALUNOPOS`, `ALUNOCEU`, `ALUNOEAD`, `ALUNOPD` e `ALUNOCONVENIOINT` resultam em `ALUNO`. A comparação ignora maiúsculas e acentos. Docente tem precedência quando há múltiplos vínculos. Outros vínculos não dão acesso. As variações seguem a [referência de vínculos USPdev](https://github.com/uspdev/senhaunica-shield) e os [tipos institucionais](https://github.com/uspdev/replicado/blob/master/src/Pessoa.php).
- `AVALIADOR` continua uma atribuição local explícita: uma conta com esse papel conserva-o ao retornar com vínculo de aluno. A USP não atribui esse papel. Conta desativada continua desativada.
- Ter perfil de professor não concede turmas automaticamente. Grupos, turmas e atribuições são lidos do banco nas requisições autenticadas. Novos usuários começam sem grupo/turma. Mudanças no banco são refletidas nas permissões sem reiniciar a API.
- Contas antigas não são mescladas por e-mail. Antes do primeiro acesso, o administrador deve conferir a identidade e preencher `app_user.usp_number` na conta existente (por ID, em uma operação administrativa controlada). Isso preserva chaves estrangeiras de turmas, grupos e atribuições. E-mail já usado por outra conta impede o login até resolver a vinculação. Não preencha números USP por suposição.
- O callback exige token temporário correspondente a uma tentativa iniciada no mesmo navegador, cookie HttpOnly SameSite=Lax, prazo de dez minutos e consumo único. Tokens e segredos OAuth ficam só no servidor e não são expostos pela API. O callback cria cookie de sessão HttpOnly e redireciona para `/projetos`; falhas retornam ao login com mensagem recuperável. Mutações continuam exigindo CSRF e origem válida.

## Limites e validação

Identidades USP e vínculos de autorização estão integrados ao PostgreSQL. Projetos e metadados continuam no repositório em memória existente; no modo USP começam vazios para evitar associar exemplos aos IDs reais. A persistência de projetos/arquivos é uma etapa separada. Sessões, tentativas OAuth e limites ficam em memória: reinício exige novo login e múltiplas instâncias exigem armazenamento compartilhado/afinidade. O logout encerra a sessão do Labrary; não encerra a sessão de outros serviços USP.

`pnpm build`, `pnpm test` e `pnpm test:e2e` validam o fluxo local. Os E2E exercitam o OAuth via HTTP com um provedor isolado em `packages/api/integration/uspFixture.ts`, incluindo verificação independente das assinaturas, aluno, professor, vínculo recusado, recarga e logout em desktop e celular. Esse servidor só é iniciado pelo Playwright e não integra a inicialização de produção. Portas adicionais: 3004, 3005 e 5181.

O serviço oficial só pode ser validado com credenciais de consumidor e callback registrados na USP. Faça a verificação final entrando com uma conta real de aluno e uma de docente, conferindo `/api/auth/me`, vínculos de turma/grupo e logout após aplicar as migrations e configurar as variáveis.

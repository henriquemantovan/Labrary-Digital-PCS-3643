# API REST (TEC02 + HU01–HU12)

O [C0 — requisitos/rubricas](contratos/c0-requisitos-rubrica.md) define a configuração versionada. O [C2 — avaliação](contratos/c2-avaliacao.md) usa a rubrica da submissão C1 para registrar as avaliações que alimentam a consolidação C3.

Rotas REST usam JSON, exceto o envio de arquivos de materiais (`multipart/form-data`); início e retorno de OAuth fazem redirecionamentos HTTP. Listas e respostas individuais bem-sucedidas vêm no envelope `{ "data": ... }`; erros usam `{ "error": { "code", "message", "details?" } }`. O servidor responde `401` para ausência de sessão, `403` para operação não permitida/origem inválida, `429` para excesso de tentativas de login, `400` para validação, `404` para recurso/rota ausente, `409` para conflito de grupo e `500` para falhas inesperadas.

| Método | Rota | Uso | Sucesso |
| --- | --- | --- | --- |
| GET | `/api/auth/providers` | Opções disponíveis `{ google, local }` | `200` |
| GET | `/api/auth/google` | Inicia OpenID Connect no Google | `302` |
| GET | `/api/auth/google/callback` | Valida tentativa e cria sessão | `302` para `/cadastro`, `/projetos` ou `/login?authError=google` |
| POST | `/api/auth/login` | Autentica `{ email, password }` e emite cookie HttpOnly | `200 { data: PublicUser }` |
| POST | `/api/auth/profile` | Aluno Google USP confirma `{fullName, uspNumber, entryYear}` | `200 { data: PublicUser }` |
| GET | `/api/admin/guests` | ADMIN consulta autorizações de convidados e histórico de revogação | `200 { data: GuestInvitation[] }` |
| POST | `/api/admin/guests` | ADMIN autoriza `{email}` externo antes do login Google | `201 { data: GuestInvitation }` |
| DELETE | `/api/admin/guests/:invitationId` | ADMIN revoga autorização e sessões do convidado | `204` |
| POST | `/api/auth/view-role` | ADMIN seleciona `{ role: "ALUNO" | "AVALIADOR" | "PROFESSOR" | null }` para sua sessão | `200 { data: PublicUser }` |
| GET | `/api/admin/users` | ADMIN lista contas com ID, nome, e-mail, papel e estado | `200 { data: ManagedUser[] }` |
| PATCH | `/api/admin/users/:userId/role` | ADMIN altera `{ role: "ALUNO" | "AVALIADOR" | "PROFESSOR" | "ADMIN" }` | `200 { data: ManagedUser }` |
| GET | `/api/auth/me` | Restaura a sessão | `200 { data: PublicUser }` |
| POST | `/api/auth/logout` | Revoga a sessão e limpa o cookie (idempotente) | `204` |
| GET | `/api/scope` | Turmas/grupos permitidos, sem integrantes | `200 { data: { classes, groups } }` |
| GET | `/api/health` | Estado da API | `200 { data: { status: "ok" } }` |
| GET | `/api/projects?status=&classId=&groupId=&pending=` | Lista e filtra projetos | `200 { data: Project[] }` |
| POST | `/api/projects` | Cria projeto | `201 { data: Project }` |
| GET | `/api/projects/:projectId` | Consulta projeto | `200 { data: Project }` |
| GET | `/api/projects/:projectId/materials` | Lista materiais com versão atual e histórico | `200 { data: ProjectMaterial[] }` |
| GET | `/api/projects/:projectId/material-rules` | Formatos, tamanhos, prazo e se o usuário pode enviar | `200 { data: MaterialRules }` |
| POST | `/api/projects/:projectId/materials` | Registra material novo (versão 1) | `201 { data: ProjectMaterial }` |
| POST | `/api/projects/:projectId/materials/:materialId/versions` | Substitui material criando nova versão | `201 { data: ProjectMaterial }` |
| GET | `/api/projects/:projectId/materials/:materialId/versions/:versionId/file` | Baixa o arquivo de uma versão | `200` com o arquivo |
| GET | `/api/projects/:projectId/messages` | Consulta feedback privado | `200 { data: ProjectMessage[] }` |
| POST | `/api/projects/:projectId/messages` | Envia feedback privado | `201` ou `200` na repetição idêntica |

Todas as rotas de projetos, materiais e escopo exigem sessão válida. `GET /projects` aplica o escopo antes de retornar dados; filtros não ampliam acesso. Um projeto fora do escopo responde com o mesmo `404` de um projeto inexistente. Apenas professor cria projetos para grupos da própria turma; apenas aluno do grupo registra metadados enquanto o projeto está em Preparação/Ajustes (`409 PROJECT_LOCKED` nos demais estados).

`PublicUser` contém `id`, `fullName`, `email`, `role`; contas Google incluem `googleLinked: true`. Segredos OAuth não são retornados. Em modo Google, o login local responde `403 LOCAL_LOGIN_DISABLED`. Veja [configuração Google e migrations](login-google.md). Credenciais inválidas/inativas retornam `401 INVALID_CREDENTIALS`, sempre com `E-mail ou senha inválidos.`. Cada POST exige o cabeçalho `X-CSRF-Protection: 1`; `Origin`, se informado, deve ser igual a `APP_ORIGIN`. Não há CORS. Use a mesma origem para frontend e `/api`.

Contas Google também recebem `guest`, `uspNumber`, `entryYear` e `requiresAcademicProfile`. NUSP e ano ficam nulos antes do preenchimento; esses campos são da própria conta e não entram no catálogo ou nas listas de integrantes. A API exige `@usp.br` ou convite vigente; validar o domínio só na interface não autoriza a conta. Aluno USP sem cadastro completo recebe `403 ACADEMIC_PROFILE_REQUIRED` em projetos, turmas e escopo. `/auth/me`, `/auth/profile` e logout continuam disponíveis para concluir o cadastro ou sair.

O cadastro usa nome completo com duas partes, NUSP numérico de até 32 dígitos e ano inteiro entre 1900 e o ano atual. Dados inválidos recebem 400; NUSP de outra conta recebe `409 USP_NUMBER_IN_USE`. Autor, conta e papel não são aceitos no corpo. Convites são exclusivos de ADMIN: `GuestInvitation` contém `id,email,invitedBy,createdAt,revokedAt,revokedBy`, sem conceder permissões acadêmicas. Convite inexistente recebe 404, e tentativa de revogar o próprio convite administrativo recebe `409 OWN_INVITATION`. Novos registros e revogações conservam histórico no PostgreSQL.

As respostas da API incluem `Cache-Control: no-store`. Veja [HU01](hu01.md) para matriz de permissões, configurações, contas e ciclo da sessão.

Exemplo de criação de projeto:

```json
{
  "classId": 1,
  "groupId": 3,
  "title": "Contador síncrono",
  "description": "Contador módulo dez com reset síncrono.",
  "category": "Lógica digital"
}
```

Exemplo de erro:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "A requisição contém dados inválidos.",
    "details": [{ "path": "title", "message": "Too small: expected string to have >=1 characters" }]
  }
}
```

`ProjectMaterial` contém `id`, `projectId`, `kind`, `title`, `createdBy`, `createdAt`, `currentVersion` e `versions` (da mais recente para a mais antiga). Cada versão traz `versionNumber`, `originalFilename`, `mimeType`, `sizeBytes`, `checksumSha256`, `uploadedBy { id, fullName }`, `uploadedAt` e `downloadUrl`; a chave interna de armazenamento não é exposta. Criar um material com o mesmo tipo e título (sem diferenciar maiúsculas) responde `409 MATERIAL_ALREADY_EXISTS`: a substituição usa a rota de versões, que nunca apaga versões anteriores. Material inexistente ou de outro projeto responde `404 MATERIAL_NOT_FOUND`.

`MaterialRules` contém `dueAt`, `lock` (`null`, `PROJECT_LOCKED` ou `DEADLINE_PASSED`), `canUpload` e `rules` (por tipo: `kind`, `defaultTitle`, `required`, `formats[{ label, mimeType, extensions }]`, `maxSizeBytes`). A política usa os requisitos da rubrica vigente; sem configuração, aplica os padrões: vídeo MP4/WebM até 500 MB; relatório e manual PDF até 20 MB; outros PDF/ZIP/PNG/JPEG até 50 MB. A entrega está aberta em Preparação antes de `dueAt` e em Ajustes (reabertura pelo professor, mesmo após o prazo). Envios recusados respondem `400 EMPTY_FILE`, `413 FILE_TOO_LARGE`, `415 UNSUPPORTED_FORMAT` (tipo ou extensão fora da regra) ou `409 DEADLINE_PASSED`.

**Envio de arquivos.** `POST …/materials` e `POST …/materials/:materialId/versions` recebem `multipart/form-data` com **um** arquivo no campo `file`. Na criação, o campo `kind` deve vir **antes** do arquivo (define o limite aplicado durante o envio); `title` é opcional (padrão: título sugerido do tipo). A substituição não aceita outros campos (`400 UNEXPECTED_FIELD`). O servidor:

- recusa antes de ler o corpo se o `Content-Length` já excede o limite do tipo (`413`);
- grava em streaming no armazenamento privado configurado (disco ou R2, com temporário local limitado), interrompendo ao passar do limite (`413 FILE_TOO_LARGE`);
- identifica o formato pelos bytes iniciais (PDF, MP4, WebM, ZIP, PNG, JPEG), ignorando o `Content-Type` do navegador; formato ou extensão fora da regra → `415 UNSUPPORTED_FORMAT`; arquivo vazio → `400 EMPTY_FILE`;
- registra tamanho real e SHA-256 da versão;
- apaga o arquivo recebido em qualquer recusa, inclusive se a entrega fechar durante o envio.

Erros de formato do envio: `400 MULTIPART_REQUIRED`, `FILE_REQUIRED`, `UNEXPECTED_FILE`, `TOO_MANY_FILES`, `TOO_MANY_FIELDS`, `FIELD_TOO_LONG` e `INVALID_MULTIPART`.

Exemplo: `curl -b cookies.txt -H 'X-CSRF-Protection: 1' -F kind=RELATORIO -F 'file=@relatorio.pdf' http://localhost:3000/api/projects/2/materials`.

**Download privado.** `GET …/versions/:versionId/file` exige sessão e acesso de leitura ao projeto (integrantes do grupo, avaliadores atribuídos e professor da turma). O arquivo vem com `Content-Disposition: attachment` (nome original em UTF-8), o `Content-Type` detectado no envio, `X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src 'none'; sandbox` e `Cache-Control: no-store`. Projeto fora do escopo → `404 PROJECT_NOT_FOUND`; material, versão ou arquivo ausente → `404 FILE_NOT_FOUND`. Essa rota permanece privada após publicação; bytes públicos autorizados usam a rota própria C4.

A HU01 autentica e autoriza estas rotas. O entrypoint da API persiste projetos, materiais com suas versões e mensagens em arquivo privado desde a HU07; os bytes dos arquivos ficam em `UPLOAD_DIR` ou no bucket privado R2, conforme `STORAGE_PROVIDER`. Sem snapshot anterior, no modo local há seed; no modo Google iniciam vazios. Identidades, vínculos de autorização, sessões e tentativas OAuth usam PostgreSQL no modo Google; no modo local, sessões ficam em memória.

No modo R2, uploads também podem responder `507 STORAGE_CAPACITY_LIMIT` ao atingir o limite total do bucket. Operações de arquivo e verificações de publicação podem responder `503 STORAGE_OPERATION_LIMIT` ao esgotar o orçamento mensal local ou `503 STORAGE_UNAVAILABLE` quando o provedor falha. Não são devolvidos endpoint, credenciais ou links diretos para o bucket; URLs e permissões dos materiais continuam iguais. Os limites locais não equivalem a um bloqueio de cobrança da Cloudflare. Veja [configuração R2 e franquia](arquitetura.md#cloudflare-r2-e-controle-da-franquia-gratuita).

## Acompanhamento — HU06

`GET /projects` combina os filtros opcionais `classId`, `groupId` (inteiros positivos), `status` (estado existente) e `pending` (somente `true` ou `false`). Filtros inválidos ou desconhecidos recebem `400 VALIDATION_ERROR`. A autorização por atribuição é aplicada antes do cálculo das pendências; filtros nunca ampliam o escopo.

Lista, detalhe e criação retornam os campos de `Project`, mais `groupName` e `missingMaterials`: array dos tipos obrigatórios ausentes, na ordem `VIDEO`, `RELATORIO`, `MANUAL`. Um tipo está presente quando existe ao menos uma versão de seus metadados; `OUTRO` não substitui requisito obrigatório. `pending=true` seleciona ao menos um tipo ausente; `pending=false` seleciona nenhum. Isso não comprova submissão completa. Requisitos configuráveis e prazos dependem da HU03/HU05.

`GET /projects/:projectId/materials` permite ao avaliador atribuído consultar todas as versões registradas, inclusive em Preparação/Ajustes, sem permitir alterações. Acesso fora da atribuição recebe `404` tanto no detalhe quanto nos materiais. Revogar a atribuição bloqueia a próxima requisição. As respostas de projeto selecionam explicitamente os campos de acompanhamento; notas e comentários não fazem parte desse contrato.

Rotas privadas continuam exigindo sessão mesmo para projetos Finalizados. A consulta pública usa o C4 em `/api/catalog`, com seleção explícita de versões; não reutiliza o download privado da HU04. Veja [escopo da HU06](api-inicial.md) e [integração da publicação](hu11.md).

## Feedback privado — HU07

As rotas de mensagens exigem sessão, escopo de leitura do projeto e, em POST, proteção CSRF. Aluno do grupo, avaliador atribuído e professor da turma podem enviar em qualquer estado. Projetos fora do escopo retornam 404; filtros e IDs não ampliam autorização.

Envio: `{ "clientMessageId": "UUID", "body": "Texto de 1 a 5000 caracteres", "materialVersionId": 1 }`. `materialVersionId` é opcional/nulo para contexto geral; quando presente, referencia o `id` de uma versão retornada por `/projects/:projectId/materials` e deve pertencer ao mesmo projeto. Esse ID da base atual de metadados não deve ser confundido com os IDs do schema PostgreSQL planejado.

`ProjectMessage` contém `id`, `projectId`, `clientMessageId`, `author: { id, fullName, role }`, `body`, `createdAt` ISO UTC e `materialVersion: { id, title, versionNumber } | null`. Autor/data/contexto são definidos pelo servidor e preservados; e-mail e dados internos não são expostos. Lista em ordem crescente de data, com ID como desempate. O corpo é texto, não HTML; clientes devem exibi-lo escapado.

Projeto + autor + `clientMessageId` identificam uma tentativa lógica: criação retorna 201; repetição com mesmo texto normalizado e contexto retorna 200 com a mensagem original; payload diferente com a mesma chave retorna `409 MESSAGE_ID_CONFLICT`. Campos adicionais, UUID inválido, texto vazio/excessivo ou ID malformado recebem 400; contexto inexistente/de outro projeto recebe `404 MATERIAL_NOT_FOUND`. Falha de armazenamento retorna 500 sem atualizar o estado em memória.

Persistência do servidor em `.data/projects-<modo>.json`, substituição atômica de snapshot, um processo escritor; `PROJECT_DATA_FILE` configura outro caminho. Não há alterações no schema PostgreSQL; os bytes dos materiais ficam em `UPLOAD_DIR`. Sessões do modo Google usam PostgreSQL; no modo local continuam em memória. Limites e roteiro em [docs/hu07.md](hu07.md).

## Login Google

`GET /api/auth/google` emite cookie HttpOnly `labrary_google` SameSite=Lax com validade de dez minutos e redireciona para o Google. `GET /api/auth/google/callback` valida state/cookie, consome a tentativa de uso único, troca o código com PKCE, verifica o ID token e persiste a conta e a sessão. Retorna `302` para `/projetos`, ou `/login?authError=google|inactive|account_conflict`. Não aceita papel ou identidade enviados pelo navegador. O e-mail precisa ser verificado. Novas contas recebem `ALUNO`; papéis existentes são mantidos.

O cookie `labrary_session` é HttpOnly, SameSite=Lax e Secure em produção; só seu SHA-256 fica no banco. A sessão é restaurada em `/auth/me`, tem expiração absoluta de oito horas, pode ser usada entre instâncias e é revogada no logout/desativação. `POST /auth/logout` mantém proteção CSRF e revogação idempotente. Tokens Google e segredos não são retornados nem persistidos. A API não oferece cadastro por senha no modo Google.

## Administração e visualização de perfis

O papel `ADMIN` é persistido em `app_user.role`, mantido pelos próximos logins Google e não atribuído a cadastros novos. A área `/administracao` permite buscar contas, atualizar a lista e alterar perfis, inclusive promover administradores. Não aceita alteração de estado, e-mail, identificador Google ou autor da ação. A API exige sessão ativa de um administrador real, CSRF e origem válida. Dados de credenciais não aparecem na listagem.

`PublicUser.role` sempre informa o papel real da conta. Administradores podem receber `viewRole` com o perfil acadêmico selecionado na sessão. `/auth/view-role` persiste a escolha no banco por sessão; `null` retorna à administração. A API usa o perfil selecionado nas autorizações acadêmicas, com os vínculos da própria conta. Não troca usuário nem simula a identidade de outra pessoa. Administradores continuam podendo acessar a gestão de contas durante a prévia; usuários comuns não podem selecionar perfis. Mensagens registram o autor e o papel real, inclusive quando enviadas na prévia.

Na visão administrativa, ADMIN vê todos os projetos, turmas e grupos e pode criar projetos para grupos existentes. Registro de materiais conserva as regras de aluno/grupo/estado: a administração não ignora essas regras. Mudar apenas a visualização não cria vínculos com turma, grupo ou projeto.

Mudanças de papel usam transação com bloqueio para impedir que remoções concorrentes deixem zero administradores ativos. Remover o último ADMIN ativo retorna `409 LAST_ADMIN`. A transação limpa as prévias das sessões da conta alterada e registra autor, alvo, papel anterior, novo papel e data em `user_role_audit`. Um administrador destituído perde acesso administrativo na próxima requisição. O estado das contas e os vínculos acadêmicos são preservados.


## Grupos e vínculos — HU02 / S5

Rotas implementadas, com sessão e CSRF nas mutações:

| Método e rota | Entrada ou resposta `data` |
| --- | --- |
| `GET /api/classes/:classId/administration` | `{groups: ManagedGroup[], people: Person[]}` |
| `POST /api/classes/:classId/groups` | `{name}` → `201 {id,classId,name,memberIds:[]}` |
| `PUT /api/classes/:classId/groups/:groupId/members` | `{memberIds:number[]}` → grupo com `history` |
| `GET /api/projects/:projectId/evaluators` | `{evaluatorIds:number[],history:LinkChange[]}` |
| `PUT /api/projects/:projectId/evaluators` | `{evaluatorIds:number[]}` → atribuições com `history` |

`ManagedGroup` tem `id,classId,name,memberIds,history`. `Person` tem somente `id,fullName,role` (`ALUNO`, `AVALIADOR` ou `ADMIN`). A seleção é feita entre contas ativas provisionadas; nenhuma senha, e-mail ou identidade Google é exposta. `LinkChange` contém `target` (`GROUP`/`PROJECT`), `targetId`, `before`, `after`, `changedBy` e `changedAt` ISO UTC. O autor é a conta autenticada real, inclusive em prévia de ADMIN.

IDs são inteiros positivos seguros; listas aceitam até 200 IDs únicos e podem ser vazias para remover todos os vínculos. Nome é normalizado com trim, tem 1–120 caracteres e é único na turma. Campos extras são recusados. Repetir um mesmo conjunto não duplica auditoria. Integrantes precisam de perfil ALUNO/ADMIN; avaliadores de AVALIADOR/ADMIN, sempre ativos.

Professor gerencia somente a própria turma; ADMIN sem prévia gerencia todas. Prévia acadêmica usa o perfil e vínculos efetivos. Papel inadequado recebe `403 FORBIDDEN`; turma/projeto fora do escopo recebem `404 CLASS_NOT_FOUND` / `PROJECT_NOT_FOUND`; grupo inexistente ou de outra turma no caminho recebe `404 GROUP_NOT_FOUND`. Dados inválidos recebem `400 VALIDATION_ERROR`; conta inexistente, inativa ou de perfil incompatível recebe `400 INVALID_LINK`; nome duplicado recebe `409 GROUP_EXISTS`. Sem sessão: 401; CSRF/origem inválidos: 403. Remoção revoga leitura na próxima requisição da mesma sessão.

A resposta privada de projeto também informa `academicYear`, derivado da turma (nulo se o diretório não tiver a turma). Persistência e decisão transitória da FK de avaliadores estão em [HU02](hu02.md). O [contrato público C4](contratos/c4-publicacao.md) documenta as rotas implementadas do catálogo/publicação.


## Finalização e publicação — HU11 / S7

Rotas implementadas: `GET /api/projects/:projectId/publication`, `POST /api/projects/:projectId/finalization`, `POST/DELETE /api/projects/:projectId/publication`; consulta anônima em `GET /api/catalog`, `GET /api/catalog/:projectId` e `GET/HEAD /api/catalog/:projectId/materials/:versionId/file`. Contratos, seleção, autorização do grupo e erros estão no [C4 atualizado](contratos/c4-publicacao.md).

As rotas privadas exigem sessão, perfil docente/ADMIN, turma e CSRF nas mutações. A factory conecta `createSubmissionProvider(repository)` ao C1 persistido e `createPublicationEvaluationProvider(evaluations, resultReleases)` ao mesmo C2/C3 usado na consolidação. O entrypoint usa o repositório real de avaliações; não injeta fixtures nem assume conclusão. Prontidão incompleta recebe 409; na factory sem fonte de avaliações, ou diante de erro de leitura dos provedores, novas decisões recebem 503. Retirada e leitura de publicações previamente registradas não dependem desses provedores. C1/C3 são relidos depois das verificações assíncronas dos arquivos, recusando devolução, troca de rodada ou reabertura concorrente.

Decisões, snapshot finalizado e projeção pública são preservados no arquivo privado dos projetos. Finalizado continua privado até publicar. Retirada conserva os dados privados e bloqueia listagem/detalhe/bytes de novas requisições. Vídeo suporta um Range e reprodução inline; documentos usam attachment; HEAD não envia corpo. Veja [persistência, interfaces C1/C3, limites e testes](hu11.md).

## Consolidação e resultados (HU09, #36/#41)

`GET /api/classes/:classId/grades` retorna a tabela privada docente; `?format=csv` exporta a mesma projeção. `GET /api/projects/:projectId/results/consolidation` fornece resultado e token de confirmação docente; `POST /api/projects/:projectId/results/release` libera explicitamente a revisão confirmada. `GET /api/projects/:projectId/result` restringe o resultado liberado aos integrantes do grupo e omite notas enquanto bloqueado. Sessão, escopo da turma, CSRF e `no-store` são obrigatórios. Contratos, erros, tipos e exemplos em [C3](contratos/c3-consolidacao.md).

O servidor conecta o provedor de avaliações persistidas da HU08. A reabertura de uma avaliação, a alteração da lista de avaliadores previstos e uma nova rodada invalidam a liberação anterior. Liberações usam arquivo privado `RESULT_RELEASE_DATA_FILE`, separado de `EVALUATION_DATA_FILE`.

## Submissão — HU05 / S6

Contrato completo, regras e exemplos em [C1 — submissão e rodada](contratos/c1-submissao.md). Sessão obrigatória; os POST exigem `X-CSRF-Protection: 1`. Projeto fora do escopo de leitura responde `404 PROJECT_NOT_FOUND`.

| Método e rota | Quem | Sucesso |
| --- | --- | --- |
| `GET /api/projects/:projectId/submission-checklist` | Quem lê o projeto | `200 { data: SubmissionChecklist }` |
| `GET /api/projects/:projectId/submissions` | Quem lê o projeto | `200 { data: Submission[] }`, por rodada crescente |
| `GET /api/projects/:projectId/submissions/:submissionId` | Quem lê o projeto | `200 { data: Submission }` |
| `POST /api/projects/:projectId/submissions` | Aluno do grupo | `{ clientSubmissionId: uuid }` → `201` (rodada nova) ou `200` (repetição) |
| `POST /api/projects/:projectId/submissions/:submissionId/return` | Professor da turma ou ADMIN | `200 { data: Submission }` devolvida |
| `POST /api/projects/:projectId/reopen` | Professor da turma ou ADMIN | `{ reason }` (5–1000 caracteres) → `201 { data: Reopening }` |

`SubmissionChecklist` contém `projectStatus`, `rubricVersionId` (`null` sem C0), `items` (`kind`, `label`, `materialId`, `versionId`, `ok`), `blockedBy` (código do erro que o POST devolveria, ou `null`), `canSubmit`, `canReopen` e `lastReopening` (última reabertura ou `null`). Erros: `403 FORBIDDEN` (papel), `400 VALIDATION_ERROR`, `404 SUBMISSION_NOT_FOUND` e `409` com `RUBRIC_NOT_CONFIGURED`, `SUBMISSION_LOCKED`, `DEADLINE_PASSED`, `INCOMPLETE_SUBMISSION`, `SUBMISSION_NOT_RETURNABLE` ou `REOPEN_NOT_ALLOWED`.

Submeter muda o projeto para `EM_AVALIACAO`, o que bloqueia uploads (`409 PROJECT_LOCKED`). Devolver muda a rodada para `DEVOLVIDA` e o projeto para `AJUSTES`; o próximo envio cria a rodada seguinte. Reabrir vale só em `PREPARACAO` com prazo vencido: registra quem, quando e a justificativa e muda o projeto para `AJUSTES`, onde os prazos originais não se aplicam. As rodadas ficam no mesmo arquivo privado dos projetos (`PROJECT_DATA_FILE`), gravadas junto com o estado do projeto.

## Avaliação — HU08 / C2

As rotas abaixo usam o prefixo `/api/projects/:projectId/submissions/:submissionId/evaluations`. Todas exigem sessão; as mutações exigem também CSRF e origem válida.

| Método e sufixo | Quem | Entrada e resposta `data` |
| --- | --- | --- |
| `GET` | Avaliador atribuído, professor da turma ou ADMIN | `{submission, evaluations, canEdit, canReopen, evaluatorNames?}` |
| `PUT /me` | Avaliador atribuído | `{scores, expectedRevision}` → rascunho |
| `POST /me/finalize` | Avaliador atribuído | `{scores, expectedRevision}` → avaliação finalizada |
| `POST /:evaluatorId/reopen` | Professor da turma ou ADMIN | `{reason, expectedRevision}` → avaliação reaberta |

O avaliador recebe somente o próprio registro. Docentes podem consultar a turma, inclusive registros históricos de avaliadores removidos. Uma avaliação pendente tem revisão 0 e lista de notas vazia. As mutações incrementam a revisão e retornam a avaliação atualizada. A justificativa tem de 1 a 2000 caracteres após trim. Somente a última submissão em avaliação aceita alterações. O [contrato C2](contratos/c2-avaliacao.md) detalha estados, falhas, persistência e integração.

## Leitura do grupo — integração do PR #54

A tela do aluno consome `/api/projects/:projectId/result` do contrato de consolidação da HU09, respeitando `resultReleased`. O acervo usa `/api/catalog` e os arquivos públicos autorizados da HU11. Os provedores opcionais `readProviders` e `/api/public/projects` permanecem como contrato experimental injetável; não substituem o acervo em produção.

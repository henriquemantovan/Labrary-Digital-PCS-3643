# C1 — submissão e rodada

Produtor: Enzo (#33/#38, HU04/HU05). Consumidores: Yuhang (#39, avaliação) e Henrique (#37, publicação). A S5 (#33) entregou **schema, regras isoladas e exemplos**; a S6 (#38) acrescenta **rotas HTTP, persistência e a interface** (seções [Rotas](#rotas), [Persistência](#persistência) e [Interface](#interface)). O acordo com os consumidores ainda não foi confirmado.

## Campos

`packages/api/src/models/submission.ts` exporta `submissionSchema` e o tipo `Submission`:

| Campo | Significado |
| --- | --- |
| `id` | `submissionId` usado em C2 |
| `projectId`, `round` | Projeto e rodada; a primeira é 1, e cada reenvio após devolução soma 1 |
| `clientSubmissionId` | UUID da tentativa lógica; repetir o envio devolve a rodada existente |
| `status` | `SUBMETIDA` ou `DEVOLVIDA` (devolvida para ajustes) |
| `submittedBy`, `submittedAt` | Aluno e data ISO UTC da submissão |
| `returnedAt` | Data da devolução; `null` enquanto `SUBMETIDA` |
| `rubricVersionId`, `rubric` | ID e cópia completa da versão [C0](c0-requisitos-rubrica.md) vigente na submissão |
| `materials` | Versão mais recente de cada material no momento da submissão |

Cada item de `materials` contém `materialId`, `kind`, `title`, `versionId`, `versionNumber`, `originalFilename`, `mimeType`, `sizeBytes` e `checksumSha256`. `storageKey` não faz parte do contrato; os bytes são lidos pela rota autenticada de download da versão.

Materiais e rubrica não mudam depois da submissão; só `status` e `returnedAt` mudam na devolução. O schema recusa rubrica de outro projeto ou versão, estado incompatível com `returnedAt`, material repetido e requisito de C0 sem material.

## Regras

`services/submissionRules.ts`:

- `submissionChecklist(requirements, materials)` informa, para cada requisito C0, o material e a versão mais recente, e `ok` quando o formato e o tamanho atendem ao requisito.
- `prepareSubmission(input)` monta o snapshot sem gravar nada. Na ordem:
  1. `clientSubmissionId` já usado: devolve a rodada existente (`repeated: true`).
  2. Sem C0 configurado: `409 RUBRIC_NOT_CONFIGURED`.
  3. Projeto fora de `PREPARACAO`/`AJUSTES`: `409 SUBMISSION_LOCKED`.
  4. Em `PREPARACAO`, depois do prazo do projeto ou de algum requisito: `409 DEADLINE_PASSED`. Em `AJUSTES` (reabertura pelo professor), os prazos não se aplicam.
  5. Checklist com pendências: `409 INCOMPLETE_SUBMISSION`, com os nomes dos materiais pendentes.

O repositório (`projectRepository.ts`) faz as mudanças de estado:

- `createSubmission`: grava a rodada e muda o projeto para `EM_AVALIACAO`, o que bloqueia uploads (`uploadLock`).
- `returnSubmission`: só aceita a rodada mais recente, com status `SUBMETIDA` e projeto em `EM_AVALIACAO` (`409 SUBMISSION_NOT_RETURNABLE` nos demais casos). Marca `DEVOLVIDA` com `returnedAt` e muda o projeto para `AJUSTES`. Não há campo de motivo.

## Rotas

Prefixo `/api`; sessão obrigatória; POST com `X-CSRF-Protection: 1`. Projeto fora do escopo de leitura responde `404 PROJECT_NOT_FOUND`.

| Rota | Quem | Resposta |
| --- | --- | --- |
| `GET /projects/:projectId/submission-checklist` | Quem lê o projeto | `{ projectStatus, rubricVersionId, items, blockedBy, canSubmit }` |
| `GET /projects/:projectId/submissions` | Quem lê o projeto | Rodadas em ordem crescente |
| `GET /projects/:projectId/submissions/:submissionId` | Quem lê o projeto | Uma rodada; `404 SUBMISSION_NOT_FOUND` se não for do projeto |
| `POST /projects/:projectId/submissions` | Aluno do grupo (`403` para os demais) | Body `{ clientSubmissionId }` (UUID, sem outros campos); `201` com a rodada nova ou `200` com a rodada existente na repetição |
| `POST /projects/:projectId/submissions/:submissionId/return` | Professor da turma ou ADMIN (`403` para os demais) | `200` com a rodada devolvida |

`blockedBy` é o código que o POST devolveria naquele momento (mesma função `prepareSubmission`, sem gravar); `canSubmit` também exige que o usuário seja aluno do grupo. `submittedBy` é a conta autenticada real, mesmo em prévia de ADMIN. A repetição vale para qualquer integrante do grupo que reenvie o mesmo `clientSubmissionId`.

## Persistência

As rodadas ficam no campo `submissions` do mesmo arquivo privado de projetos (`PROJECT_DATA_FILE`). Submeter e devolver gravam a rodada e o novo estado do projeto numa única escrita (arquivo temporário + renomeação), então uma falha não deixa rodada sem mudança de estado. Na carga, cada rodada é validada com `submissionSchema`; arquivo inválido impede a inicialização e não é sobrescrito. Arquivos anteriores à HU05, sem `submissions`, carregam com histórico vazio. O backup continua sendo o arquivo de projetos junto com grupos, rubricas e `UPLOAD_DIR`.

Observação para demonstrações: no seed local, o projeto 1 começa em `EM_AVALIACAO` sem nenhuma rodada. Use o projeto 2 (`PREPARACAO`) para o fluxo completo.

## Interface

`packages/web/src/Submission.tsx` (`SubmissionPanel`) aparece no detalhe do projeto, abaixo dos materiais, para todos que leem o projeto. Mostra o checklist (presente com versão, ausente ou fora do formato/tamanho), o motivo do bloqueio (`blockedBy`) e o histórico de rodadas com link de download de cada versão submetida. O aluno do grupo vê **Submeter para avaliação** com confirmação; o professor da turma ou ADMIN vê **Devolver para ajustes** quando a última rodada está `SUBMETIDA`. O `clientSubmissionId` é reutilizado quando o envio falha por rede e descartado quando a API responde. Depois de submeter ou devolver, a tela atualiza o estado do projeto e recarrega as regras de upload. O fluxo completo está em `e2e/submission.spec.ts` (desktop e mobile).

## Exemplos

`packages/api/src/test/submissionContractExamples.ts` exporta `submissionContractExamples()` com `submitted` (rodada 1), `returned` (rodada 1 devolvida) e `resubmitted` (rodada 2, com o manual na versão 2). Os IDs de materiais e versões vêm do repositório em memória, e o snapshot é montado por `prepareSubmission`. Projeto 1, submissão 11, rodada 1 e rubrica 1 coincidem com os exemplos [C2](c2-avaliacao.md). Os exemplos existem só para testes.

`models/submission.test.ts` e `services/submissionRules.test.ts` verificam o schema, a coerência com C2 e as regras. `routes/submissionRoutes.test.ts` verifica as rotas (autorização, erros, snapshot validado com `submissionSchema`, repetição e duas rodadas), e `repositories/fileProjectStorage.test.ts` verifica reinício, arquivos antigos, arquivo inválido e falha de gravação.

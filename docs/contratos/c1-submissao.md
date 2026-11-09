# C1 — submissão e rodada

Produtor: Enzo (#33/#38, HU04/HU05). Consumidores: Yuhang (#39, avaliação) e Henrique (#37, publicação). Esta entrega da S5 contém **schema, regras isoladas e exemplos**. Rotas, interface e persistência das submissões ficam para a S6 (#38). O acordo com os consumidores ainda não foi confirmado.

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

A mudança do projeto para `EM_AVALIACAO`, que já bloqueia uploads (`uploadLock`), e a devolução para `AJUSTES` serão feitas pelo serviço da S6.

## Exemplos

`packages/api/src/test/submissionContractExamples.ts` exporta `submissionContractExamples()` com `submitted` (rodada 1), `returned` (rodada 1 devolvida) e `resubmitted` (rodada 2, com o manual na versão 2). Os IDs de materiais e versões vêm do repositório em memória, e o snapshot é montado por `prepareSubmission`. Projeto 1, submissão 11, rodada 1 e rubrica 1 coincidem com os exemplos [C2](c2-avaliacao.md). Os exemplos existem só para testes.

`models/submission.test.ts` e `services/submissionRules.test.ts` verificam o schema, a coerência com C2 e as regras.

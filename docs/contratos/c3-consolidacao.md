# C3 — Consolidação e liberação de resultados

Versão 1, Kauê, 12/11/2026, tarefas #36/#41 e HU09/#9. Consumidores: Dan (#40, resultado do grupo) e Henrique (#37, completude para finalização). O servidor usa o [C2 de Yuhang](c2-avaliacao.md) sobre avaliações persistidas (#39).

## Porta de entrada e cálculo

[`EvaluationProvider`](../../packages/api/src/models/consolidation.ts) oferece `getCurrentRound(projectId): Promise<EvaluationContract | undefined>`. Retorna um snapshot coerente da rodada atual com rubrica histórica, avaliadores previstos e avaliações. `undefined` indica que não há rodada submetida ativa, por exemplo antes do primeiro envio ou após devolução para ajustes. Erros do provedor devem ser lançados. O serviço usa os materiais e a rubrica congelados na submissão, e obtém as permissões na sessão autenticada.

[`consolidate(projectId, input?)`](../../packages/api/src/services/consolidation.ts) valida o schema C2 e usa `validateEvaluationScores` do produtor, exigindo todos os critérios nas avaliações `FINALIZADA`. Rejeita pesos inválidos, escala fora de 0–10, notas não finitas, IDs repetidos/desconhecidos, avaliadores não previstos e associação a outro projeto. Rubricas e avaliações não são modificadas.

Nota por avaliador = soma(nota × peso / 100). A nota da rodada é a média das avaliações **finalizadas e previstas**, sem arredondamentos intermediários. Zero finalizado entra na média; ausente, `PENDENTE`, `RASCUNHO` e `REABERTA` são pendências. O cálculo usa números JavaScript sem truncamento; precisão segue IEEE 754. Somente tabela/CSV usam `toFixed(2)`.

## DTO privado

Schemas executáveis: `consolidatedResultSchema` e `gradeRowSchema`, no [módulo C3](../../packages/api/src/models/consolidation.ts). [Exemplos JSON compartilhados](c3-exemplos.json) são gerados por `src/test/consolidationContractExamples.ts` usando os mesmos exemplos C2 do produtor, e verificados na API e na web.

| Campo | Significado |
| --- | --- |
| `projectId`, `submissionId`, `round`, `rubricVersionId` | IDs da rodada; os três últimos são `null` antes da submissão |
| `expectedEvaluatorIds` / `receivedEvaluatorIds` / `pendingEvaluatorIds` | Previstos, finalizados e pendentes; contagens são os comprimentos das listas |
| `evaluatorGrades` | `{evaluatorId, grade}` das avaliações finalizadas, com precisão interna |
| `grade` | Média disponível, inclusive parcial; `null` quando nenhuma finalizou |
| `finalGrade` | Média somente com todas concluídas; `null` enquanto houver pendência |
| `status` | `NO_SUBMISSION`, `PENDING`, `PARTIAL` ou `FINAL` |
| `allEvaluationsCompleted` | Sinal de todas as avaliações concluídas, separado da liberação |
| `resultReleased` | Decisão explícita válida para o snapshot exato atual |

`GradeRow` acrescenta `groupId`, `groupName` e `title`. Sem submissão, as listas da rodada são vazias. Uma submissão sem avaliadores previstos permanece pendente.

`allEvaluationsCompleted` corresponde a “todasAvaliacoesConcluidas” do plano; `resultReleased`, a “resultadoLiberado”. São nomes definitivos desta proposta de DTO. Nenhum desses campos autoriza publicação de materiais. Finalização ainda precisa verificar a entrega C1 e publicação exige autorização própria C4.

## HTTP e permissões

| Método e rota | Resposta |
| --- | --- |
| `GET /api/classes/:classId/grades` | `{data: GradeRow[]}`, somente professor da turma/ADMIN efetivo |
| `GET /api/classes/:classId/grades?format=csv` | CSV UTF-8 com BOM, vírgulas, CRLF, aspas escapadas e proteção contra fórmulas |
| `GET /api/projects/:projectId/results/consolidation` | `{data: {result: ConsolidatedResult, fingerprint: string|null}}`, acesso docente; confirmação e sinal C3 para consumidor autorizado |
| `POST /api/projects/:projectId/results/release` | Corpo `{submissionId, fingerprint}`, resposta `{data: ConsolidatedResult}` liberado |
| `GET /api/projects/:projectId/result` | Consulta somente dos integrantes: `{data: {projectId,resultReleased:false}}` enquanto bloqueado; após liberação, resultado + `rubric` + `evaluations: [{evaluatorId,scores}]` |

Professor acessa sua turma; ADMIN segue as regras existentes, inclusive vínculos do perfil de prévia. Aluno/avaliador recebem 403 na consolidação/CSV. Outro grupo ou turma recebe 404 sem dados. O resultado do aluno omite histórico interno, revisões anteriores e fingerprint; comentários/notas só são enviados depois da liberação. O `GroupResult` exportado descreve os dois formatos para Dan.

Todas as rotas passam pela sessão do servidor, usam `Cache-Control: no-store` e envelopes de erro existentes. A mutação exige CSRF/origem válida. O corpo da liberação é apenas uma confirmação: o servidor relê o provedor e calcula a nota; não aceita nota, papel ou flag de liberação enviados pelo cliente.

Erros: 400 `VALIDATION_ERROR`; 401 `UNAUTHENTICATED`; 403 `FORBIDDEN`/`INVALID_ORIGIN`; 404 `CLASS_NOT_FOUND`/`PROJECT_NOT_FOUND`; 409 `EVALUATIONS_INCOMPLETE` sem todas as avaliações, ou `RESULT_VERSION_CONFLICT` quando a tela ficou antiga; 503 `EVALUATIONS_UNAVAILABLE` sem adapter configurado. Falhas inesperadas usam o envelope 500 existente. Uma falha de consulta não significa nota zero ou ausência de submissão.

## Persistência e revogação por mudança da avaliação

O repositório [de liberações](../../packages/api/src/repositories/resultReleaseRepository.ts) conserva projeto, submissão, rodada, fingerprint SHA-256 do C2 validado, autor e data. É idempotente para o mesmo conteúdo e preserva decisões anteriores. Cada requisição compara o snapshot atual com a decisão persistida; reabertura, nova revisão, mudança de avaliadores, rubrica ou rodada oculta o resultado até nova liberação. O produtor deve incrementar `evaluation.revision` em toda alteração, inclusive refinalização com notas iguais. A ordem do DTO integra o fingerprint: mantenha ordenação estável no adapter; uma reordenação conservadoramente exige nova liberação.

O entrypoint conecta arquivo privado `RESULT_RELEASE_DATA_FILE`, padrão `${PROJECT_DATA_FILE}.results.json`. Diretório novo recebe 0700 e arquivo novo 0600, com escrita temporária e rename; um processo escritor, como HU07. Falha de leitura/escrita não apaga dados nem publica decisão só em memória. Backup/restauração deve incluir esse arquivo com avaliações, projetos, grupos, rubricas e bytes privados. Não há migration nem alteração dos snapshots existentes.

## Integração com a avaliação real

`server.ts` usa a última rodada C1 submetida e as avaliações gravadas em `EVALUATION_DATA_FILE`. A factory aceita `evaluationRepository` para habilitar o mesmo fluxo, ou `evaluations` para injetar um provedor de teste.

`integration/gradesFixture.ts` continua atendendo aos testes isolados da consolidação. O fluxo `e2e/evaluation.spec.ts` usa o servidor normal com submissão, avaliação e liberação reais.

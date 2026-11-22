# C2 — avaliação por rubrica (HU08, #34/#39)

O serviço de avaliação de Yuhang consome a rodada C1 de Enzo. O servidor entrega o contrato ao módulo de consolidação de Kauê pelo `EvaluationProvider`. A interface de avaliação usa as [rotas privadas da HU08](../api-inicial.md#avaliação--hu08--c2).

## Campos e origem

`packages/api/src/models/evaluation.ts` exporta `evaluationContractSchema` e o tipo `EvaluationContract`:

| Campo | Formato e significado |
| --- | --- |
| `projectId`, `submissionId`, `round` | Inteiros positivos; identificadores da submissão C1 persistida |
| `rubricVersionId` | ID da versão C0 fixada pela submissão |
| `rubric` | Cópia completa de `RubricVersion` [C0](c0-requisitos-rubrica.md), incluindo critérios, escala e pesos |
| `expectedEvaluatorIds` | IDs únicos dos avaliadores atualmente atribuídos, em ordem crescente; pode ser vazio |
| `evaluations` | Até um registro por avaliador previsto, em ordem crescente de ID |

Cada registro contém `evaluatorId`, `status`, `revision`, `scores`, `finalizedAt` e `history`. Cada nota usa `{criterionId:string, score:number, comment:string}`; cada evento usa `{action, actorId, at, reason, revision, scores}`. O histórico preserva cópia das notas por revisão. Datas usam ISO UTC. Identidades e autorizações deverão vir do backend autenticado, nunca do cliente.

| Estado | Significado para o consumidor |
| --- | --- |
| `PENDENTE` | Ainda sem notas: revisão 0, notas/histórico vazios, `finalizedAt: null` |
| `RASCUNHO` | Notas parciais válidas; não conta como avaliação completa |
| `FINALIZADA` | Todos os critérios preenchidos e data de finalização; conta como recebida |
| `REABERTA` | Volta a pendente para consolidação, com justificativa e histórico da versão final anterior; `finalizedAt: null` |

Ausência de um registro para um avaliador previsto também representa pendência. O consumidor deve contar apenas `FINALIZADA` como avaliação completa. A nota consolidada e a liberação ao grupo ficam fora deste contrato e desta entrega.

## Exemplos executáveis compartilhados

`packages/api/src/test/evaluationContractExamples.ts` exporta `evaluationContractExamples()`. Retorna quatro DTOs completos e independentes (`pending`, `draft`, `finalized`, `reopened`), com projeto 1, submissão 11, rodada 1, rubrica 1 e avaliador 2. Todos contêm a mesma rubrica com critérios `funcionamento` (60%) e `documentacao` (40%), escala 0–10.

Trechos para leitura rápida (os DTOs completos estão no arquivo acima):

```json
{
  "pending": {
    "evaluatorId": 2, "status": "PENDENTE", "revision": 0,
    "scores": [], "finalizedAt": null, "history": []
  },
  "finalized": {
    "evaluatorId": 2, "status": "FINALIZADA", "revision": 2,
    "scores": [
      {"criterionId": "funcionamento", "score": 8, "comment": "Atende aos requisitos."},
      {"criterionId": "documentacao", "score": 9, "comment": ""}
    ],
    "finalizedAt": "2026-11-06T13:00:00.000Z"
  },
  "reopened": {
    "evaluatorId": 2, "status": "REABERTA", "revision": 3,
    "finalizedAt": null,
    "lastHistoryEvent": {
      "action": "REABERTA", "actorId": 3,
      "at": "2026-11-07T12:00:00.000Z", "reason": "Rever documentação.", "revision": 3
    }
  }
}
```

O envelope ilustrativo acima não representa uma resposta HTTP existente; omite campos para legibilidade. As datas são dados de exemplo, não datas reais de entrega. Fixtures ficam restritas a desenvolvimento/testes. `models/evaluation.test.ts` verifica os DTOs contra o schema produtor e exemplifica o consumo dos estados, sem implementar C3 nem demonstrar um adapter real.

## Validação isolada de notas

`services/evaluationValidation.ts` exporta `validateEvaluationScores(rubric, input, finalizing)`. Recebe uma versão C0 fornecida pelo chamador e retorna notas validadas sem alterar a entrada:

- Aceita rascunho parcial ou vazio e notas finitas entre 0 e 10, inclusive os limites.
- Rejeita notas fora da escala, critérios desconhecidos ou repetidos; comentário opcional vira `""`.
- Quando `finalizing` é true, exige todos os critérios daquela versão.
- Usa a versão recebida; nunca consulta automaticamente a rubrica mais recente.

Formato/escala inválidos recebem `400 VALIDATION_ERROR`; critério desconhecido recebe `400 UNKNOWN_CRITERION`; finalização incompleta recebe `400 INCOMPLETE_EVALUATION`.

## Persistência e estados

Cada registro fica associado a projeto, submissão, versão da rubrica e avaliador. As notas usam a rubrica imutável da submissão, mesmo que o docente publique uma configuração mais nova. Devolver uma rodada para ajustes mantém seus registros consultáveis; a nova rodada começa com avaliações pendentes.

Uma avaliação finalizada só volta à edição depois de uma reabertura justificada. A nova revisão preserva as notas anteriores e registra ação, conta autenticada, data e justificativa. Enviar a revisão antiga recebe `409 EVALUATION_VERSION_CONFLICT`. Rodada fora de avaliação recebe `409 EVALUATION_ROUND_LOCKED`. Editar um resultado finalizado recebe `409 EVALUATION_FINALIZED`; reabrir um registro ausente ou ainda não finalizado recebe `404 EVALUATION_NOT_FOUND` ou `409 EVALUATION_NOT_FINALIZED`. Projeto ou submissão fora do escopo retornam 404; papéis sem permissão recebem 403.

O servidor grava `EVALUATION_DATA_FILE`, com padrão `${PROJECT_DATA_FILE}.evaluations.json`, por substituição atômica de arquivo privado para um único processo escritor. Copie-o junto com projetos, vínculos, rubricas, liberações e uploads. Em caso de falha de escrita, o estado em memória continua na última revisão gravada.

O C3 considera a última submissão ainda submetida. Uma rodada devolvida deixa de alimentar a consolidação até a próxima submissão. Remover um vínculo exclui o avaliador da consolidação e revoga seu acesso, preservando seus registros na visão docente. Somente avaliações finalizadas participam da nota; reabrir ou refinalizar muda a revisão e exige nova liberação do resultado.

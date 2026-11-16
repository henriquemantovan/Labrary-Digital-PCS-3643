# C2 — proposta de contrato de avaliação (S5, #34)

Produtor: Yuhang. Consumidor previsto: Kauê, #36/#41. Interface para alinhamento com Enzo (#33/#38) e Kauê; confirmação por ambos e integração permanecem pendentes. Esta entrega da semana 05–11/11 contém **schema, tipos, exemplos e validador isolado**. Não implementa rotas, formulário, persistência, finalização ou reabertura de avaliações; esses serviços pertencem à S6/#39.

## Campos e origem

`packages/api/src/models/evaluation.ts` exporta `evaluationContractSchema` e o tipo `EvaluationContract`:

| Campo | Formato e significado |
| --- | --- |
| `projectId`, `submissionId`, `round` | Inteiros positivos; projeto e rodada da futura submissão C1 |
| `rubricVersionId` | ID da versão C0 fixada pela submissão |
| `rubric` | Cópia completa de `RubricVersion` [C0](c0-requisitos-rubrica.md), incluindo critérios, escala e pesos |
| `expectedEvaluatorIds` | IDs únicos dos avaliadores previstos |
| `evaluations` | Registros propostos abaixo, no máximo um por avaliador previsto |

Cada registro contém `evaluatorId`, `status`, `revision`, `scores`, `finalizedAt` e `history`. Cada nota usa `{criterionId:string, score:number, comment:string}`; cada evento usa `{action, actorId, at, reason, revision, scores}`. O histórico preserva cópia das notas por revisão. Datas usam ISO UTC. Identidades e autorizações deverão vir do backend autenticado, nunca do cliente.

| Estado proposto | Significado para o consumidor |
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

Formato/escala inválidos geram `ZodError`; critério desconhecido gera `ApiError` com código `UNKNOWN_CRITERION`; incompletude gera `INCOMPLETE_EVALUATION` (ambos status 400 para futura composição HTTP). O schema C2 valida o formato e as referências; as notas devem passar também por esse validador, inclusive ao consumir exemplos de finalização. A validação não grava avaliações nem executa transições de estado.

## Próxima integração, fora da S5

Enzo fornecerá C1 com IDs da submissão/rodada, snapshot imutável dos materiais e referência/cópia da rubrica. Os consumidores não devem reconstruir uma rodada usando materiais ou rubrica atuais. Na S6 serão implementados autorização de avaliador, serviço/API/formulário, persistência, auditoria e reabertura pelo professor. Na S7 serão validados reinício, rodada real e demonstração integrada. Nenhum desses itens é declarado concluído nesta entrega #34.

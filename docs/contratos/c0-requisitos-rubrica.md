# C0 — requisitos e rubrica versionados

Produtor: Yuhang (#34 / HU03). Consumidores: Enzo (#33/#38, upload/submissão) e Yuhang (#39, avaliação). Implementação local para revisão; o acordo entre integrantes não é presumido.

## Origem e compatibilidade

Esta extração continua os modelos `Requirement` / `RubricVersion`, a validação de pesos e o controle otimista do `planningRepository` de Yuhang no [PR #26](https://github.com/henriquemantovan/Labrary-Digital-PCS-3643/pull/26), branch `feat/hu02-hu03-sprint3`. O histórico original permanece intacto. Grupos e vínculos continuam no módulo de Henrique.

As antigas rotas propostas no PR #26 não chegaram à main. O novo contrato grava requisitos e rubrica juntos, em versões imutáveis; acrescenta identificadores estáveis por critério e valida formatos efetivamente suportados pelo upload. Não há atualização nem exclusão de versões anteriores. Alterar a configuração sempre exige criar explicitamente uma nova versão, mesmo antes da primeira avaliação.

## Rotas privadas

Todas as respostas usam `{ data: ... }`; mutações exigem sessão e `X-CSRF-Protection: 1`.

| Método e rota (prefixo `/api`) | Resposta |
| --- | --- |
| `GET /projects/:projectId/configuration` | Última versão ou `null` se ainda não configurado |
| `GET /projects/:projectId/configuration/versions` | Histórico em ordem crescente de versão |
| `GET /projects/:projectId/configuration/versions/:versionId` | Uma versão imutável pertencente ao projeto |
| `POST /projects/:projectId/configuration/versions` | `201`, nova configuração completa |

Leitura: aluno do grupo, avaliador atribuído e professor da turma, conforme os vínculos reais da HU02. Escrita: professor da turma ou administrador no perfil autorizado. Projeto fora do escopo é `404`; papel sem permissão de escrita é `403`; sessão ausente é `401`.

POST recebe `baseVersionId: 0` na primeira versão e o ID da última versão nas seguintes. Base desatualizada retorna `409 RUBRIC_VERSION_CONFLICT`, evitando sobrescrever alterações concorrentes. Valores inválidos retornam `400 VALIDATION_ERROR`. Campos de autor/projeto/versão enviados pelo cliente são recusados; o servidor define esses valores.

## Exemplo de criação

```json
{
  "baseVersionId": 0,
  "title": "Entrega final",
  "requirements": [
    { "kind": "VIDEO", "label": "Vídeo de apresentação", "required": true, "allowedMimeTypes": ["video/mp4", "video/webm"], "maxSizeBytes": 524288000, "dueAt": "2026-11-25T23:59:00-03:00" },
    { "kind": "RELATORIO", "label": "Relatório do projeto", "required": true, "allowedMimeTypes": ["application/pdf"], "maxSizeBytes": 20971520, "dueAt": "2026-11-25T23:59:00-03:00" },
    { "kind": "MANUAL", "label": "Manual de uso", "required": true, "allowedMimeTypes": ["application/pdf"], "maxSizeBytes": 20971520, "dueAt": "2026-11-25T23:59:00-03:00" }
  ],
  "criteria": [
    { "id": "funcionamento", "title": "Funcionamento", "description": "Demonstração do sistema", "weight": 60, "minScore": 0, "maxScore": 10 },
    { "id": "documentacao", "title": "Documentação", "description": "Clareza do relatório e manual", "weight": 40, "minScore": 0, "maxScore": 10 }
  ]
}
```

A resposta acrescenta `id`, `projectId`, `classId`, `versionNumber`, `createdBy` e `createdAt`, retirando `baseVersionId`. O ID retornado é também o `rubricVersionId` usado em C1/C2. `versionNumber` cresce por projeto; `id` é único neste armazenamento. IDs de critérios são strings de até 64 letras, números, `_` e `-`, únicas dentro da versão.

São obrigatórios exatamente vídeo, relatório e manual. Formatos são uma lista não vazia e sem duplicatas: MP4/WebM para vídeo e PDF para documentos, compatíveis com a detecção de bytes existente. Tamanhos são inteiros positivos seguros, em bytes. Cada material tem prazo ISO 8601 válido com timezone; prazos já passados são permitidos para refletir uma entrega encerrada. Pesos são positivos, com até duas casas decimais, e somam exatamente 100%; escala fixa de 0 a 10.

## Integração e preservação

O adapter `createRubricMaterialPolicy` utiliza a última configuração para formatos, tamanhos, títulos e prazos de upload. Sem configuração explícita, preserva a política padrão preexistente. Material complementar `OUTRO` conserva a regra opcional padrão. O prazo global do projeto continua sendo um limite adicional; a devolução para `AJUSTES` permite upload após os prazos, conforme a HU04. `/material-rules` expõe `dueAt`, `lock` e `canUpload` por requisito para a interface mostrar bloqueios específicos.

Enzo deve registrar em C1 o `rubricVersionId` e a cópia exata desta versão, junto à rodada e às versões submetidas de materiais. Consumidores devem resolver a versão pelo ID fixado, nunca buscar a última rubrica para uma avaliação anterior. O contrato C2 proposto exige preservar a rubrica utilizada; o serviço de avaliação pertence à S6 e ainda não está implementado neste incremento. A submissão real de Enzo continua sendo uma integração separada; este contrato não cria submissões.

## Persistência e backup

O entrypoint persiste em `RUBRIC_DATA_FILE` (padrão: `${PROJECT_DATA_FILE}.rubrics.json`); `createApp` usa memória quando nenhum repositório é injetado. O arquivo privado usa gravação temporária seguida de renomeação e suporta um processo escritor. Não é um adapter PostgreSQL.

Na primeira execução, arquivo ausente significa configuração ainda não criada. Arquivos inválidos ou históricos incoerentes impedem a carga; não são apagados nem reinicializados. Antes de atualizar/restaurar, interrompa o escritor e copie em conjunto o arquivo de projetos, grupos, rubricas e `UPLOAD_DIR`, mantendo uma cópia intacta. Este módulo não converte metadados antigos de materiais nem gravações privadas não integradas do PR #26; eventuais dados externos exigem conversão explícita e validada.

Testes relevantes: `rubricRoutes.test.ts` (autorização, contrato, pesos, formatos, prazo e conflito), `fileRubricStorage.test.ts` (reinício, referências independentes, erro de gravação e corrupção), `rubricMaterialRoutes.test.ts` (upload com política configurada e prazos por requisito). Resultados executados constam do relatório de entrega, não deste contrato.

# API REST

A API utiliza o prefixo `/api`, com respostas `{ "data": ... }` e erros `{ "error": { "code", "message", "details?" } }`. Arquivos usam `multipart/form-data`; OAuth utiliza redirecionamentos.

## Autenticação e segurança

Rotas privadas exigem sessão em cookie HttpOnly. Alterações exigem `X-CSRF-Protection: 1`; `Origin`, quando informado, deve corresponder a `APP_ORIGIN`. A interface e a API usam a mesma origem. Respostas incluem `Cache-Control: no-store`.

Erros principais: `400` entrada inválida, `401` sem sessão, `403` operação proibida, `404` recurso ausente ou fora do escopo, `409` conflito de estado e `429` excesso de tentativas de login. O armazenamento pode retornar `413` para arquivo grande, `415` para formato recusado, `503` para indisponibilidade/limite de operações e `507` para capacidade esgotada.

## Acesso e administração

| Método | Rota | Uso |
| --- | --- | --- |
| GET | `/health` | Saúde da API |
| GET | `/auth/providers` | Métodos de login disponíveis |
| GET | `/auth/google` | Iniciar login Google |
| GET | `/auth/google/callback` | Concluir login Google |
| POST | `/auth/login` | Login local/teste com `{email,password}` |
| GET | `/auth/me` | Consultar a própria sessão |
| POST | `/auth/logout` | Revogar sessão; resposta `204` |
| POST | `/auth/profile` | Confirmar `{fullName,uspNumber,entryYear}` |
| POST | `/auth/view-role` | ADMIN seleciona `{role}` ou `null` para encerrar a prévia |
| GET | `/admin/users` | Listar contas |
| PATCH | `/admin/users/:userId/role` | Alterar `{role}` |
| GET/POST | `/admin/guests` | Consultar/autorizar convidados; criação recebe `{email}` |
| DELETE | `/admin/guests/:invitationId` | Revogar convite e sessões |
| GET | `/scope` | Turmas e grupos permitidos |

Novos usuários Google começam como aluno. E-mail externo exige convite. Aluno USP sem cadastro completo recebe `403 ACADEMIC_PROFILE_REQUIRED` na área acadêmica. O login por senha no modo Google fica restrito às oito contas fictícias habilitadas em desenvolvimento local. Detalhes em [login Google](login-google.md) e [permissões](manual-de-uso.md#acesso-e-permissões).

## Grupos e projetos

| Método | Rota | Uso |
| --- | --- | --- |
| GET | `/classes/:classId/administration` | Grupos e pessoas disponíveis |
| POST | `/classes/:classId/groups` | Criar grupo com `{name}` |
| PUT | `/classes/:classId/groups/:groupId/members` | Definir `{memberIds}` |
| GET/PUT | `/projects/:projectId/evaluators` | Consultar/definir `{evaluatorIds}` |
| GET | `/projects` | Listar projetos permitidos; filtros `status`, `classId`, `groupId`, `pending` |
| POST | `/projects` | Criar com `{classId,groupId,title,description,category}` |
| GET | `/projects/:projectId` | Detalhar projeto |

Aluno acessa os próprios grupos; avaliador, suas atribuições; professor, suas turmas. A prévia acadêmica de ADMIN usa seus vínculos. Alterações de integrantes e avaliadores são auditadas e revogam acesso na próxima requisição.

## Requisitos, arquivos e feedback

| Método | Rota | Uso |
| --- | --- | --- |
| GET | `/projects/:projectId/configuration` | Configuração atual |
| GET | `/projects/:projectId/configuration/versions` | Histórico de configurações |
| GET | `/projects/:projectId/configuration/versions/:versionId` | Versão específica |
| POST | `/projects/:projectId/configuration/versions` | Nova versão de requisitos/critérios de avaliação |
| GET | `/projects/:projectId/material-rules` | Formatos, tamanhos, prazos e permissão de envio |
| GET/POST | `/projects/:projectId/materials` | Listar/criar materiais |
| POST | `/projects/:projectId/materials/:materialId/versions` | Enviar nova versão |
| GET | `/projects/:projectId/materials/:materialId/versions/:versionId/file` | Download privado |
| GET/HEAD | `/projects/:projectId/materials/:materialId/versions/:versionId/stream` | Reprodução privada de vídeo |
| GET/POST | `/projects/:projectId/messages` | Consultar/enviar feedback privado |

A configuração contém requisitos de vídeo, relatório e manual e critérios com pesos somando 100%, notas de 0 a 10 e IDs únicos. Versões anteriores são conservadas para as rodadas que as utilizam.

O envio é multipart com um arquivo `file`. Na criação, informe `kind` antes do arquivo; `title` é opcional. Na substituição, envie apenas o arquivo. O servidor valida os bytes, a extensão e o tamanho e registra SHA-256. As versões retornam `downloadUrl`; vídeos também retornam `playbackUrl`. Chaves do bucket não são expostas. Somente aluno do grupo envia nos estados e prazos permitidos.

Mensagens recebem `{text,materialVersionId?,clientMessageId}`. A chave UUID permite repetir o envio sem duplicar a mensagem. Autor, papel e data vêm da sessão/servidor; o texto não é HTML.

## Submissão e avaliação

| Método | Rota | Uso |
| --- | --- | --- |
| GET | `/projects/:projectId/submission-checklist` | Pendências e autorização de submissão |
| GET/POST | `/projects/:projectId/submissions` | Histórico/enviar rodada com `{clientSubmissionId}` UUID |
| GET | `/projects/:projectId/submissions/:submissionId` | Detalhar rodada |
| POST | `/projects/:projectId/submissions/:submissionId/return` | Devolver para ajustes |
| POST | `/projects/:projectId/reopen` | Reabrir entrega com `{reason}` |
| GET | `/projects/:projectId/submissions/:submissionId/evaluations` | Consultar avaliações permitidas |
| PUT | `/projects/:projectId/submissions/:submissionId/evaluations/me` | Salvar rascunho com `{scores,expectedRevision}` |
| POST | `/projects/:projectId/submissions/:submissionId/evaluations/me/finalize` | Finalizar critérios com `{scores,expectedRevision}` |
| POST | `/projects/:projectId/submissions/:submissionId/evaluations/:evaluatorId/reopen` | Reabrir com `{reason,expectedRevision}` |

A rodada conserva versões exatas dos materiais e dos critérios de avaliação. A submissão bloqueia uploads; a devolução permite outra rodada. O avaliador edita apenas sua avaliação nos projetos atribuídos. A revisão esperada impede sobrescrever uma alteração concorrente.

## Notas e publicação

| Método | Rota | Uso |
| --- | --- | --- |
| GET | `/classes/:classId/grades` | Consolidação docente; `?format=csv` exporta CSV |
| GET | `/projects/:projectId/results/consolidation` | Resultado e fingerprint de confirmação |
| POST | `/projects/:projectId/results/release` | Liberar `{submissionId,fingerprint}` |
| GET | `/projects/:projectId/result` | Resultado do grupo, oculto antes da liberação |
| GET | `/projects/:projectId/publication` | Gestão privada da publicação |
| POST | `/projects/:projectId/finalization` | Finalizar `{submissionId}` |
| POST | `/projects/:projectId/publication` | Publicar `{submissionId,materialVersionIds,groupAuthorization:{confirmed:true,reference}}` |
| DELETE | `/projects/:projectId/publication` | Retirar publicação; resposta `204` |
| GET | `/catalog` | Catálogo público; filtros `q`, `academicYear`, `classId`, `category` |
| GET | `/catalog/:projectId` | Detalhe público |
| GET/HEAD | `/catalog/:projectId/materials/:versionId/file` | Arquivo autorizado da publicação |

A nota por avaliador é a soma ponderada dos critérios; a nota final é a média das avaliações finalizadas e previstas. Uma avaliação ausente continua pendente. Reabrir ou alterar avaliações invalida a liberação anterior do resultado. Liberar notas não publica materiais.

Finalizar exige a rodada vigente completa e suas avaliações concluídas. Publicar exige versões do snapshot finalizado e referência de consentimento. A retirada bloqueia novas leituras públicas e mantém o histórico privado. O catálogo omite notas, feedback, integrantes e dados de armazenamento.

Vídeo privado ou público aceita um Range por requisição: `206` para faixa válida e `416` para faixa inválida/múltipla. HEAD retorna cabeçalhos, sem corpo. O acesso é revalidado antes das leituras.

Os modelos executáveis estão em `packages/api/src/models/`. Os arquivos [c3-exemplos.json](contratos/c3-exemplos.json) e [c4-exemplo.json](contratos/c4-exemplo.json) são exemplos compartilhados pelos testes e componentes de demonstração.

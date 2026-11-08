# C4 — Autorização e consulta de publicação

Versão 1, proposta pelo produtor Henrique em 07/11/2026 para #32/#37; consumidores Dan (#35/#40). O contrato está disponível para desenvolvimento e testes. Confirmação conjunta e adapter real ficam pendentes; não há rotas públicas implementadas nesta semana.

O schema executável está em [`publication.ts`](../../packages/api/src/models/publication.ts). O [exemplo JSON](c4-exemplo.json) é compartilhável entre os testes do produtor e os testes do cliente de catálogo. Fixtures ficam restritas a desenvolvimento/testes; nunca devem ser fallback no servidor de produção.

## DTO público

`PublicProject` contém `id`, `title`, `description`, `academicYear`, `class: {id,name}`, `category`, `publicationStatus: "PUBLICADO"`, `publishedAt` ISO UTC e `materials`. Cada material contém `id`, `versionId` real, `kind`, `title`, `mimeType`, `sizeBytes` e `contentUrl`.

O produtor deve construir a projeção por lista explícita de campos e incluir somente versões autorizadas na publicação. Não usar spread de projeto/material privado. Nunca expor notas, resultado, avaliações, feedback, integrantes, e-mails, autor de upload, checksum, `storageKey`, diretórios de arquivos ou IDs de sessão. O schema estrito rejeita campos adicionais em todos os níveis. O DTO não comprova a autorização do conteúdo: essa seleção pertence ao serviço de publicação real da S6.

`id` identifica o projeto; `versionId` identifica a versão imutável escolhida, não o número sequencial da versão. Substituir material no rascunho não muda automaticamente a versão pública. `contentUrl` é relativo à mesma origem, no formato `/api/catalog/:projectId/materials/:versionId/file`. Não usar o download privado da HU04 nem URLs diretas do armazenamento. O exemplo omite deliberadamente o manual: material disponível no projeto não significa material autorizado.

## Autorização e estados

| Operação prevista | Quem | Condição |
| --- | --- | --- |
| Finalizar | Professor da turma ou ADMIN autorizado | Rodada real C1 e todas as avaliações C3 concluídas; regra da S6 |
| Publicar | Professor da turma ou ADMIN autorizado | Projeto finalizado, ação explícita e seleção explícita de versões do snapshot aprovado |
| Retirar publicação | Professor da turma ou ADMIN autorizado | Publicação existente; revoga acesso público |
| Listar, detalhar e abrir bytes públicos | Visitante ou usuário | Publicação ativa e versão incluída explicitamente |

A prévia de ADMIN segue o perfil acadêmico e vínculos efetivos. `resultadoLiberado` (C3), conclusão das avaliações e autorização de publicação são condições diferentes. Finalizado continua privado sem publicação. A liberação de notas ao grupo não publica notas, mensagens nem materiais. Retirada muda o registro interno para `RETIRADO`; registros retirados nunca aparecem como DTO público.

## Portas e HTTP previstos para S6

`PublicPublicationProvider.list(filter)` recebe `q`, `academicYear`, `classId`, `category`; retorna `PublicProject[]`. Filtros se combinam por AND; `q` procura no título sem diferenciar maiúsculas/minúsculas, usando a mesma normalização no consumidor e produtor. Sem resultados: `[]`. `get(projectId)` retorna DTO ativo ou `undefined`; o adapter HTTP mapeia ausência para 404.

O consumidor S5 reutiliza este schema e o exemplo JSON nos testes. A normalização adotada pelo consumidor é `trim()` no termo e `toLocaleLowerCase("pt-BR")` em termo/título, preservando acentos; confirmar com o produtor na integração. [Componentes, cliente HTTP e limites da demonstração](../catalogo-semana-5.md). Este registro não presume confirmação conjunta nem endpoints já implementados.

| Método e rota previstos | Resposta |
| --- | --- |
| `GET /api/catalog` | `200 {data: PublicProject[]}` |
| `GET /api/catalog/:projectId` | `200 {data: PublicProject}` |
| `GET /api/catalog/:projectId/materials/:versionId/file` | Bytes da versão pública autorizada |
| `POST /api/projects/:projectId/publication` | Mutação autenticada com CSRF, `{submissionId, materialVersionIds}`; IDs precisam pertencer ao snapshot finalizado |
| `DELETE /api/projects/:projectId/publication` | Mutação autenticada com CSRF; `204`, inclusive repetição autorizada |

Erros usam `{error:{code,message}}`: 400 `VALIDATION_ERROR`; 401 `UNAUTHENTICATED` nas mutações; 403 `FORBIDDEN` para papel inadequado; 404 `PROJECT_NOT_FOUND` para projeto fora da turma nas mutações; 409 `PUBLICATION_NOT_READY` sem finalização/avaliações completas e 409 `PUBLICATION_VERSION_CONFLICT` para snapshot alterado. Consulta pública ausente, retirada ou versão não autorizada usa o mesmo 404 `PUBLICATION_NOT_FOUND`, sem indicar qual condição falhou. Falha de serviço usa o envelope 500 existente, não fixture.

## Retirada, vídeo e cache

Listagem, detalhe e abertura de arquivo precisam consultar o estado ativo no momento da requisição. Retirada deve invalidar os três caminhos, inclusive URLs já copiadas e novas requisições Range. Respostas públicas e erros devem manter `Cache-Control: no-store`; não servir `UPLOAD_DIR` estaticamente nem emitir links duradouros que ignorem revogação. Bytes já recebidos não podem ser recolhidos. Streams iniciados antes da retirada podem terminar; requisições novas devem ser recusadas.

Vídeo deve suportar GET/HEAD e um único intervalo `Range: bytes=inicio-fim`, aberto ou sufixo: 206, `Accept-Ranges: bytes`, `Content-Range` e comprimento do trecho; sem Range: 200. Intervalo inválido/múltiplo/insatisfatível: 416 e `Content-Range: bytes */tamanho`. Validar autorização antes de informar tamanho ou qualquer cabeçalho de arquivo, inclusive HEAD/Range. Documentos usam download com nome seguro; vídeo permite reprodução inline. Esses comportamentos exigem implementação e E2E entre Henrique e Dan na S6; os testes atuais validam somente o contrato do DTO.
